import { NextRequest, NextResponse } from "next/server";
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { updateVMStatus, VMStatus } from "@/lib/firebase/vmStatus";

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
    // This endpoint is intended for server-side code, but we can add auth later if needed

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
