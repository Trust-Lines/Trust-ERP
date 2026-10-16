import { notFound } from 'next/navigation';
import { UiShowcase } from '@/components/dev/UiShowcase';

// Developer-only page: every base component from components/ui, laid out like the Figma
// board (DAY 03 › Components) so the two can be compared side by side. Not shipped to production.
export default function DevUiPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <UiShowcase />;
}
