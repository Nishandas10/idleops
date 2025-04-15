import { NextRequest, NextResponse } from "next/server";
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  Firestore,
} from "firebase/firestore";

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

    // Get the preferences data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data.gcpProjectId) {
      return NextResponse.json(
        { error: "Missing required field: gcpProjectId" },
        { status: 400 }
      );
    }

    // Update the user document in Firestore
    await updateDoc(doc(db, "users", userId), {
      gcpProjectId: data.gcpProjectId,
      hasGcpToken: !!data.gcpToken,
      onboardingCompleted: true,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      message: "Preferences saved successfully",
      preferences: {
        userId,
        gcpProjectId: data.gcpProjectId,
        hasGcpToken: !!data.gcpToken,
        onboardingCompleted: true,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error saving user preferences:", error);

    return NextResponse.json(
      {
        error: "Failed to save preferences",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
