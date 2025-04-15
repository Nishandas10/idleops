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
}

/**
 * Updates VM status in Firestore
 */
export const updateVMStatus = async (
  db: Firestore,
  vmStatus: VMStatus
): Promise<void> => {
  try {
    // Create document reference - using vmStatus collection consistently
    const docRef = doc(db, "vmStatus", vmStatus.instanceId);

    // Check if document exists
    const docSnap = await getDoc(docRef);

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
        await updateDoc(docRef, statusData);
        console.log(`Updated status for VM: ${vmStatus.instanceId}`);
      }
    } else {
      // Document doesn't exist, create it
      await setDoc(docRef, statusData);
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
  callback: (status: VMStatus) => void
) => {
  const docRef = doc(db, "vmStatus", instanceId);

  return onSnapshot(
    docRef,
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
 * Listen for status changes across all VM instances
 */
export const listenToAllVMStatusChanges = (
  db: Firestore,
  callback: (statuses: VMStatus[]) => void
) => {
  const vmStatusRef = collection(db, "vmStatus");

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
  instanceId: string
): Promise<VMStatus | null> => {
  try {
    const docRef = doc(db, "vmStatus", instanceId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as VMStatus;
    }

    return null;
  } catch (error) {
    console.error("Error getting VM status from Firestore:", error);
    throw error;
  }
};
