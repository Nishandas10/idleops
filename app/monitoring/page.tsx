'use client';

import { useSearchParams } from 'next/navigation';
import MonitoringDashboard from '../components/MonitoringDashboard';
import InstanceDashboard from '../components/InstanceDashboard';

export default function MonitoringPage() {
  const searchParams = useSearchParams();
  const selectedInstanceId = searchParams.get('instanceId');
  const selectedInstanceName = searchParams.get('instanceName');

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {selectedInstanceId && selectedInstanceName ? (
          <InstanceDashboard
            instanceId={selectedInstanceId}
            instanceName={selectedInstanceName}
          />
        ) : (
          <MonitoringDashboard />
        )}
      </div>
    </main>
  );
} 