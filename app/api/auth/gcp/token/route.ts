import { NextRequest, NextResponse } from "next/server";
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import axios from "axios";

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

// Google OAuth config
const GOOGLE_TOKEN_URL = "https://securetoken.googleapis.com/v1/token";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET as string;

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
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(firebaseToken);
    } catch (error) {
      console.error("Invalid Firebase token:", error);
      return NextResponse.json(
        { error: "Invalid Firebase authentication token" },
        { status: 401 }
      );
    }

    // Get user info - we need this to access their Google account credentials
    const userRecord = await auth.getUser(decodedToken.uid);

    // Check for Google provider data
    const googleProvider = userRecord.providerData.find(
      (provider) => provider.providerId === "google.com"
    );

    if (!googleProvider) {
      return NextResponse.json(
        { error: "User does not have a linked Google account" },
        { status: 400 }
      );
    }

    // For security reasons, we can't directly get the user's OAuth tokens from Firebase Auth
    // Instead, we'll redirect the client to perform a proper OAuth flow

    // Return a response indicating the client needs to perform an OAuth flow
    return NextResponse.json({
      needsOAuth: true,
      message: "User needs to explicitly authorize GCP access",
    });
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
