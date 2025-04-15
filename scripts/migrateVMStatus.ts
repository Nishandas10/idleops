import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  deleteDoc,
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * This script migrates VM status data from the old flat structure
 * to the new structure organized by user
 */
async function migrateVMStatusData() {
  console.log("Starting VM status migration...");

  // Step 1: Get all users
  const usersCollection = collection(db, "users");
  const usersSnapshot = await getDocs(usersCollection);

  const users: { id: string; email: string }[] = [];
  usersSnapshot.forEach((doc) => {
    const userData = doc.data();
    users.push({
      id: doc.id,
      email: userData.email,
    });
  });

  console.log(`Found ${users.length} users`);

  // Step 2: Get all VM status documents
  const vmStatusCollection = collection(db, "vm_status");
  const vmStatusSnapshot = await getDocs(vmStatusCollection);

  const vmStatuses: any[] = [];
  vmStatusSnapshot.forEach((doc) => {
    vmStatuses.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  console.log(`Found ${vmStatuses.length} VM status documents to migrate`);

  // Default user to use if we can't determine ownership
  const defaultUserId = users.length > 0 ? users[0].id : "system";

  // Step 3: Migrate each VM status to the appropriate user folder
  let migrated = 0;
  let errors = 0;

  for (const vmStatus of vmStatuses) {
    try {
      // Determine which user owns this VM instance
      // This depends on your business logic - for now we'll use the default user
      // In a real application, you might need to look at other collections to determine ownership
      const userId = vmStatus.userId || defaultUserId;

      // Create the new document path
      const newDocRef = doc(db, "vm_status", userId, "instances", vmStatus.id);

      // Copy the data (excluding 'id' which is already the document ID)
      const { id, ...statusData } = vmStatus;

      // Add a migration timestamp
      const dataToMigrate = {
        ...statusData,
        migratedAt: serverTimestamp(),
      };

      // Write to the new location
      await setDoc(newDocRef, dataToMigrate);

      // Optionally, delete the old document
      // Uncomment this when you're sure the migration is working correctly
      // await deleteDoc(doc(db, "vm_status", vmStatus.id));

      migrated++;
      console.log(
        `Migrated VM status for instance ${vmStatus.id} to user ${userId}`
      );
    } catch (error) {
      console.error(
        `Error migrating VM status for instance ${vmStatus.id}:`,
        error
      );
      errors++;
    }
  }

  console.log("Migration completed!");
  console.log(`Successfully migrated: ${migrated} documents`);
  console.log(`Errors: ${errors} documents`);
  console.log(
    "Note: The old documents have not been deleted. Uncomment the deleteDoc line in the script to do so after verifying the migration was successful."
  );
}

// Run the migration
migrateVMStatusData().catch(console.error);
