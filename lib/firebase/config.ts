import { initializeApp, FirebaseApp, getApps } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import {
  getFirestore,
  Firestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase with persistence
let firebaseApp: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let storage: any;

// Singleton pattern to avoid multiple initializations
export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    if (!getApps().length) {
      try {
        // Verify required environment variables
        const requiredEnvVars = [
          "NEXT_PUBLIC_FIREBASE_API_KEY",
          "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
          "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        ];

        const missingVars = requiredEnvVars.filter(
          (varName) => !process.env[varName]
        );

        if (missingVars.length > 0) {
          throw new Error(
            `Missing required Firebase configuration: ${missingVars.join(", ")}`
          );
        }

        firebaseApp = initializeApp(firebaseConfig);
        console.log("Firebase app initialized successfully");
      } catch (error) {
        console.error("Error initializing Firebase app:", error);
        throw new Error(
          `Failed to initialize Firebase: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } else {
      firebaseApp = getApps()[0];
      console.log("Using existing Firebase app instance");
    }
  }
  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    try {
      const app = getFirebaseApp();
      auth = getAuth(app);
      console.log("Firebase Auth initialized successfully");

      // Set up auth state observer for debugging
      auth.onAuthStateChanged((user) => {
        if (user) {
          console.log("Auth state changed: User is signed in", user.uid);
        } else {
          console.log("Auth state changed: User is signed out");
        }
      });
    } catch (error) {
      console.error("Error initializing Firebase Auth:", error);
      throw new Error(
        `Failed to initialize Firebase Auth: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
  return auth;
}

export function getFirebaseFirestore(): Firestore {
  if (!firestore) {
    const app = getFirebaseApp();
    firestore = getFirestore(app);

    // Enable offline persistence for better performance
    // enableMultiTabIndexedDbPersistence(firestore)
    //   .catch((err) => {
    //     console.error("Failed to enable offline persistence:", err);
    //   });
  }
  return firestore;
}

export function getFirebaseStorage() {
  if (!storage) {
    const app = getFirebaseApp();
    storage = getStorage(app);
  }
  return storage;
}

// Default export for convenience
const firebase = {
  app: getFirebaseApp,
  auth: getFirebaseAuth,
  firestore: getFirebaseFirestore,
  storage: getFirebaseStorage,
};

export default firebase;
