import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

const TABLES: { name: string; columns: string; order?: string }[] = [
  { name: 'role_definitions', columns: '*' },
  { name: 'clients', columns: '*' },
  { name: 'client_franchises', columns: '*' },
  { name: 'client_companies', columns: '*' },
  { name: 'customers', columns: '*' },
  { name: 'customer_contacts', columns: '*' },
  { name: 'customer_addresses', columns: '*' },
  { name: 'projects', columns: '*' },
  { name: 'project_notes', columns: '*' },
  { name: 'project_steps', columns: '*' },
  { name: 'stage_transitions', columns: '*' },
  { name: 'documents', columns: 'id, project_id, doc_type, version, status, dropbox_path, dropbox_file_id, dropbox_rev, file_name, cat_group, step_key, prod_type, created_at, updated_at' },
  { name: 'suppliers', columns: '*' },
  { name: 'supplier_invoices', columns: '*' },
  { name: 'supplier_payments', columns: '*' },
  { name: 'trust_expenses', columns: '*' },
  { name: 'production_items', columns: '*' },
  { name: 'containers', columns: '*' },
  { name: 'container_items', columns: '*' },
  { name: 'delivery_plans', columns: '*' },
  { name: 'punch_list_items', columns: '*' },
  { name: 'sales_design_jobs', columns: '*' },
  { name: 'sales_design_versions', columns: '*' },
  { name: 'lead_intake', columns: '*' },
  { name: 'project_handovers', columns: '*' },
];

export async function GET() {
  const { user, admin, deny } = await requireRole(['general_manager']);
  if (deny) return deny;

  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number | string> = {};
  for (const t of TABLES) {
    const res = await admin.from(t.name).select(t.columns).limit(50000);
    if (res.error) { counts[t.name] = `error: ${res.error.message}`; data[t.name] = []; continue; }
    data[t.name] = res.data ?? [];
    counts[t.name] = (res.data ?? []).length;
  }

  const snapshot = {
    manifest: {
      generatedAt: new Date().toISOString(),
      generatedBy: user.id,
      schemaVersion: '061',
      note: 'Core operational snapshot. Documents = metadata only; file bytes live in the immutable Dropbox store. Not a substitute for Supabase PITR — see BACKUP_RESTORE.md.',
      counts,
    },
    tables: data,
  };

  await logAudit({ actorId: user.id, action: 'admin.backup_downloaded', resource: `snapshot ${new Date().toISOString().slice(0, 10)}` });

  const filename = `trustlines-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
