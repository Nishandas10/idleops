'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { InstanceStatus } from '@/components/ui/instance-status';

interface VMInstance {
  id: string;
  name: string;
  zone: string;
  status: string;
  labels: Record<string, string>;
}

export default function VMInstances() {
  const router = useRouter();
  const [instances, setInstances] = useState<VMInstance[]>([]);
  const [filteredInstances, setFilteredInstances] = useState<VMInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ env: 'all' });

  const fetchInstances = async () => {
    try {
      const response = await fetch('/api/instances');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      const data = await response.json();
      setInstances(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch VM instances');
      setLoading(false);
    }
  };

  const filterInstances = useCallback(() => {
    if (filter.env === 'all') {
      setFilteredInstances(instances);
      return;
    }

    const filtered = instances.filter(instance => 
      instance.labels.env === filter.env
    );
    setFilteredInstances(filtered);
  }, [filter.env, instances]);

  useEffect(() => {
    fetchInstances();
  }, []);

  useEffect(() => {
    filterInstances();
  }, [filterInstances]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded-lg">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-black">GCP VM Instances</h1>
      
      <div className="mb-6">
        <label className="mr-2 text-black font-medium">Filter by Environment:</label>
        <select 
          className="border rounded p-2 text-black bg-white"
          value={filter.env}
          onChange={(e) => setFilter({ env: e.target.value })}
        >
          <option value="all">All</option>
          <option value="dev">Development</option>
          <option value="test">Test</option>
          <option value="prod">Production</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Instance ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Zone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Environment</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredInstances.map((instance) => (
              <tr 
                key={instance.id} 
                className="hover:bg-gray-50"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{instance.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{instance.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{instance.zone}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex flex-col gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      instance.status === 'RUNNING' ? 'bg-green-100 text-green-800' :
                      instance.status === 'STOPPED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {instance.status}
                    </span>
                    {instance.status === 'RUNNING' && (
                      <InstanceStatus instanceId={instance.id} instanceName={instance.name} />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{instance.labels.env || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => router.push(`/monitoring?instanceId=${instance.id}&instanceName=${encodeURIComponent(instance.name)}`)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View Metrics →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 