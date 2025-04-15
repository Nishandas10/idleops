'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MonitoringDashboard from '../components/MonitoringDashboard';
import InstanceDashboard from '../components/InstanceDashboard';

// Create a client component for the monitoring content
function MonitoringContent() {
  const searchParams = useSearchParams();
  const selectedInstanceId = searchParams.get('instanceId');
  const selectedInstanceName = searchParams.get('instanceName');

  return selectedInstanceId && selectedInstanceName ? (
    <InstanceDashboard
      instanceId={selectedInstanceId}
      instanceName={selectedInstanceName}
    />
  ) : (
    <MonitoringDashboard />
  );
}

// Main page component with Suspense boundary
export default function MonitoringPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <Suspense fallback={<div>Loading...</div>}>
          <MonitoringContent />
        </Suspense>
      </div>
    </main>
  );
} 