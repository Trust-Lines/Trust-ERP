import { requirePage } from '@/lib/permissions/requirePage';
import { ItPhoneDetailClient } from '@/components/platform/it/ItPhoneDetailClient';

// IT → Phone number detail (Figma 966:40115). There is no company phone-line data source yet, so no
// line is loaded and the page shows placeholders only. When it exists: load the line here without
// its secrets (password, PIN, account number) and reveal those one at a time through an authorised,
// audited endpoint.
export default async function ItPhoneDetailPage(_props: { params: Promise<{ id: string }> }) {
  await requirePage('page.it');

  return <ItPhoneDetailClient line={null} />;
}
