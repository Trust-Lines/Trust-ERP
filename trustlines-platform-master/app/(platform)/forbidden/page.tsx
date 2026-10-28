import { ErrorStatusPage } from '@/components/platform/shared/ErrorStatusPage';

export default function ForbiddenPage() {
  return <ErrorStatusPage code={403} />;
}
