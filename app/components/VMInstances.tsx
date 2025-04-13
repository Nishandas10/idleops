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
  autoHibernate: boolean;
}

type Environment = 'dev' | 'test' | 'production' | '';

interface LabelModalProps {
  instance: VMInstance;
  isOpen: boolean;
  onClose: () => void;
  onSave: (instanceId: string, environment: Environment) => void;
}

function LabelModal({ instance, isOpen, onClose, onSave }: LabelModalProps) {
  const [selectedEnv, setSelectedEnv] = useState<Environment>(instance.labels?.env as Environment);

  useEffect(() => {
    setSelectedEnv(instance.labels?.env as Environment);
  }, [instance.labels]);

  const handleSave = () => {
    onSave(instance.id, selectedEnv);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[400px]">
        <h2 className="text-xl font-bold mb-4">Set Environment for {instance.name}</h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Environment
          </label>
          <select
            value={selectedEnv || ''}
            onChange={(e) => setSelectedEnv(e.target.value as Environment)}
            className="w-full border rounded px-3 py-2 text-gray-700"
          >
            <option value="">Select Environment</option>
            <option value="dev">Development</option>
            <option value="test">Test</option>
            <option value="production">Production</option>
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VMInstances() {
  const router = useRouter();
  const [instances, setInstances] = useState<VMInstance[]>([]);
  const [filteredInstances, setFilteredInstances] = useState<VMInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ env: 'all' });
  const [selectedInstance, setSelectedInstance] = useState<VMInstance | null>(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  useEffect(() => {
    // Load saved environments and autoHibernate settings from localStorage
    const loadSavedSettings = () => {
      const savedEnvs = localStorage.getItem('instanceEnvironments');
      const savedHibernate = localStorage.getItem('instanceAutoHibernate');
      return {
        environments: savedEnvs ? JSON.parse(savedEnvs) : {},
        autoHibernate: savedHibernate ? JSON.parse(savedHibernate) : {}
      };
    };

    const savedSettings = loadSavedSettings();
    
    // Update instances with saved settings
    setInstances(prevInstances => 
      prevInstances.map(instance => ({
        ...instance,
        labels: {
          ...instance.labels,
          env: savedSettings.environments[instance.id] || instance.labels.env || ''
        },
        autoHibernate: savedSettings.autoHibernate[instance.id] || false
      }))
    );
  }, []);

  const fetchInstances = async () => {
    try {
      const response = await fetch('/api/instances');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      const data = await response.json();
      
      // Load saved settings from localStorage
      const savedEnvs = localStorage.getItem('instanceEnvironments');
      const savedHibernate = localStorage.getItem('instanceAutoHibernate');
      const savedInstanceEnvs = savedEnvs ? JSON.parse(savedEnvs) : {};
      const savedInstanceHibernate = savedHibernate ? JSON.parse(savedHibernate) : {};
      
      // Merge saved settings with fetched instances
      const instancesWithSettings = data.map((instance: VMInstance) => ({
        ...instance,
        labels: {
          ...instance.labels,
          env: savedInstanceEnvs[instance.id] || instance.labels.env || ''
        },
        autoHibernate: savedInstanceHibernate[instance.id] || false
      }));
      
      setInstances(instancesWithSettings);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch VM instances');
      setLoading(false);
    }
  };

  const handleSaveEnvironment = (instanceId: string, environment: Environment) => {
    // Update localStorage
    const savedEnvs = localStorage.getItem('instanceEnvironments');
    const savedInstanceEnvs = savedEnvs ? JSON.parse(savedEnvs) : {};
    savedInstanceEnvs[instanceId] = environment;
    localStorage.setItem('instanceEnvironments', JSON.stringify(savedInstanceEnvs));

    // Update instances state
    setInstances(prevInstances =>
      prevInstances.map(instance =>
        instance.id === instanceId
          ? {
              ...instance,
              labels: {
                ...instance.labels,
                env: environment
              }
            }
          : instance
      )
    );
  };

  const handleAutoHibernateToggle = (instanceId: string) => {
    // Update localStorage
    const savedHibernate = localStorage.getItem('instanceAutoHibernate');
    const savedInstanceHibernate = savedHibernate ? JSON.parse(savedHibernate) : {};
    savedInstanceHibernate[instanceId] = !savedInstanceHibernate[instanceId];
    localStorage.setItem('instanceAutoHibernate', JSON.stringify(savedInstanceHibernate));

    // Update instances state
    setInstances(prevInstances =>
      prevInstances.map(instance =>
        instance.id === instanceId
          ? {
              ...instance,
              autoHibernate: !instance.autoHibernate
            }
          : instance
      )
    );
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
          <option value="production">Production</option>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Auto Hibernate</th>
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
                      <InstanceStatus 
                        instanceId={instance.id} 
                        instanceName={instance.name}
                        zone={instance.zone}
                        onError={setError}
                      />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center">
                    <button
                      onClick={() => handleAutoHibernateToggle(instance.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        instance.autoHibernate ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          instance.autoHibernate ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="ml-2 text-sm text-gray-600">
                      {instance.autoHibernate ? 'On' : 'Off'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-black">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      instance.labels.env === 'production' ? 'bg-red-100 text-red-800' :
                      instance.labels.env === 'test' ? 'bg-yellow-100 text-yellow-800' :
                      instance.labels.env === 'dev' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {instance.labels.env || 'Not Set'}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedInstance(instance);
                        setIsLabelModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      Edit
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => router.push(`/monitoring?instanceId=${instance.id}&instanceName=${encodeURIComponent(instance.name)}`)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View Metrics →
                    </button>
                    {instance.status === 'RUNNING' ? (
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/instances/stop`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                instanceId: instance.id,
                                zone: instance.zone,
                              }),
                            });
                            
                            if (!response.ok) {
                              throw new Error('Failed to stop instance');
                            }
                            
                            // Refresh the instances list
                            fetchInstances();
                          } catch (error) {
                            console.error('Error stopping instance:', error);
                            setError('Failed to stop instance. Please try again.');
                          }
                        }}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                      >
                        Stop
                      </button>
                    ) : instance.status === 'TERMINATED' ? (
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/instances/start`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                instanceId: instance.id,
                                zone: instance.zone,
                              }),
                            });
                            
                            if (!response.ok) {
                              throw new Error('Failed to start instance');
                            }
                            
                            // Refresh the instances list
                            fetchInstances();
                          } catch (error) {
                            console.error('Error starting instance:', error);
                            setError('Failed to start instance. Please try again.');
                          }
                        }}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                      >
                        Start
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedInstance && (
        <LabelModal
          instance={selectedInstance}
          isOpen={isLabelModalOpen}
          onClose={() => {
            setIsLabelModalOpen(false);
            setSelectedInstance(null);
          }}
          onSave={handleSaveEnvironment}
        />
      )}
    </div>
  );
} 