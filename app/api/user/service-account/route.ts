import { NextRequest, NextResponse } from "next/server";
import { initializeApp, FirebaseApp, getApps } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, ref, getDownloadURL } from "firebase/storage";

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
let storage: any;

// Initialize Firebase if not already initialized
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
} else {
  app = getApps()[0];
  auth = getAuth(app);
  storage = getStorage(app);
}

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header to extract the Firebase ID token
    const authHeader = request.headers.get("authorization");
    const projectId = request.nextUrl.searchParams.get("projectId");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Extract the token
    const idToken = authHeader.substring(7);

    // Get the service account key URL
    try {
      // Here we're using the token as the user ID for simplicity
      // In a production app, you should verify the token and extract the actual user ID
      const userId = idToken;
      const serviceAccountRef = ref(
        storage,
        `users/${userId}/service-accounts/${projectId}/key.json`
      );

      // Get the download URL for the service account key
      const downloadURL = await getDownloadURL(serviceAccountRef);

      // Fetch the actual service account key file
      const response = await fetch(downloadURL);
      if (!response.ok) {
        throw new Error("Failed to download service account key file");
      }

      const serviceAccountKey = await response.json();

      // Return the service account key
      return NextResponse.json({ serviceAccountKey });
    } catch (error) {
      console.error("Error fetching service account key:", error);
      return NextResponse.json(
        { error: "Service account key not found" },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error("Error in service account API route:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch service account key",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
