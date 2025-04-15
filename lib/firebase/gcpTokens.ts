import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

export interface GCPTokens {
  accessToken: string;
  refreshToken: string;
  lastUpdated: Date;
}

export const storeGCPTokens = async (userId: string, tokens: GCPTokens) => {
  const tokenDoc = doc(db, "gcpTokens", userId);
  await setDoc(tokenDoc, {
    ...tokens,
    lastUpdated: new Date(),
  });
};

export const getGCPTokens = async (
  userId: string
): Promise<GCPTokens | null> => {
  const tokenDoc = doc(db, "gcpTokens", userId);
  const docSnap = await getDoc(tokenDoc);

  if (docSnap.exists()) {
    return docSnap.data() as GCPTokens;
  }

  return null;
};

export const updateGCPAccessToken = async (
  userId: string,
  newAccessToken: string
) => {
  const tokenDoc = doc(db, "gcpTokens", userId);
  await setDoc(
    tokenDoc,
    {
      accessToken: newAccessToken,
      lastUpdated: new Date(),
    },
    { merge: true }
  );
};
