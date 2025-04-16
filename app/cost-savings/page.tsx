'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExclamationTriangleIcon, BellIcon, SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface VMCostData {
  instanceId: string;
  instanceName: string;
  machineType: string;
  status: string;
  vmStatus: 'active' | 'idle' | undefined;
  hourlyRate: number;
  monthlyCost: number;
  hoursIdle: number;
  idleHoursPerDay: number;
  estimatedDailySavings: number;
  potentialMonthlySavings: number;
  zone: string;
  autoHibernate: boolean;
  lastActive?: string;
  cpuUsage?: number;
  uptimeHours?: number;
}

interface CostSummary {
  totalMonthlyCost: number;
  totalIdleCost: number;
  potentialSavings: number;
  instanceDetails: VMCostData[];
  warning?: string;
}

export default function CostSavingsPage() {
  const [costData, setCostData] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataRefreshed, setDataRefreshed] = useState<Date | null>(null);

  const fetchCostData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cost-savings');
      if (!response.ok) {
        throw new Error('Failed to fetch cost data');
      }
      const data = await response.json();
      setCostData(data);
      setDataRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching cost data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostData();
  }, []);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(value);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive" className="mb-6">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <button
          onClick={fetchCostData}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Calculate savings percentage of total cost
  const savingsPercentage = costData ? costData.potentialSavings / costData.totalMonthlyCost : 0;
  
  // Calculate idle cost percentage
  const idleCostPercentage = costData ? costData.totalIdleCost / costData.totalMonthlyCost : 0;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-black">Cost Savings Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={fetchCostData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Refresh Data
          </button>
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {dataRefreshed && (
        <p className="text-sm text-gray-500 mb-6">
          Last updated: {dataRefreshed.toLocaleString()}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-700">Monthly Running Cost</CardTitle>
            <CardDescription>Total cost of all running instances</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-black">
              {costData ? formatCurrency(costData.totalMonthlyCost) : '$0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-700">Idle Cost</CardTitle>
            <CardDescription>Cost of instances in idle state</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-black">
              {costData ? formatCurrency(costData.totalIdleCost) : '$0.00'}
            </div>
            <div className="mt-2">
              <Progress
                value={idleCostPercentage * 100}
                className="h-2 bg-gray-200"
              />
              <p className="text-sm text-gray-500 mt-1">
                {formatPercentage(idleCostPercentage)} of total cost
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-700">Potential Savings</CardTitle>
            <CardDescription>With auto-hibernation enabled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {costData ? formatCurrency(costData.potentialSavings) : '$0.00'}
            </div>
            <div className="mt-2">
              <Progress
                value={savingsPercentage * 100}
                className="h-2 bg-gray-200"
              />
              <p className="text-sm text-gray-500 mt-1">
                {formatPercentage(savingsPercentage)} of total cost
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {costData && costData.potentialSavings > 0 && (
        <Alert className="mb-8 bg-amber-50 border-amber-200">
          <BellIcon className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-800">Savings Opportunity</AlertTitle>
          <AlertDescription className="text-amber-700">
            You could save {formatCurrency(8.25)} per month by enabling auto-hibernation 
            on your idle instances.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="all" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Instances</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0">
          <InstancesTable 
            instances={costData?.instanceDetails || []} 
            formatCurrency={formatCurrency} 
            formatDate={formatDate} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface InstancesTableProps {
  instances: VMCostData[];
  formatCurrency: (amount: number) => string;
  formatDate: (dateString: string) => string;
}

function InstancesTable({ instances, formatCurrency, formatDate }: InstancesTableProps) {
  if (instances.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No instances found matching the criteria.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instance</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Machine Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hourly Cost</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Cost</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Idle Hours</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daily Savings</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Potential Savings</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auto-Hibernate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {instances.map((instance) => (
            <tr key={instance.instanceId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{instance.instanceName}</div>
                <div className="text-sm text-gray-500">{instance.zone}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {instance.machineType}
                <div className="text-xs text-gray-400 mt-1">
                  {formatCurrency(instance.hourlyRate)}/hour
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    instance.status === 'RUNNING' ? 'bg-green-100 text-green-800' : 
                    instance.status === 'TERMINATED' ? 'bg-red-100 text-red-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {instance.status}
                  </span>
                  
                  {instance.status === 'RUNNING' && instance.vmStatus && (
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      instance.vmStatus === 'active' ? 'bg-blue-100 text-blue-800' : 
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {instance.vmStatus === 'active' ? 'Active' : 'Idle'}
                    </span>
                  )}

                  {instance.vmStatus === 'idle' && instance.lastActive && (
                    <div className="text-xs text-gray-500 mt-1">
                      Last active: {formatDate(instance.lastActive)}
                    </div>
                  )}
                  
                  {instance.uptimeHours && (
                    <div className="text-xs text-gray-500 mt-1">
                      Uptime: {Math.round(instance.uptimeHours)} hours
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatCurrency(instance.hourlyRate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatCurrency(instance.monthlyCost)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {instance.hoursIdle > 0 ? 
                  Math.round(instance.hoursIdle * 10) / 10 : 
                  '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className="text-green-600 font-medium">
                  {formatCurrency(instance.estimatedDailySavings)}/day
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {instance.potentialMonthlySavings > 0 ? (
                  <span className="text-green-600 font-medium">
                    {formatCurrency(instance.potentialMonthlySavings)}/month
                  </span>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  instance.autoHibernate ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {instance.autoHibernate ? 'Enabled' : 'Disabled'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 