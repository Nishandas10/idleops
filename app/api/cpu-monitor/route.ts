import { NextRequest, NextResponse } from "next/server";
import { CPUMonitor } from "./cpuMonitor.server";
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import {
  getAuth as getAdminAuth,
  Auth as AdminAuth,
} from "firebase-admin/auth";
import {
  initializeApp as initializeAdminApp,
  cert,
  getApps,
  App,
} from "firebase-admin/app";

// Initialize Firebase Admin only if it hasn't been initialized
let adminApp: App;
let adminAuth: AdminAuth;

try {
  // Check if Firebase Admin is already initialized
  if (getApps().length === 0) {
    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !process.env.FIREBASE_PRIVATE_KEY
    ) {
      throw new Error("Firebase Admin environment variables are missing");
    }

    adminApp = initializeAdminApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    adminApp = getApps()[0];
  }
  adminAuth = getAdminAuth(adminApp);
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
  // Don't throw here, let the route handlers handle the error
}

// Keep track of monitors for each instance
const monitors: Record<string, CPUMonitor> = {};

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export async function GET(request: NextRequest) {
  try {
    // Check if Firebase Admin is properly initialized
    if (!adminAuth) {
      return NextResponse.json(
        { error: "Firebase Admin is not properly initialized" },
        { status: 500 }
      );
    }

    // Extract instance ID from query parameters
    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get("instanceId");
    const instanceName = searchParams.get("instanceName");
    const autoHibernateParam = searchParams.get("autoHibernate");

    // Get authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    // Extract the token
    const token = authHeader.substring(7);

    // Verify the token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error("Error verifying token:", error);
      return NextResponse.json(
        { error: "Invalid authorization token" },
        { status: 401 }
      );
    }

    // Convert autoHibernate param to boolean
    const autoHibernate = autoHibernateParam === "true";

    if (!instanceId) {
      return NextResponse.json(
        { error: "instanceId query parameter is required" },
        { status: 400 }
      );
    }

    // Create monitor if it doesn't exist
    if (!monitors[instanceId]) {
      monitors[instanceId] = new CPUMonitor(
        instanceId,
        decodedToken.uid,
        instanceName || undefined,
        db,
        autoHibernate
      );
      monitors[instanceId].startMonitoring();
      console.log(`Started monitoring instance ${instanceId}`);
    } else if (autoHibernateParam !== null) {
      // Update auto-hibernate setting if it was provided
      monitors[instanceId].setAutoHibernate(autoHibernate);
    }

    // Get current state
    const state = monitors[instanceId].getInstanceState();

    return NextResponse.json(state);
  } catch (error) {
    console.error("Error in CPU monitoring:", error);
    return NextResponse.json(
      {
        error: "CPU monitoring error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Clean up monitors when the server is shutting down
process.on("beforeExit", () => {
  Object.values(monitors).forEach((monitor) => {
    monitor.stopMonitoring();
  });
});
