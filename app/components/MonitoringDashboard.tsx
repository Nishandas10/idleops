'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InstanceDashboard from './InstanceDashboard';

interface MetricData {
  cpu: number;
  network: number;
  diskIO: number;
  timestamp: string;
  isHealthy: boolean;
  instanceId?: string;
  instanceName?: string;
}

interface ActiveInstance {
  id: string;
  name: string;
  lastActive: string;
}

interface MonitoringSummary {
  totalDataPoints: number;
  healthyDataPoints: number;
  monitoringPeriod: string;
  thresholds: {
    cpu: string;
    network: string;
    diskIO: string;
  };
  activeInstances: ActiveInstance[];
}

export default function MonitoringDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedInstanceId = searchParams.get('instanceId');
  const selectedInstanceName = searchParams.get('instanceName');
  
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);
        const response = await fetch('/api/monitoring');
        
        if (!response.ok) {
          throw new Error('Failed to fetch monitoring data');
        }
        
        const data = await response.json();
        setMetrics(data.metrics);
        setSummary(data.summary);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    }

    fetchMetrics();
    
    // Refresh data every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Format data for charts
  const formatChartData = (metrics: MetricData[]) => {
    return metrics.map(metric => ({
      ...metric,
      timestamp: new Date(metric.timestamp).toLocaleTimeString(),
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg">Loading monitoring data...</p>
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

  if (selectedInstanceId && selectedInstanceName) {
    return (
      <InstanceDashboard
        instanceId={selectedInstanceId}
        instanceName={selectedInstanceName}
      />
    );
  }

  const healthPercentage = summary 
    ? Math.round((summary.healthyDataPoints / Math.max(summary.totalDataPoints, 1)) * 100) 
    : 0;

  // Format time difference for lastActive
  const formatTimeDifference = (timestamp: string) => {
    const lastActive = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - lastActive.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Instance Monitoring Dashboard</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>CPU Utilization</CardTitle>
            <CardDescription>Threshold: {summary?.thresholds.cpu}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-2">
              <p className="text-2xl font-bold">
                {metrics.length > 0 ? `${metrics[metrics.length - 1].cpu.toFixed(2)}%` : 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground">
                Latest reading
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Health Status</CardTitle>
            <CardDescription>Instances below threshold</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{healthPercentage}%</span>
                <span className="text-sm">{summary?.healthyDataPoints} of {summary?.totalDataPoints}</span>
              </div>
              <Progress value={healthPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Monitoring Period</CardTitle>
            <CardDescription>Time range for metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary?.monitoringPeriod}</p>
            <p className="text-sm text-muted-foreground">
              {metrics.length > 0 
                ? `${new Date(metrics[0].timestamp).toLocaleString()} to ${new Date(metrics[metrics.length-1].timestamp).toLocaleString()}`
                : 'No data available'}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Active Instances */}
      {summary?.activeInstances && summary.activeInstances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Instances</CardTitle>
            <CardDescription>Click on an instance to view detailed metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instance ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Time Since Activity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.activeInstances.map((instance) => (
                    <TableRow 
                      key={instance.id}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <TableCell className="font-mono text-xs">{instance.id}</TableCell>
                      <TableCell>{instance.name}</TableCell>
                      <TableCell>{new Date(instance.lastActive).toLocaleString()}</TableCell>
                      <TableCell>{formatTimeDifference(instance.lastActive)}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => {
                            router.push(`/monitoring?instanceId=${instance.id}&instanceName=${encodeURIComponent(instance.name)}`);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          View Details →
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Charts Section */}
      <Card>
        <CardHeader>
          <CardTitle>Metrics Visualization</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="cpu">
            <TabsList className="mb-4">
              <TabsTrigger value="cpu">CPU</TabsTrigger>
              <TabsTrigger value="network">Network</TabsTrigger>
              <TabsTrigger value="disk">Disk I/O</TabsTrigger>
              <TabsTrigger value="all">All Metrics</TabsTrigger>
            </TabsList>
            
            <TabsContent value="cpu" className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formatChartData(metrics)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis label={{ value: '%', position: 'insideLeft' }} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="cpu" 
                    stroke="#3b82f6" 
                    name="CPU Utilization (%)" 
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="network" className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formatChartData(metrics)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis label={{ value: 'Bytes', position: 'insideLeft' }} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="network" 
                    stroke="#10b981" 
                    name="Network Bytes" 
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="disk" className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formatChartData(metrics)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis label={{ value: 'Bytes', position: 'insideLeft' }} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="diskIO" 
                    stroke="#a855f7" 
                    name="Disk I/O Bytes" 
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="all" className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formatChartData(metrics)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="cpu" 
                    stroke="#3b82f6" 
                    name="CPU (%)" 
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="network" 
                    stroke="#10b981" 
                    name="Network" 
                    dot={false}
                    yAxisId="right"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="diskIO" 
                    stroke="#a855f7" 
                    name="Disk I/O" 
                    dot={false}
                    yAxisId="right"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Detailed Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Instance</TableHead>
                  <TableHead>CPU (%)</TableHead>
                  <TableHead>Network (bytes)</TableHead>
                  <TableHead>Disk I/O (bytes)</TableHead>
                  <TableHead>Health Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.slice(-10).map((metric, i) => (
                  <TableRow key={i}>
                    <TableCell>{new Date(metric.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{metric.instanceName || 'N/A'}</TableCell>
                    <TableCell>{metric.cpu.toFixed(2)}%</TableCell>
                    <TableCell>{metric.network.toLocaleString()}</TableCell>
                    <TableCell>{metric.diskIO.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        metric.isHealthy 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {metric.isHealthy ? 'Healthy' : 'Unhealthy'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 