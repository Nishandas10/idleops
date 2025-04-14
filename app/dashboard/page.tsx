'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Instance {
  id: string;
  name: string;
  zone: string;
  status: string;
  machineType: string;
}

export default function Dashboard() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user preferences and VM instances
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // In a real app, fetch the user's selected GCP project from your backend
        // For demo, we'll use mock data
        
        // Simulate API call to get user preferences
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock user preferences
        const mockUserPreferences = {
          gcpProjectId: 'mock-project-id',
          hasGcpToken: true
        };
        
        setSelectedProject(mockUserPreferences.gcpProjectId);
        
        if (mockUserPreferences.hasGcpToken) {
          // Simulate API call to get instances
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Mock VM instances data
          const mockInstances: Instance[] = [
            {
              id: '1234567890',
              name: 'instance-1',
              zone: 'us-central1-a',
              status: 'RUNNING',
              machineType: 'e2-medium'
            },
            {
              id: '0987654321',
              name: 'instance-2',
              zone: 'us-central1-b',
              status: 'STOPPED',
              machineType: 'e2-standard-2'
            },
            {
              id: '5678901234',
              name: 'instance-3',
              zone: 'us-central1-c',
              status: 'RUNNING',
              machineType: 'e2-small'
            }
          ];
          
          setInstances(mockInstances);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    let bgColor = '';
    let textColor = '';
    
    switch (status.toUpperCase()) {
      case 'RUNNING':
        bgColor = 'bg-green-100';
        textColor = 'text-green-800';
        break;
      case 'STOPPED':
        bgColor = 'bg-red-100';
        textColor = 'text-red-800';
        break;
      case 'TERMINATED':
        bgColor = 'bg-gray-100';
        textColor = 'text-gray-800';
        break;
      default:
        bgColor = 'bg-yellow-100';
        textColor = 'text-yellow-800';
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
        {status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
        <div className="mt-6 text-center">
          <Link href="/onboarding" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No VM instances found</h3>
          <p className="mt-1 text-sm text-gray-500">
            It looks like you don't have any VM instances in your selected project.
          </p>
          <div className="mt-6">
            <Link href="/onboarding" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Connect another GCP Project
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Dashboard</h2>
          {selectedProject && (
            <p className="mt-1 text-sm text-gray-500">
              Project: {selectedProject}
            </p>
          )}
        </div>
        <div className="mt-4 md:mt-0 md:ml-4 flex gap-2">
          <Link href="/onboarding" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Change Project
          </Link>
          <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Refresh Data
          </button>
        </div>
      </div>

      {/* Instance summary cards */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Instances</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{instances.length}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Running Instances</dt>
            <dd className="mt-1 text-3xl font-semibold text-green-600">
              {instances.filter(i => i.status.toUpperCase() === 'RUNNING').length}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Stopped Instances</dt>
            <dd className="mt-1 text-3xl font-semibold text-red-600">
              {instances.filter(i => i.status.toUpperCase() === 'STOPPED').length}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Other Status</dt>
            <dd className="mt-1 text-3xl font-semibold text-yellow-600">
              {instances.filter(i => !['RUNNING', 'STOPPED'].includes(i.status.toUpperCase())).length}
            </dd>
          </div>
        </div>
      </div>

      {/* VM instances table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">VM Instances</h3>
          <p className="mt-1 text-sm text-gray-500">
            A list of all the VM instances in your GCP project.
          </p>
        </div>
        <ul className="divide-y divide-gray-200">
          {instances.map((instance) => (
            <li key={instance.id}>
              <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-blue-100 text-blue-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{instance.name}</div>
                      <div className="text-sm text-gray-500">ID: {instance.id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500 text-right">
                      <div>Zone: {instance.zone}</div>
                      <div>Type: {instance.machineType}</div>
                    </div>
                    <StatusBadge status={instance.status} />
                    <div>
                      <button className="inline-flex items-center p-1.5 border border-transparent rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
