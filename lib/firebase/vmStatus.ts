import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  Firestore,
  DocumentData,
  QuerySnapshot,
  collectionGroup,
} from "firebase/firestore";

export interface VMStatus {
  instanceId: string;
  instanceName?: string;
  status: "active" | "idle";
  autoHibernate: boolean;
  lastActive: Date | string;
  lastUpdated: Date | string;
  cpuUsage?: number;
  userId: string;
}

/**
 * Updates VM status in Firestore
 */
export const updateVMStatus = async (
  db: Firestore,
  vmStatus: VMStatus
): Promise<void> => {
  try {
    if (!vmStatus.userId) {
      throw new Error("userId is required to update VM status");
    }

    // Create nested document reference
    const userDocRef = doc(db, "vm_status", vmStatus.userId);
    const instancesCollectionRef = collection(userDocRef, "instances");
    const instanceDocRef = doc(instancesCollectionRef, vmStatus.instanceId);

    // Check if document exists
    const docSnap = await getDoc(instanceDocRef);

    const statusData = {
      ...vmStatus,
      lastUpdated: serverTimestamp(),
      // Make sure lastActive is a properly formatted timestamp if it's a Date
      lastActive:
        vmStatus.lastActive instanceof Date
          ? vmStatus.lastActive.toISOString()
          : vmStatus.lastActive,
    };

    if (docSnap.exists()) {
      // Only update if status has changed
      const currentData = docSnap.data() as VMStatus;

      if (
        currentData.status !== vmStatus.status ||
        currentData.autoHibernate !== vmStatus.autoHibernate ||
        currentData.cpuUsage !== vmStatus.cpuUsage
      ) {
        await updateDoc(instanceDocRef, statusData);
        console.log(`Updated status for VM: ${vmStatus.instanceId}`);
      }
    } else {
      // Document doesn't exist, create it
      await setDoc(instanceDocRef, statusData);
      console.log(`Created status entry for VM: ${vmStatus.instanceId}`);
    }
  } catch (error) {
    console.error("Error updating VM status in Firestore:", error);
    throw error;
  }
};

/**
 * Listen for VM status changes for a specific instance
 */
export const listenToVMStatusChanges = (
  db: Firestore,
  userId: string,
  instanceId: string,
  callback: (status: VMStatus) => void
) => {
  const instanceDocRef = doc(db, "vm_status", userId, "instances", instanceId);

  return onSnapshot(
    instanceDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as VMStatus;
        callback(data);
      }
    },
    (error) => {
      console.error("Error listening to VM status changes:", error);
    }
  );
};

/**
 * Listen for status changes across all VM instances for a user
 */
export const listenToAllVMStatusChanges = (
  db: Firestore,
  userId: string,
  callback: (statuses: VMStatus[]) => void
) => {
  const vmStatusRef = collection(db, "vm_status", userId, "instances");

  return onSnapshot(
    vmStatusRef,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const statuses: VMStatus[] = [];
      snapshot.forEach((doc) => {
        statuses.push(doc.data() as VMStatus);
      });
      callback(statuses);
    },
    (error) => {
      console.error("Error listening to all VM status changes:", error);
    }
  );
};

/**
 * Get current VM status
 */
export const getVMStatus = async (
  db: Firestore,
  userId: string,
  instanceId: string
): Promise<VMStatus | null> => {
  try {
    const instanceDocRef = doc(
      db,
      "vm_status",
      userId,
      "instances",
      instanceId
    );
    const docSnap = await getDoc(instanceDocRef);

    if (docSnap.exists()) {
      return docSnap.data() as VMStatus;
    }

    return null;
  } catch (error) {
    console.error("Error getting VM status from Firestore:", error);
    throw error;
  }
};

/**
 * Listen for status changes across all VM instances across all users
 * This is useful for admin functions like auto-hibernation
 */
export const listenToAllUsersVMStatusChanges = (
  db: Firestore,
  callback: (statuses: VMStatus[]) => void
) => {
  const instancesRef = collectionGroup(db, "instances");

  return onSnapshot(
    instancesRef,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const statuses: VMStatus[] = [];
      snapshot.forEach((doc) => {
        statuses.push(doc.data() as VMStatus);
      });
      callback(statuses);
    },
    (error) => {
      console.error("Error listening to all users VM status changes:", error);
    }
  );
};
