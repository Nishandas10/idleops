import {
  InstancesClient,
  ZonesClient,
} from "@google-cloud/compute/build/src/v1";
import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage as getAdminStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

interface VMInstance {
  id: string;
  name: string;
  zone: string;
  status: string;
  labels: Record<string, string>;
}

// Initialize Firebase Admin (if not already initialized)
if (!getApps().length) {
  try {
    // Try to use the direct file path first
    const serviceAccountPath = path.join(
      process.cwd(),
      "idleops-85936-firebase-adminsdk-fbsvc-7b5ff2eda9.json"
    );

    let serviceAccount;
    if (fs.existsSync(serviceAccountPath)) {
      // Read from file
      const rawServiceAccount = fs.readFileSync(serviceAccountPath, "utf8");
      serviceAccount = JSON.parse(rawServiceAccount);
    } else {
      // Fallback to environment variable
      serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
      );
    }

    if (!serviceAccount.project_id) {
      throw new Error("Invalid service account configuration");
    }

    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });

    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw error;
  }
}

// These lines should be executed AFTER Firebase is properly initialized
const adminStorage = getAdminStorage();
const adminAuth = getAuth();

export async function GET(request: Request) {
  console.log("Starting VM instances fetch...");

  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
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

    // Get GCP service account credentials
    const keyFilePath = path.join(process.cwd(), "tmp", "key.json");
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
          prefix: `users/${userId}/service-accounts`,
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

    // Create clients using the environment variable
    const zonesClient = new ZonesClient();
    const instancesClient = new InstancesClient();

    console.log("Fetching zones...");
    const [zonesList] = await zonesClient.list({
      project: process.env.GCP_PROJECT_ID,
    });
    console.log("Found zones:", zonesList.length);

    // Create an array of promises for fetching instances from each zone
    const instancePromises = zonesList
      .filter((zone) => zone.name) // Filter out zones without names
      .map(async (zone) => {
        try {
          console.log("Fetching instances from zone:", zone.name);
          const [instancesList] = await instancesClient.list({
            project: process.env.GCP_PROJECT_ID,
            zone: zone.name!,
          });

          console.log(
            `Found ${instancesList.length} instances in zone ${zone.name}`
          );

          return instancesList.map(
            (instance): VMInstance => ({
              id: String(instance.id || ""),
              name: instance.name || "",
              zone: zone.name || "",
              status: instance.status || "",
              labels: instance.labels || {},
            })
          );
        } catch (zoneError) {
          console.error(
            `Error fetching instances from zone ${zone.name}:`,
            zoneError
          );
          return [] as VMInstance[]; // Return empty array for failed zones
        }
      });

    // Wait for all zone requests to complete in parallel
    const instancesArrays = await Promise.all(instancePromises);

    // Flatten the array of arrays into a single array of instances
    const allInstances: VMInstance[] = instancesArrays.flat();

    console.log(`Total instances found: ${allInstances.length}`);
    return NextResponse.json(allInstances);
  } catch (err) {
    console.error("Error details:", {
      message: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : undefined,
      error: err,
    });

    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch VM instances",
        details: err,
      },
      { status: 500 }
    );
  }
}
