import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";

export interface User {
  id: string;
  email: string;
  isGCPConnected: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function createUser(id: string, email: string): Promise<void> {
  const user: User = {
    id,
    email,
    isGCPConnected: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(doc(db, "users", id), user);
}

export async function getUser(id: string): Promise<User | null> {
  const userDoc = await getDoc(doc(db, "users", id));
  if (!userDoc.exists()) {
    return null;
  }
  return userDoc.data() as User;
}

export async function updateUserGCPStatus(
  id: string,
  isConnected: boolean
): Promise<void> {
  await updateDoc(doc(db, "users", id), {
    isGCPConnected: isConnected,
    updatedAt: Timestamp.now(),
  });
}
