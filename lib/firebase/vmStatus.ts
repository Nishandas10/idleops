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

interface UserVMStatuses {
  [instanceId: string]: VMStatus;
}

/**
 * Updates VM status in Firestore
 * Now organized by userId document containing all VM instances
 */
export const updateVMStatus = async (
  db: Firestore,
  vmStatus: VMStatus,
  userId: string
): Promise<void> => {
  try {
    // Create document reference for the user
    const docRef = doc(db, "vm_status", userId);

    // Check if document exists
    const docSnap = await getDoc(docRef);

    const statusData = {
      ...vmStatus,
      userId,
      lastUpdated: serverTimestamp(),
      // Make sure lastActive is a properly formatted timestamp if it's a Date
      lastActive:
        vmStatus.lastActive instanceof Date
          ? vmStatus.lastActive.toISOString()
          : vmStatus.lastActive,
    };

    if (docSnap.exists()) {
      // Update the specific instance in the user's document
      await updateDoc(docRef, {
        [`instances.${vmStatus.instanceId}`]: statusData,
      });
      console.log(`Updated status for VM: ${vmStatus.instanceId}`);
    } else {
      // Document doesn't exist, create it with the first instance
      await setDoc(docRef, {
        instances: {
          [vmStatus.instanceId]: statusData,
        },
      });
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
  instanceId: string,
  userId: string,
  callback: (status: VMStatus) => void
) => {
  const docRef = doc(db, "vm_status", userId);

  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const instanceData = data.instances?.[instanceId];
        if (instanceData) {
          callback(instanceData as VMStatus);
        }
      }
    },
    (error) => {
      console.error("Error listening to VM status changes:", error);
    }
  );
};

/**
 * Listen for status changes across all VM instances for a specific user
 */
export const listenToUserVMStatusChanges = (
  db: Firestore,
  userId: string,
  callback: (statuses: VMStatus[]) => void
) => {
  const docRef = doc(db, "vm_status", userId);

  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const instances = data.instances || {};
        const statuses = Object.values(instances) as VMStatus[];
        callback(statuses);
      } else {
        callback([]);
      }
    },
    (error) => {
      console.error(
        `Error listening to VM status changes for user ${userId}:`,
        error
      );
    }
  );
};

/**
 * Listen for status changes across all VM instances (admin function)
 */
export const listenToAllVMStatusChanges = (
  db: Firestore,
  callback: (statuses: VMStatus[]) => void
) => {
  const vmStatusRef = collection(db, "vm_status");

  return onSnapshot(
    vmStatusRef,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const statuses: VMStatus[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const instances = data.instances || {};
        Object.values(instances).forEach((instance) => {
          statuses.push(instance as VMStatus);
        });
      });
      callback(statuses);
    },
    (error) => {
      console.error("Error listening to all VM status changes:", error);
    }
  );
};

/**
 * Get current VM status for a specific user and instance
 */
export const getVMStatus = async (
  db: Firestore,
  instanceId: string,
  userId: string
): Promise<VMStatus | null> => {
  try {
    const docRef = doc(db, "vm_status", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const instanceData = data.instances?.[instanceId];
      if (instanceData) {
        return instanceData as VMStatus;
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting VM status from Firestore:", error);
    throw error;
  }
};

/**
 * Get all VM statuses for a specific user
 */
export const getUserVMStatuses = async (
  db: Firestore,
  userId: string
): Promise<VMStatus[]> => {
  try {
    const docRef = doc(db, "vm_status", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const instances = data.instances || {};
      return Object.values(instances) as VMStatus[];
    }

    return [];
  } catch (error) {
    console.error(`Error getting VM statuses for user ${userId}:`, error);
    throw error;
  }
};
