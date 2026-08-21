import { applySignaturesToDocument } from '@/lib/pdf/signPdf';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resetCategoryPfs(admin: any, projectId: string, catGroup: string): Promise<number> {
  const { data: pfs } = await admin.from('documents')
    .select('id, status')
    .eq('project_id', projectId).eq('doc_type', 'pf').eq('cat_group', catGroup) as {
      data: { id: string; status: string }[] | null;
    };
  if (!pfs?.length) return 0;

  let n = 0;
  for (const pf of pfs) {
    const { data: apprs } = await admin.from('document_approvals')
      .select('status').eq('document_id', pf.id).eq('project_id', projectId) as { data: { status: string }[] | null };
    const hadApprovals = (apprs ?? []).length > 0;
    const hadSigned    = (apprs ?? []).some(a => a.status === 'approved');

    if (!hadApprovals && pf.status === 'draft') continue;

    await admin.from('document_approvals').delete().eq('document_id', pf.id).eq('project_id', projectId);

    const upd = await admin.from('documents').update({ status: 'draft', pf_signatures: [] }).eq('id', pf.id) as { error: { message?: string } | null };
    if (upd.error && /column|schema cache/i.test(upd.error.message ?? '')) {
      await admin.from('documents').update({ status: 'draft' }).eq('id', pf.id);
    }

    if (hadSigned) {
      try { await applySignaturesToDocument({ documentId: pf.id, projectId, admin, clear: true }); }
      catch (e) { console.error('[resetCategoryPfs] clean render failed:', e); }
    }
    n++;
  }
  return n;
}
