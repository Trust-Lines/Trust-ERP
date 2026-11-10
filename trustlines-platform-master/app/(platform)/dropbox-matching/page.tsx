import { requirePage } from '@/lib/permissions/requirePage';
import { DropboxMatchingClient } from '@/components/platform/dropbox/DropboxMatchingClient';

// Admin: link each project to its folder on the connected Dropbox (same access as the Dropbox Wizard).
export default async function DropboxMatchingPage() {
  await requirePage('page.dropbox_wizard');
  return (
    <div className="main-inner">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Dropbox Matching</h1>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
          Which Dropbox folder belongs to which project. Linking changes only the project&apos;s stored path — nothing in Dropbox is moved or renamed.
        </p>
      </div>
      <DropboxMatchingClient />
    </div>
  );
}
