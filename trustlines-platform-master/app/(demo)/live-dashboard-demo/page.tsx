import { Suspense } from 'react';
import { LiveDashboard } from '@/components/demo/LiveDashboard';

export default function LiveDashboardDemoPage() {
  return (
    <Suspense fallback={null}>
      <LiveDashboard />
    </Suspense>
  );
}
