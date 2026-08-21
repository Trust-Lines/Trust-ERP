import { Suspense } from 'react';
import { ProductionDashboard } from '@/components/demo/ProductionDashboard';

export default function ProductionDashboardDemoPage() {
  return (
    <Suspense fallback={null}>
      <ProductionDashboard />
    </Suspense>
  );
}
