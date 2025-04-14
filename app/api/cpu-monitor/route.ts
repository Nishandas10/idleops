import { NextRequest, NextResponse } from "next/server";
import { CPUMonitor } from "./cpuMonitor.server";
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

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
    // Extract instance ID from query parameters
    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get("instanceId");
    const instanceName = searchParams.get("instanceName");
    const autoHibernateParam = searchParams.get("autoHibernate");
    const uid = searchParams.get("uid"); // Get user UID from query parameters

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
        instanceName || undefined,
        db,
        autoHibernate,
        uid || undefined // Pass the user UID to the CPUMonitor
      );
      monitors[instanceId].startMonitoring();
      console.log(
        `Started monitoring instance ${instanceId} for user ${uid || "unknown"}`
      );
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
