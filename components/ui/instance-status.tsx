import { useEffect, useState } from "react";
import { Badge } from "./badge";

interface InstanceStatusProps {
    instanceId: string;
}

interface MetricData {
    cpu: number;
    timestamp: string;
    isHealthy: boolean;
}

export function InstanceStatus({ instanceId }: InstanceStatusProps) {
    const [metrics, setMetrics] = useState<MetricData[]>([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <Badge variant={isIdle ? "secondary" : "default"}>
                    {isIdle ? "Idle" : "Active"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                    {`CPU: ${latestMetric.cpu.toFixed(1)}%`}
                </span>
            </div>
            <div className="text-sm text-muted-foreground">
                Last active: {new Date(lastActiveTimestamp).toLocaleString()}
            </div>
        </div>
    );
} 