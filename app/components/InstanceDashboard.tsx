'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface MetricData {
  cpu: number;
  networkSent: number;
  networkReceived: number;
  diskIO: number;
  diskSpaceUsed: number;
  diskSpaceTotal: number;
  timestamp: string;
  isHealthy: boolean;
  instanceId?: string;
  instanceName?: string;
  // Formatted values
  cpuFormatted?: string;
  networkSentFormatted?: string;
  networkReceivedFormatted?: string;
  diskIOFormatted?: string;
  diskSpaceUsedFormatted?: string;
  diskSpaceTotalFormatted?: string;
}

interface InstanceDashboardProps {
  instanceId: string;
  instanceName: string;
}

export default function InstanceDashboard({ instanceId, instanceName }: InstanceDashboardProps) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle data fetching
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000; // 5 seconds

    async function fetchMetrics(isRetry = false) {
      try {
        if (!isMounted) return;
        if (!isRetry) {
          setLoading(true);
        }

        console.log("Making API request for instance:", instanceId);
        const response = await fetch(`/api/monitoring?instanceId=${instanceId}`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (!isMounted) return;

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API request failed: ${response.status}`, errorText);
          
          if (response.status === 400) {
            throw new Error(errorText);
          }

          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            throw new Error(`Rate limited. Please try again in ${retryAfter || 'a few'} seconds.`);
          }

          throw new Error(`Failed to fetch instance metrics: ${response.status} ${response.statusText}\n${errorText}`);
        }

        const data = await response.json();
        if (!isMounted) return;
        
        // Validate the metrics data structure
        if (!data || !data.metrics || !Array.isArray(data.metrics)) {
          console.error("Invalid metrics data received:", data);
          throw new Error("Invalid metrics data format received from server");
        }

        // Validate individual metric entries
        const validMetrics = data.metrics.filter((metric: MetricData) => {
          return typeof metric.cpu === 'number' &&
                 typeof metric.networkSent === 'number' &&
                 typeof metric.networkReceived === 'number' &&
                 typeof metric.diskIO === 'number' &&
                 typeof metric.diskSpaceUsed === 'number' &&
                 typeof metric.diskSpaceTotal === 'number' &&
                 typeof metric.timestamp === 'string';
        });

        if (validMetrics.length !== data.metrics.length) {
          console.warn(`Filtered out ${data.metrics.length - validMetrics.length} invalid metric entries`);
        }

        console.log("Successfully fetched metrics for instance:", instanceId);
        setMetrics(validMetrics);
        setLoading(false);
        setError(null);
        retryCount = 0; // Reset retry count on successful fetch
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching metrics:", err);
        
        // Handle retries for transient errors
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying fetch (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          retryCount++;
          setTimeout(() => fetchMetrics(true), RETRY_DELAY);
          return;
        }

        setError(err instanceof Error ? err.message : 'An error occurred while fetching metrics');
        setLoading(false);
      }
    }

    console.log("Starting metrics fetch cycle for instance:", instanceId);
    fetchMetrics();
    // Fetch every minute
    const interval = setInterval(fetchMetrics, 60 * 1000);
    
    return () => {
      console.log("Cleaning up instance dashboard for instance:", instanceId);
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [instanceId, router]);

  const formatChartData = (metrics: MetricData[]) => {
    return metrics.map(metric => ({
      ...metric,
      timestamp: new Date(metric.timestamp).toLocaleTimeString(),
      networkSentMB: metric.networkSent / (1024 * 1024),
      networkReceivedMB: metric.networkReceived / (1024 * 1024),
      diskIOMB: metric.diskIO / (1024 * 1024),
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg">Loading instance metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-600">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  const latestMetric = metrics[metrics.length - 1];
  const chartData = formatChartData(metrics);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Instance: {instanceName}</h1>
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            latestMetric?.isHealthy 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {latestMetric?.isHealthy ? 'Healthy' : 'Warning'}
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>CPU Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-2">
              <p className="text-2xl font-bold">{latestMetric?.cpuFormatted || 'N/A'}</p>
              <Progress 
                value={latestMetric?.cpu || 0} 
                className={`h-2 ${latestMetric?.cpu > 80 ? 'bg-red-500' : ''}`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Network Traffic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-2">
              <div>
                <p className="text-2xl font-bold">{latestMetric?.networkSentFormatted || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">Sent</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{latestMetric?.networkReceivedFormatted || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">Received</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Disk I/O</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-2">
              <p className="text-2xl font-bold">{latestMetric?.diskIOFormatted || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">Total I/O Rate</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Disk Space</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-2">
              <p className="text-2xl font-bold">
                {latestMetric ? `${((latestMetric.diskSpaceUsed / latestMetric.diskSpaceTotal) * 100).toFixed(1)}%` : 'N/A'}
              </p>
              <Progress 
                value={latestMetric ? (latestMetric.diskSpaceUsed / latestMetric.diskSpaceTotal) * 100 : 0} 
                className={`h-2 ${latestMetric && (latestMetric.diskSpaceUsed / latestMetric.diskSpaceTotal) > 0.8 ? 'bg-red-500' : ''}`}
              />
              <p className="text-sm text-muted-foreground">
                {latestMetric?.diskSpaceUsedFormatted} / {latestMetric?.diskSpaceTotalFormatted}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>CPU Utilization</CardTitle>
            <CardDescription>Last 8 hours</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis 
                  label={{ value: '%', position: 'insideLeft' }} 
                  domain={[0, 100]}
                />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Line 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="#3b82f6" 
                  name="CPU %" 
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network Traffic</CardTitle>
            <CardDescription>Last 8 hours</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis 
                  label={{ value: 'MB/s', position: 'insideLeft' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value) => `${Number(value).toFixed(2)} MB/s`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="networkSentMB" 
                  stroke="#10b981" 
                  name="Sent" 
                  dot={false}
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="networkReceivedMB" 
                  stroke="#3b82f6" 
                  name="Received" 
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Disk I/O</CardTitle>
            <CardDescription>Last 8 hours</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis 
                  label={{ value: 'MB/s', position: 'insideLeft' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value) => `${Number(value).toFixed(2)} MB/s`}
                />
                <Line 
                  type="monotone" 
                  dataKey="diskIOMB" 
                  stroke="#a855f7" 
                  name="Disk I/O" 
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Disk Space Usage</CardTitle>
            <CardDescription>Last 8 hours</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis 
                  label={{ value: '%', position: 'insideLeft' }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  formatter={(value: number) => {
                    const percentage = Number(value).toFixed(1);
                    return [`${percentage}%`, 'Usage'];
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey={(data) => data.diskSpaceUsed / data.diskSpaceTotal * 100}
                  stroke="#a855f7" 
                  name="Usage" 
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 