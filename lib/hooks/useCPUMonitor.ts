import { useState, useEffect } from "react";

interface InstanceState {
  id: string;
  lastActive: Date;
  isIdle: boolean;
  currentCPUUsage: number;
}

export function useCPUMonitor(instanceId: string) {
  const [instanceState, setInstanceState] = useState<InstanceState>({
    id: instanceId,
    lastActive: new Date(),
    isIdle: false,
    currentCPUUsage: 0,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchState = async () => {
      try {
        const response = await fetch(
          `/api/cpu-monitor?instanceId=${instanceId}`
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
  }, [instanceId]);

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
