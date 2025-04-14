import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { initializeApp } from "firebase/app";

interface InstanceState {
  id: string;
  lastActive: Date;
  isIdle: boolean;
  currentCPUUsage: number;
}

// Initialize Firebase auth
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase initialization error:", error);
}

const auth = getAuth(app);

export function useCPUMonitor(instanceId: string) {
  const [instanceState, setInstanceState] = useState<InstanceState>({
    id: instanceId,
    lastActive: new Date(),
    isIdle: false,
    currentCPUUsage: 0,
  });
  const [uid, setUid] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user ? user.uid : null);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchState = async () => {
      try {
        // Add user UID to the query parameters if available
        const uidParam = uid ? `&uid=${uid}` : "";
        const response = await fetch(
          `/api/cpu-monitor?instanceId=${instanceId}${uidParam}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch CPU state");
        }
        const data = await response.json();

        if (isMounted) {
          setInstanceState({
            ...data,
            lastActive: new Date(data.lastActive),
          });
        }
      } catch (error) {
        console.error("Error fetching CPU state:", error);
      }
    };

    // Initial fetch
    fetchState();

    // Poll every second to get more responsive updates
    const interval = setInterval(fetchState, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [instanceId, uid]);

  // Calculate idle duration in minutes
  const getIdleDuration = () => {
    if (!instanceState.isIdle) return 0;
    const now = new Date();
    const lastActive = new Date(instanceState.lastActive);
    return Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60));
  };

  return {
    instanceState,
    getIdleDuration,
  };
}
