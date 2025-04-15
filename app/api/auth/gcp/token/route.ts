import { NextRequest, NextResponse } from "next/server";
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { GoogleAuth } from "google-auth-library";

// Initialize Firebase Admin if not already initialized
let adminApp: App;
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
    console.error("Firebase initialization error:", error);
  }
} else {
  adminApp = getApps()[0];
}

export async function POST(request: NextRequest) {
  try {
    // Get authorization header with Firebase ID token
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    // Extract the Firebase token
    const firebaseToken = authHeader.substring(7);

    // Verify the Firebase token
    const auth = getAuth(adminApp);
    try {
      await auth.verifyIdToken(firebaseToken);
    } catch (error) {
      console.error("Invalid Firebase token:", error);
      return NextResponse.json(
        { error: "Invalid Firebase authentication token" },
        { status: 401 }
      );
    }

    // Get GCP service account credentials from environment variable
    const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY || "{}");

    if (!credentials.project_id) {
      throw new Error("Invalid GCP service account configuration");
    }

    // Create a Google Auth instance with the service account and necessary scopes
    const googleAuth = new GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/compute",
        "https://www.googleapis.com/auth/compute.readonly",
      ],
    });

    // Get an access token from the auth client
    const accessToken = await googleAuth.getAccessToken();

    if (!accessToken) {
      throw new Error("Failed to get GCP access token");
    }

    // Return the token
    return NextResponse.json({ token: accessToken });
  } catch (error) {
    console.error("Error getting GCP token:", error);

    return NextResponse.json(
      {
        error: "Failed to get GCP token",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
