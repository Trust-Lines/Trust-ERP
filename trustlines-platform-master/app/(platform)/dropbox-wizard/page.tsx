import { DropboxWizard } from '@/components/platform/dropbox/DropboxWizard';
import { requirePage } from '@/lib/permissions/requirePage';

export default async function DropboxWizardPage() {
  await requirePage('page.dropbox_wizard');
  return (
    <div className="main-inner">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>
          Dropbox Folder Wizard
        </h1>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
          7-step setup to create or locate a project folder on Dropbox
        </p>
      </div>
      <DropboxWizard />
    </div>
  );
}
