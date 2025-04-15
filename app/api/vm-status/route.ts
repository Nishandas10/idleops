import { NextRequest, NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getVMStatus, updateVMStatus, VMStatus } from "@/lib/firebase/vmStatus";

// Initialize Firebase Admin if not already initialized
let adminApp;
if (!getApps().length) {
  try {
    // Parse the service account JSON from environment variable
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
    );

    if (!serviceAccount.project_id) {
      throw new Error("Invalid service account configuration");
    }

    adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
} else {
  adminApp = getApps()[0];
}

const db: Firestore = getFirestore();
const auth = getAuth();

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

    // Verify the token with Firebase Admin
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found in token" },
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
