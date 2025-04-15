'use client';

import { useState } from 'react';

interface Project {
  id: string;
  name: string;
  projectId: string;
  createTime?: string;
  labels?: Record<string, string>;
}

interface ProjectSelectionProps {
  projects: Project[];
  onSelect: (projectId: string) => void;
  isLoading: boolean;
}

export default function ProjectSelection({ projects, onSelect, isLoading }: ProjectSelectionProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter projects based on search query
  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    project.projectId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle project selection
  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  // Handle continue button click
  const handleContinue = () => {
    if (selectedProjectId) {
      onSelect(selectedProjectId);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold mb-4">Select a GCP Project</h2>
      <p className="mb-6 text-gray-600">
        Choose the Google Cloud project containing the VM instances you want to monitor.
      </p>

      {/* Search input */}
      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search projects..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Projects list */}
      <div className="mb-6 border border-gray-200 rounded-md overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center">
            <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-2 text-gray-600">Loading projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {projects.length === 0 
              ? "No projects found in your GCP account." 
              : "No projects match your search."}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
            {filteredProjects.map((project) => (
              <li key={project.projectId}>
                <button
                  onClick={() => handleProjectSelect(project.projectId)}
                  className={`w-full px-6 py-4 flex items-start text-left transition-colors ${
                    selectedProjectId === project.projectId
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="mr-3 mt-0.5">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      selectedProjectId === project.projectId
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedProjectId === project.projectId && (
                        <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium">{project.name}</h3>
                    <p className="text-sm text-gray-500">Project ID: {project.projectId}</p>
                    {project.createTime && (
                      <p className="text-xs text-gray-400 mt-1">
                        Created: {new Date(project.createTime).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Continue button */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={!selectedProjectId || isLoading}
          className="px-6 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
} 