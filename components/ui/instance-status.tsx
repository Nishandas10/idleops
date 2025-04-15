import { useEffect, useState } from "react";
import { Badge } from "./badge";
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, onAuthStateChanged } from 'firebase/auth';
import { listenToVMStatusChanges, VMStatus, updateVMStatus } from "@/lib/firebase/vmStatus";

interface InstanceStatusProps {
    instanceId: string;
    instanceName?: string;
    zone: string;
    onError?: (error: string) => void;
    autoHibernate: boolean;
    vmStatus?: 'active' | 'idle';
    lastActiveTimestamp?: string;
    cpuUsage?: number;
}

interface MetricData {
    cpu: number;
    timestamp: string;
    isHealthy: boolean;
}

// Initialize Firebase
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("Firebase initialization error:", error);
}

export function InstanceStatus({ 
    instanceId, 
    instanceName = instanceId, 
    zone, 
    onError, 
    autoHibernate,
    vmStatus: propVmStatus,
    lastActiveTimestamp,
    cpuUsage: propCpuUsage
}: InstanceStatusProps) {
    const [metrics, setMetrics] = useState<MetricData[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastNotificationTime, setLastNotificationTime] = useState<Date | null>(null);
    const [vmStatus, setVmStatus] = useState<VMStatus | null>(null);
    const [refreshInterval, setRefreshInterval] = useState<number>(10000); // Start with 10 seconds refresh
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Add auth state listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    const handleHibernate = async () => {
        try {
            const response = await fetch(`/api/instances/stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    instanceId,
                    zone,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to stop instance');
            }
            
            // Show success notification
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification(`Instance ${instanceId} Hibernation`, {
                    body: `Instance ${instanceName} is being stopped.`,
                    icon: '/favicon.ico'
                });
            }
        } catch (error) {
            console.error('Error stopping instance:', error);
            if (onError) {
                onError('Failed to stop instance. Please try again.');
            }
        }
    };

    useEffect(() => {
        // Request notification permission on component mount
        if ("Notification" in window) {
            Notification.requestPermission();
        }
    }, []);

    // Always fetch metrics for real-time data
    useEffect(() => {
        async function fetchMetrics() {
            try {
                const response = await fetch(`/api/monitoring?instanceId=${instanceId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch metrics');
                }
                const data = await response.json();
                
                if (data.metrics && data.metrics.length > 0) {
                    setMetrics(data.metrics);
                    
                    // Update Firestore with latest metrics data if available
                    if (db && data.metrics.length > 0 && currentUser) {
                        const latestMetric = data.metrics[data.metrics.length - 1];
                        const isIdle = latestMetric.cpu < 50;
                        
                        // Find the most recent timestamp when CPU was above 50%
                        const timestamp = data.metrics
                            .slice()
                            .reverse()
                            .find((metric: MetricData) => metric.cpu >= 50)?.timestamp || latestMetric.timestamp;
                        
                        // Only update if we have data and vmStatus is already loaded
                        if (vmStatus) {
                            // Update Firestore with the latest data from monitoring API
                            updateVMStatus(db, {
                                ...vmStatus,
                                status: isIdle ? 'idle' : 'active',
                                lastActive: new Date(timestamp),
                                cpuUsage: latestMetric.cpu,
                                lastUpdated: new Date()
                            }, currentUser.uid);
                        }
                        
                        // Adjust refresh interval based on activity
                        // More frequent if active, less frequent if idle
                        if (isIdle) {
                            setRefreshInterval(30000); // 30 seconds if idle
                        } else {
                            setRefreshInterval(10000); // 10 seconds if active
                        }
                    }
                }
                
                setLoading(false);
            } catch (error) {
                console.error('Error fetching metrics:', error);
                setLoading(false);
            }
        }

        fetchMetrics();
        // Dynamic refresh interval
        const interval = setInterval(fetchMetrics, refreshInterval);
        return () => clearInterval(interval);
    }, [instanceId, refreshInterval, db, vmStatus, currentUser]);

    // Listen for VM status changes from Firestore
    useEffect(() => {
        if (!db || !instanceId || !currentUser) return;
        
        const unsubscribe = listenToVMStatusChanges(db, instanceId, currentUser.uid, (status) => {
            setVmStatus(status);
            // If status data is loaded, we can end loading state
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [db, instanceId, currentUser]);

    useEffect(() => {
        // Skip if autoHibernate is off or we don't have status data
        if (!autoHibernate || !metrics.length) return;

        // Always use metrics for determining idle status for notifications
        // This ensures we're acting on real-time data
        const latestMetric = metrics[metrics.length - 1];
        const isIdle = latestMetric.cpu < 50;
        
        if (!isIdle) return;
        
        // Find the most recent timestamp when CPU was above 50%
        const activeTimestamp = metrics
            .slice()
            .reverse()
            .find(metric => metric.cpu >= 50)?.timestamp || latestMetric.timestamp;

        const lastActiveTime = new Date(activeTimestamp);
        const currentTime = new Date();
        const idleMinutes = Math.floor((currentTime.getTime() - lastActiveTime.getTime()) / (1000 * 60));

        // Only show notification if idle for more than 2 minutes and we haven't notified in the last 5 minutes
        if (idleMinutes >= 2 && 
            (!lastNotificationTime || 
             (currentTime.getTime() - lastNotificationTime.getTime()) > 5 * 60 * 1000)) {
            if ("Notification" in window && Notification.permission === "granted") {
                const notification = new Notification(`Instance ${instanceId} Idle Alert`, {
                    body: `Instance ${instanceName} has been idle for ${idleMinutes} minutes. Click to stop the instance.`,
                    icon: '/favicon.ico',
                    requireInteraction: true // Keep notification visible until user interacts
                });

                notification.onclick = (event) => {
                    event.preventDefault();
                    if (confirm(`Do you want to stop the idle instance ${instanceName}?`)) {
                        handleHibernate();
                    }
                    notification.close();
                };

                setLastNotificationTime(currentTime);
            }
        }
    }, [metrics, instanceId, instanceName, lastNotificationTime, zone, onError, autoHibernate]);

    if (loading || !metrics.length) {
        return (
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Badge variant="secondary">Loading...</Badge>
                </div>
            </div>
        );
    }

    // Always prioritize metrics data for display
    const latestMetric = metrics[metrics.length - 1];
    const isIdle = latestMetric.cpu < 50; // Consider idle if CPU usage is below 50%
    
    // Find the most recent timestamp when CPU was above 50%
    const metricTimestamp = metrics
        .slice()
        .reverse()
        .find(metric => metric.cpu >= 50)?.timestamp || latestMetric.timestamp;

    // Calculate idle duration
    const lastActiveTime = new Date(metricTimestamp);
    const currentTime = new Date();
    const idleMinutes = Math.floor((currentTime.getTime() - lastActiveTime.getTime()) / (1000 * 60));

    // Fix for zero CPU values - sometimes the monitoring API returns 0 temporarily
    // If CPU is 0, but the instance was active very recently (last 1 minute), still show as active
    const cpuIsZero = latestMetric.cpu === 0;
    const wasRecentlyActive = idleMinutes < 1;
    const displayAsActive = !isIdle || (cpuIsZero && wasRecentlyActive);
    
    // Update Firestore for consistency if the status doesn't match our display
    if (db && vmStatus && currentUser && vmStatus.status !== (displayAsActive ? 'active' : 'idle')) {
        updateVMStatus(db, {
            ...vmStatus,
            status: displayAsActive ? 'active' : 'idle',
            cpuUsage: latestMetric.cpu,
            lastUpdated: new Date()
        }, currentUser.uid);
    }

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <Badge variant={displayAsActive ? "default" : "secondary"}>
                    {displayAsActive ? "Active" : "Idle"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                    {`CPU: ${latestMetric.cpu.toFixed(1)}%`}
                    {!displayAsActive && idleMinutes > 0 && ` (Idle for ${idleMinutes} min)`}
                </span>
            </div>
            <div className="text-sm text-muted-foreground">
                Last active: {lastActiveTime.toLocaleString()}
            </div>
        </div>
    );
} 