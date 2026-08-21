import { Suspense } from 'react';
import { PipelineDashboard } from '@/components/demo/PipelineDashboard';

export default function PipelineDashboardDemoPage() {
  return (
    <Suspense fallback={null}>
      <PipelineDashboard />
    </Suspense>
  );
}
