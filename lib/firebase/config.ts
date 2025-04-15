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
        firebaseApp = initializeApp(firebaseConfig);
        console.log("Firebase app initialized from lib/firebase/config.ts");
      } catch (error) {
        console.error("Error initializing Firebase app:", error);
        throw error;
      }
    } else {
      firebaseApp = getApps()[0];
    }
  }
  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    const app = getFirebaseApp();
    auth = getAuth(app);
    // Set persistence if needed
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
