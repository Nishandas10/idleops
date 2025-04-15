'use client';

import { useState } from 'react';
import ServiceAccountKeyUpload from '../../components/ServiceAccountKeyUpload';

interface Instance {
  id: string;
  name: string;
  zone: string;
  status: string;
  machineType?: string;
  labels?: Record<string, string>;
}

interface InstanceListProps {
  instances: Instance[];
  onComplete: (serviceAccountKeyUploaded: boolean) => void;
  isLoading: boolean;
  projectId: string;
}

export default function InstanceList({ instances, onComplete, isLoading, projectId }: InstanceListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Filter instances based on search query and status filter
  const filteredInstances = instances.filter(instance => {
    const matchesSearch = 
      instance.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instance.zone.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || instance.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  // Get unique instance statuses for filter dropdown
  const uniqueStatuses = Array.from(new Set(instances.map(instance => instance.status)));

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    let bgColor = '';
    let textColor = '';
    
    switch (status.toLowerCase()) {
      case 'running':
        bgColor = 'bg-green-100';
        textColor = 'text-green-800';
        break;
      case 'stopped':
        bgColor = 'bg-red-100';
        textColor = 'text-red-800';
        break;
      case 'terminated':
        bgColor = 'bg-gray-100';
        textColor = 'text-gray-800';
        break;
      case 'provisioning':
      case 'staging':
        bgColor = 'bg-blue-100';
        textColor = 'text-blue-800';
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

  // Handle upload events
  const handleUploadSuccess = () => {
    setUploadSuccess(true);
    setUploadError(null);
  };

  const handleUploadError = (error: string) => {
    setUploadError(error);
    setUploadSuccess(false);
  };

  // Continue button handler
  const handleComplete = () => {
    onComplete(uploadSuccess);
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold mb-4">Your VM Instances</h2>
      <p className="mb-6 text-gray-600">
        These are the VM instances in your selected GCP project. IdleOps will help you monitor and optimize these resources.
      </p>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Search input */}
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search instances..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <div>
          <select
            className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status.toLowerCase()}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Instances list */}
      <div className="mb-6 border border-gray-200 rounded-md overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center">
            <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-2 text-gray-600">Loading instances...</p>
          </div>
        ) : filteredInstances.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {instances.length === 0 
              ? "No VM instances found in the selected project." 
              : "No instances match your search criteria."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zone
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Machine Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInstances.map((instance) => (
                  <tr key={instance.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{instance.name}</div>
                      <div className="text-xs text-gray-500">ID: {instance.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{instance.zone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={instance.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {instance.machineType || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {!isLoading && instances.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-medium mb-2">Instance Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm text-gray-500">Total Instances</span>
              <p className="text-2xl font-semibold">{instances.length}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Running</span>
              <p className="text-2xl font-semibold">{instances.filter(i => i.status.toLowerCase() === 'running').length}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Stopped</span>
              <p className="text-2xl font-semibold">{instances.filter(i => i.status.toLowerCase() === 'stopped' || i.status.toLowerCase() === 'terminated').length}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Other Status</span>
              <p className="text-2xl font-semibold">{instances.filter(i => !['running', 'stopped', 'terminated'].includes(i.status.toLowerCase())).length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Service Account Key Upload */}
      <ServiceAccountKeyUpload 
        projectId={projectId}
        onUploadSuccess={handleUploadSuccess}
        onUploadError={handleUploadError}
        className="mb-6"
      />

      {/* Continue button */}
      <div className="flex justify-end">
        <button
          onClick={handleComplete}
          disabled={isLoading}
          className="px-6 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Complete Setup
        </button>
      </div>
    </div>
  );
} 