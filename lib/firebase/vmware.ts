import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  Firestore as ClientFirestore,
  DocumentData,
  Timestamp,
} from "firebase/firestore";

import type { Firestore as AdminFirestore } from "firebase-admin/firestore";

export interface VMware {
  instanceId: string;
  instanceName?: string;
  status: "active" | "idle";
  autoHibernate: boolean;
  lastActive: Date | string | Timestamp;
  lastUpdated: Date | string | Timestamp;
  cpuUsage?: number;
  userId: string;
}

type FirestoreInstance = ClientFirestore | AdminFirestore;

/**
 * Creates or updates a VM in the vmware collection
 */
export const updateVM = async (
  db: FirestoreInstance,
  vmData: VMware,
  userId: string
): Promise<void> => {
  try {
    // Create document reference for the user
    const userDocRef = doc(db as any, "vmware", userId);

    // Check if document exists
    const docSnap = await getDoc(userDocRef);

    const vmInfo = {
      ...vmData,
      lastUpdated: serverTimestamp(),
      // Ensure lastActive is properly formatted
      lastActive:
        vmData.lastActive instanceof Date
          ? vmData.lastActive.toISOString()
          : vmData.lastActive,
    };

    if (docSnap.exists()) {
      // Update the specific VM in the user's document
      await updateDoc(userDocRef, {
        [`vms.${vmData.instanceId}`]: vmInfo,
      });
      console.log(`Updated VM: ${vmData.instanceId} for user: ${userId}`);
    } else {
      // Create new document with the first VM
      await setDoc(userDocRef, {
        vms: {
          [vmData.instanceId]: vmInfo,
        },
      });
      console.log(`Created VM entry: ${vmData.instanceId} for user: ${userId}`);
    }
  } catch (error) {
    console.error("Error updating VM in Firestore:", error);
    throw error;
  }
};

/**
 * Gets a specific VM for a user
 */
export const getVM = async (
  db: FirestoreInstance,
  instanceId: string,
  userId: string
): Promise<VMware | null> => {
  try {
    const userDocRef = doc(db as any, "vmware", userId);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const vmData = data.vms?.[instanceId];
      if (vmData) {
        return vmData as VMware;
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting VM from Firestore:", error);
    throw error;
  }
};

/**
 * Gets all VMs for a specific user
 */
export const getUserVMs = async (
  db: FirestoreInstance,
  userId: string
): Promise<VMware[]> => {
  try {
    const userDocRef = doc(db as any, "vmware", userId);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const vms = data.vms || {};
      return Object.values(vms) as VMware[];
    }

    return [];
  } catch (error) {
    console.error(`Error getting VMs for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Updates the status of a VM
 */
export const updateVMStatus = async (
  db: FirestoreInstance,
  instanceId: string,
  userId: string,
  status: "active" | "idle",
  cpuUsage?: number
): Promise<void> => {
  try {
    const userDocRef = doc(db as any, "vmware", userId);

    await updateDoc(userDocRef, {
      [`vms.${instanceId}.status`]: status,
      [`vms.${instanceId}.lastUpdated`]: serverTimestamp(),
      [`vms.${instanceId}.cpuUsage`]: cpuUsage,
      [`vms.${instanceId}.lastActive`]:
        status === "active" ? serverTimestamp() : undefined,
    });

    console.log(`Updated status for VM: ${instanceId} to ${status}`);
  } catch (error) {
    console.error("Error updating VM status:", error);
    throw error;
  }
};

/**
 * Updates the auto-hibernate setting for a VM
 */
export const updateVMAutoHibernate = async (
  db: FirestoreInstance,
  instanceId: string,
  userId: string,
  autoHibernate: boolean
): Promise<void> => {
  try {
    const userDocRef = doc(db as any, "vmware", userId);

    await updateDoc(userDocRef, {
      [`vms.${instanceId}.autoHibernate`]: autoHibernate,
      [`vms.${instanceId}.lastUpdated`]: serverTimestamp(),
    });

    console.log(
      `Updated auto-hibernate for VM: ${instanceId} to ${autoHibernate}`
    );
  } catch (error) {
    console.error("Error updating VM auto-hibernate setting:", error);
    throw error;
  }
};
