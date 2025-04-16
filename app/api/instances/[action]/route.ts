import { NextRequest, NextResponse } from "next/server";
import { InstancesClient } from "@google-cloud/compute/build/src/v1";
import { GoogleAuth } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage as getAdminStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

interface VMActionRequest {
  instanceId: string;
  zone: string;
  projectId: string;
}

// Initialize Firebase Admin (if not already initialized)
if (!getApps().length) {
  try {
    // Read service account directly from local file
    const serviceAccountPath = path.join(
      process.cwd(),
      "idleops-85936-firebase-adminsdk-fbsvc-7b5ff2eda9.json"
    );
    let serviceAccount;

    try {
      const rawData = fs.readFileSync(serviceAccountPath, "utf8");
      serviceAccount = JSON.parse(rawData);
    } catch (readError) {
      console.error("Error reading service account file:", readError);
      throw new Error(
        "Could not read service account file. Please ensure the file exists at the correct location."
      );
    }

    if (!serviceAccount.project_id) {
      throw new Error("Invalid service account configuration");
    }

    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw error;
  }
}

const adminStorage = getAdminStorage();
const adminAuth = getAuth();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
): Promise<NextResponse> {
  const { action } = await params;

  if (action !== "start" && action !== "stop") {
    return NextResponse.json(
      { error: "Invalid action. Must be 'start' or 'stop'" },
      { status: 400 }
    );
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract and verify the token
    const idToken = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Parse request body
    const { instanceId, zone, projectId }: VMActionRequest = await req.json();

    if (!instanceId || !zone || !projectId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get GCP service account credentials
    const keyFilePath = path.join(
      process.cwd(),
      "tmp",
      "service-account-key.json"
    );
    let keyExists = false;

    try {
      // Check if the key file exists
      fs.accessSync(keyFilePath, fs.constants.R_OK);
      keyExists = true;
    } catch (error) {
      console.log("Service account key file doesn't exist or is not readable");

      // Create tmp directory if it doesn't exist
      const tmpDir = path.join(process.cwd(), "tmp");
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      // Try to fetch from Firebase Storage
      try {
        const bucket = adminStorage.bucket();
        const [files] = await bucket.getFiles({
          prefix: `users/${userId}/service-accounts/${projectId}`,
        });

        let serviceAccountFile;
        for (const file of files) {
          if (file.name.endsWith("key.json")) {
            serviceAccountFile = file;
            break;
          }
        }

        if (serviceAccountFile) {
          const [fileContent] = await serviceAccountFile.download();
          fs.writeFileSync(keyFilePath, fileContent);
          keyExists = true;
          console.log(
            "Successfully fetched GCP credentials from Firebase Storage"
          );
        }
      } catch (fbError) {
        console.error("Error fetching from Firebase Storage:", fbError);
        return NextResponse.json(
          {
            error:
              "Failed to fetch service account key. Please upload your service account key in the dashboard settings.",
          },
          { status: 400 }
        );
      }
    }

    if (!keyExists) {
      return NextResponse.json(
        {
          error:
            "Service account key not found. Please upload your service account key in the dashboard settings.",
        },
        { status: 400 }
      );
    }

    // Set the environment variable for Google libraries to use
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilePath;

    // Initialize client (prefers GOOGLE_APPLICATION_CREDENTIALS if set)
    const instancesClient = new InstancesClient();

    // Build the request for the Compute API
    const vmRequest = {
      project: projectId,
      zone,
      instance: instanceId,
    };

    // Execute the appropriate method based on action
    const [operation] =
      action === "start"
        ? await instancesClient.start(vmRequest)
        : await instancesClient.stop(vmRequest);

    return NextResponse.json({
      message: `VM ${action} operation initiated.`,
      operationName: operation.name,
    });
  } catch (error: any) {
    console.error("Error executing VM action:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
