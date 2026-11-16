import { requirePage } from '@/lib/permissions/requirePage';
import { ClickUpReviewClient } from '@/components/platform/clickup/ClickUpReviewClient';

// Admin: what the nightly ClickUp sync held back, and the decisions that let it in.
export default async function ClickUpReviewPage() {
  await requirePage('page.clickup_review');
  return (
    <div className="main-inner">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>ClickUp Review</h1>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
          ClickUp contacts the nightly sync held back because they look like someone already in the app, and the projects waiting for them. ClickUp itself is never changed.
        </p>
      </div>
      <ClickUpReviewClient />
    </div>
  );
}
