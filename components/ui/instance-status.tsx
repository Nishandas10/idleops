import { useEffect, useState } from "react";
import { Badge } from "./badge";

interface InstanceStatusProps {
    instanceId: string;
    instanceName?: string;
    zone: string;
    onError?: (error: string) => void;
}

interface MetricData {
    cpu: number;
    timestamp: string;
    isHealthy: boolean;
}

export function InstanceStatus({ instanceId, instanceName = instanceId, zone, onError }: InstanceStatusProps) {
    const [metrics, setMetrics] = useState<MetricData[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastNotificationTime, setLastNotificationTime] = useState<Date | null>(null);

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

    useEffect(() => {
        async function fetchMetrics() {
            try {
                const response = await fetch(`/api/monitoring?instanceId=${instanceId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch metrics');
                }
                const data = await response.json();
                setMetrics(data.metrics);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching metrics:', error);
                setLoading(false);
            }
        }

        fetchMetrics();
        // Refresh metrics every 60 seconds
        const interval = setInterval(fetchMetrics, 60000);
        return () => clearInterval(interval);
    }, [instanceId]);

    useEffect(() => {
        if (!metrics.length) return;

        const latestMetric = metrics[metrics.length - 1];
        const isIdle = latestMetric.cpu < 50;
        
        if (!isIdle) return;

        // Find the most recent timestamp when CPU was above 50%
        const lastActiveTimestamp = metrics
            .slice()
            .reverse()
            .find(metric => metric.cpu >= 50)?.timestamp || latestMetric.timestamp;

        const lastActiveTime = new Date(lastActiveTimestamp);
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
    }, [metrics, instanceId, instanceName, lastNotificationTime, zone, onError]);

    if (loading || metrics.length === 0) {
        return (
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Badge variant="secondary">Loading...</Badge>
                </div>
            </div>
        );
    }

    const latestMetric = metrics[metrics.length - 1];
    const isIdle = latestMetric.cpu < 50; // Consider idle if CPU usage is below 50%

    // Find the most recent timestamp when CPU was above 50%
    const lastActiveTimestamp = metrics
        .slice()
        .reverse()
        .find(metric => metric.cpu >= 50)?.timestamp || latestMetric.timestamp;

    // Calculate idle duration
    const lastActiveTime = new Date(lastActiveTimestamp);
    const currentTime = new Date();
    const idleMinutes = Math.floor((currentTime.getTime() - lastActiveTime.getTime()) / (1000 * 60));

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <Badge variant={isIdle ? "secondary" : "default"}>
                    {isIdle ? "Idle" : "Active"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                    {`CPU: ${latestMetric.cpu.toFixed(1)}%`}
                    {isIdle && idleMinutes > 0 && ` (Idle for ${idleMinutes} min)`}
                </span>
            </div>
            <div className="text-sm text-muted-foreground">
                Last active: {lastActiveTime.toLocaleString()}
            </div>
        </div>
    );
} 