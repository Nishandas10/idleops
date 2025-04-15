import { NextRequest, NextResponse } from "next/server";
import { InstancesClient } from "@google-cloud/compute/build/src/v1";
import { GoogleAuth } from "google-auth-library";
import { fetchServiceAccountKey } from "@/lib/firebase/serviceAccount";
import * as fs from "fs";
import * as path from "path";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage as getAdminStorage } from "firebase-admin/storage";

interface VMActionRequest {
  instanceId: string;
  zone: string;
  projectId: string;
}

// Initialize Firebase Admin (if not already initialized)
if (!getApps().length) {
  try {
    // Parse the service account JSON from environment variable or file
    let serviceAccount;
    try {
      // First try to use the environment variable
      serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
      );
    } catch (e) {
      // If environment variable isn't set or is invalid, try to read from file
      const serviceAccountPath =
        process.env.FIREBASE_CREDENTIALS ||
        "idleops-85936-firebase-adminsdk-fbsvc-7b5ff2eda9.json";
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
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
  }
}

const adminStorage = getAdminStorage();

// Fixed: Properly type params as a Promise and await it
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
    // Get the authorization header to extract the Firebase ID token
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract the token
    const idToken = authHeader.substring(7);

    const body = (await req.json()) as Partial<VMActionRequest>;
    const { instanceId, zone, projectId } = body;
    if (!instanceId || !zone || !projectId) {
      return NextResponse.json(
        { error: "Missing 'instanceId', 'zone', or 'projectId'" },
        { status: 400 }
      );
    }

    // Try to get the user's service account key
    let credentials;
    let keyFilePath: string | null = null;

    try {
      // First, try to fetch the user's uploaded service account key
      credentials = await fetchServiceAccountKey(projectId, idToken);

      // If successful, write to a temporary file for the client libraries
      keyFilePath = path.join(process.cwd(), `temp-${projectId}-key.json`);
      fs.writeFileSync(keyFilePath, JSON.stringify(credentials, null, 2));
    } catch (error) {
      console.error("Failed to fetch user service account key:", error);

      // Try to use system service account
      keyFilePath =
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        "service-account-key.json";
      let keyExists = false;

      try {
        // Check if the key file exists
        fs.accessSync(keyFilePath, fs.constants.R_OK);
        keyExists = true;
      } catch (fileError) {
        console.log(
          "Service account key file doesn't exist or is not readable"
        );

        // Try to create the key file from environment variable
        try {
          const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
          if (serviceAccountKey) {
            fs.writeFileSync(keyFilePath, serviceAccountKey);
            keyExists = true;
          }
        } catch (writeError) {
          console.error(
            "Error writing service account key from env variable:",
            writeError
          );
        }

        // If still doesn't exist, try to fetch from Firebase Storage
        if (!keyExists) {
          try {
            const bucket = adminStorage.bucket();
            const [files] = await bucket.getFiles({
              prefix: `users/`,
            });

            let serviceAccountFile;
            for (const file of files) {
              if (
                file.name.includes(`service-accounts/${projectId}`) &&
                file.name.endsWith("key.json")
              ) {
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
          }
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

      // Read credentials from file
      credentials = JSON.parse(fs.readFileSync(keyFilePath, "utf8"));
    }

    // Set environment variable for Google libraries to use
    if (keyFilePath) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilePath;
    }

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
