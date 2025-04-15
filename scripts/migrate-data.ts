import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { ServiceAccount } from "firebase-admin";
import serviceAccount from "../idleops-85936-firebase-adminsdk-fbsvc-7b5ff2eda9.json" assert { type: "json" };

initializeApp({
  credential: cert(serviceAccount as ServiceAccount),
});

const db = getFirestore();

interface VMInstance {
  instanceId: string;
  instanceName?: string;
  status: "active" | "idle";
  autoHibernate: boolean;
  lastActive: string;
  lastUpdated: string | Date | FirebaseFirestore.FieldValue;
  cpuUsage?: number;
  userId: string;
}

interface UserData {
  id: string;
  instanceIds?: string[]; // Array of instance IDs associated with this user
}

async function migrate() {
  // Step 1: Fetch all valid user IDs from the users collection and build an instance-to-user map
  console.log("Fetching user IDs from users collection...");
  const usersSnapshot = await db.collection("users").get();

  if (usersSnapshot.empty) {
    console.warn("⚠️ No users found in users collection!");
  }

  const validUserIds = new Set<string>();
  const instanceToUserMap: Record<string, string> = {}; // Maps instance IDs to user IDs

  // Process users to build mapping
  usersSnapshot.forEach((userDoc) => {
    const userId = userDoc.id;
    validUserIds.add(userId);

    // If the user has instance IDs stored, add them to our mapping
    const userData = userDoc.data() as UserData;
    if (userData.instanceIds && Array.isArray(userData.instanceIds)) {
      userData.instanceIds.forEach((instanceId) => {
        instanceToUserMap[instanceId] = userId;
      });
    }
  });

  console.log(
    `Found ${validUserIds.size} valid users in the users collection.`
  );
  console.log(
    `Built mapping for ${
      Object.keys(instanceToUserMap).length
    } instance IDs to users.`
  );

  // Special case handling for known instance ID
  const knownInstanceId = "2701040365025676118";
  let userForKnownInstance = instanceToUserMap[knownInstanceId];

  if (!userForKnownInstance) {
    // If we couldn't find it in the mapping, let's look up the first user as a fallback
    // This is just a heuristic - adjust based on your needs
    if (validUserIds.size > 0) {
      userForKnownInstance = [...validUserIds][0]; // Get first user from set
      console.log(
        `⚠️ Couldn't find user for instance ${knownInstanceId}, using first user ${userForKnownInstance} as fallback.`
      );
    } else {
      console.error(
        `❌ Couldn't find any user for instance ${knownInstanceId} and no users exist in collection!`
      );
    }
  } else {
    console.log(
      `✅ Found user ${userForKnownInstance} for instance ${knownInstanceId}.`
    );
  }

  // Step 2: Process VM status documents
  const vmStatusCollection = db.collection("vm_status");
  const snapshot = await vmStatusCollection.get();

  const userVMs: Record<string, Record<string, VMInstance>> = {};
  const docsToDelete: string[] = [];
  let missingUserIdCount = 0;
  let unmatchedUserIdCount = 0;
  let fixedMissingUserIds = 0;

  console.log(`Found ${snapshot.size} docs in vm_status...`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docId = doc.id;

    // Extract instanceId from data
    const instanceId = data.instanceId || docId; // Use doc ID as fallback for instanceId

    // First check if the document itself is already a user document with instances
    if (
      data.instances &&
      typeof data.instances === "object" &&
      validUserIds.has(docId)
    ) {
      console.log(
        `Found valid user document: ${docId} with instances map - keeping as is`
      );
      continue;
    }

    // Handle the special case - if this is the document with the known instance ID
    if (docId === knownInstanceId || instanceId === knownInstanceId) {
      if (userForKnownInstance) {
        console.log(
          `🔍 Special handling: Mapping instance ${knownInstanceId} to user ${userForKnownInstance}`
        );

        // Group by the found user ID
        if (!userVMs[userForKnownInstance]) userVMs[userForKnownInstance] = {};

        userVMs[userForKnownInstance][instanceId] = {
          instanceId,
          instanceName: data.instanceName || "",
          status: data.status || "idle",
          autoHibernate: data.autoHibernate ?? true,
          lastActive: data.lastActive || new Date().toISOString(),
          lastUpdated: FieldValue.serverTimestamp(),
          ...(typeof data.cpuUsage === "number"
            ? { cpuUsage: data.cpuUsage }
            : {}),
          userId: userForKnownInstance,
        };

        docsToDelete.push(docId);
        fixedMissingUserIds++;
        continue;
      }
    }

    // Find the correct user ID for this instance
    let userId = data.userId;

    // If userId is missing, try to look it up in our instance-to-user map
    if (!userId && instanceToUserMap[instanceId]) {
      userId = instanceToUserMap[instanceId];
      console.log(
        `🔄 Fixed: Found user ${userId} for instance ${instanceId} from user mapping`
      );
      fixedMissingUserIds++;
    }

    if (!userId) {
      console.log(`⚠️ Document ${docId} has no userId field`);
      missingUserIdCount++;
      continue;
    }

    if (!instanceId) {
      console.log(`⚠️ Document ${docId} has no instanceId field`);
      continue;
    }

    // Verify if this is a valid user ID from users collection
    if (!validUserIds.has(userId)) {
      console.warn(
        `⚠️ Document ${docId} references user ${userId} which is not in users collection`
      );
      unmatchedUserIdCount++;
      continue;
    }

    console.log(
      `Processing: Document ${docId} for user ${userId}, instance ${instanceId}`
    );

    // Group by Firebase user UID
    if (!userVMs[userId]) userVMs[userId] = {};

    userVMs[userId][instanceId] = {
      instanceId,
      instanceName: data.instanceName || "",
      status: data.status || "idle",
      autoHibernate: data.autoHibernate ?? true,
      lastActive: data.lastActive || new Date().toISOString(),
      lastUpdated: FieldValue.serverTimestamp(),
      ...(typeof data.cpuUsage === "number" ? { cpuUsage: data.cpuUsage } : {}),
      userId,
    };

    // Mark for deletion since it will be migrated to the user document
    docsToDelete.push(docId);
  }

  if (missingUserIdCount > 0) {
    console.warn(
      `⚠️ Found ${missingUserIdCount} documents with missing userId field`
    );
    if (fixedMissingUserIds > 0) {
      console.log(
        `✅ Fixed ${fixedMissingUserIds} documents with missing userId by lookup`
      );
    }
  }

  if (unmatchedUserIdCount > 0) {
    console.warn(
      `⚠️ Found ${unmatchedUserIdCount} documents with a userId not in the users collection`
    );
  }

  console.log(`Organized VMs for ${Object.keys(userVMs).length} users.`);

  if (Object.keys(userVMs).length === 0) {
    console.log("No VM data to migrate. Exiting.");
    return;
  }

  // Display preview of users and their instances
  for (const [userId, instances] of Object.entries(userVMs)) {
    console.log(
      `User ${userId} has ${Object.keys(instances).length} VM instances:`
    );
    for (const instanceId of Object.keys(instances).slice(0, 3)) {
      console.log(
        `  - Instance: ${instanceId} (${
          instances[instanceId].instanceName || "unnamed"
        })`
      );
    }
    if (Object.keys(instances).length > 3) {
      console.log(
        `  - ... and ${Object.keys(instances).length - 3} more instances`
      );
    }
  }

  // Ask for confirmation
  console.log(
    "\nReady to write data. Press Enter to continue or Ctrl+C to abort..."
  );
  await new Promise((resolve) => process.stdin.once("data", resolve));

  // Write grouped VMs to user documents
  for (const [userId, instances] of Object.entries(userVMs)) {
    // Use the user ID from users collection as the document ID
    const userDocRef = db.collection("vm_status").doc(userId);
    await userDocRef.set({ instances }, { merge: true });
    console.log(
      `✅ Written: vm_status/${userId} with ${
        Object.keys(instances).length
      } instances`
    );
  }

  // Ask confirmation before deleting
  if (docsToDelete.length > 0) {
    console.log(
      `\nAbout to delete ${docsToDelete.length} old documents. Press Enter to continue or Ctrl+C to abort...`
    );
    await new Promise((resolve) => process.stdin.once("data", resolve));

    // Delete old documents in batches
    const batchSize = 500;
    for (let i = 0; i < docsToDelete.length; i += batchSize) {
      const batch = db.batch();
      const chunk = docsToDelete.slice(i, i + batchSize);

      chunk.forEach((docId) => {
        const docRef = db.collection("vm_status").doc(docId);
        batch.delete(docRef);
      });

      await batch.commit();
      console.log(
        `🗑️ Deleted ${chunk.length} old documents (${i + 1}-${Math.min(
          i + batchSize,
          docsToDelete.length
        )} of ${docsToDelete.length})`
      );
    }
  } else {
    console.log("No documents to delete.");
  }

  console.log("🎉 Migration complete!");
}

migrate().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
