import { NextRequest, NextResponse } from "next/server";
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getVMStatus, updateVMStatus, VMStatus } from "@/lib/firebase/vmStatus";

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

// GET handler - Get VM status
export async function GET(request: NextRequest) {
  try {
    // Get the query parameters
    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get("instanceId");
    const userId = searchParams.get("userId");

    if (!instanceId) {
      return NextResponse.json(
        { error: "Missing required parameter: instanceId" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required parameter: userId" },
        { status: 400 }
      );
    }

    // Get the status from Firestore
    const status = await getVMStatus(db, instanceId, userId);

    if (!status) {
      return NextResponse.json(
        { error: "VM status not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error("Error getting VM status:", error);
    return NextResponse.json(
      {
        error: "Failed to get VM status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// POST handler - Update VM status
export async function POST(request: NextRequest) {
  try {
    // Get the authorization header to extract the Firebase ID token
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract the token
    const idToken = authHeader.substring(7);

    // Verify the token and get user ID
    // In a real app, you would verify this token with Firebase Admin SDK
    // For now, we'll assume the token contains the user ID directly
    const userId = idToken; // This is a simplification

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
      userId: userId,
    };

    // Update VM status in Firestore
    await updateVMStatus(db, vmStatus, userId);

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
