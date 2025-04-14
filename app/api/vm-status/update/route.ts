import { NextRequest, NextResponse } from "next/server";
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { updateVMStatus, VMStatus } from "@/lib/firebase/vmStatus";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { initializeApp as initializeAdminApp, cert } from "firebase-admin/app";

// Initialize Firebase Admin
const adminApp = initializeAdminApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const adminAuth = getAdminAuth();

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

// POST handler - Update VM status from server-side code
export async function POST(request: NextRequest) {
  try {
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

    // Get the status data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data.instanceId || !data.status) {
      return NextResponse.json(
        { error: "Missing required fields: instanceId or status" },
        { status: 400 }
      );
    }

    // Create status object
    const vmStatus: VMStatus = {
      instanceId: data.instanceId,
      userId: decodedToken.uid,
      instanceName: data.instanceName || data.instanceId,
      status: data.status,
      autoHibernate: data.autoHibernate ?? false,
      lastActive: data.lastActive || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      cpuUsage: data.cpuUsage,
    };

    // Update VM status in Firestore
    await updateVMStatus(db, vmStatus);

    return NextResponse.json({
      message: "VM status updated successfully",
      status: vmStatus,
    });
  } catch (error) {
    console.error("Error updating VM status:", error);
    return NextResponse.json(
      {
        error: "Failed to update VM status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
