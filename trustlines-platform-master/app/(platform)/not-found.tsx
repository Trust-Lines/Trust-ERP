import { ErrorStatusPage } from '@/components/platform/shared/ErrorStatusPage';

export default function PlatformNotFound() {
  return <ErrorStatusPage code={404} />;
}
