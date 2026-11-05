'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { STATUS_CHAIN } from '@/lib/production/board';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { PRODUCTION_ITEM_STATUS_TAG, statusLabel } from '@/lib/status/tags';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { ProjectSubpageHeader, type ProjectSubpage } from './ProjectSubpageHeader';
import type { ProjectStage } from '@/types/database';

const STATUSES = [...STATUS_CHAIN, 'HOLD_T', 'HOLD_PM', 'ASSEMBLY'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

interface Row {
  id: string; type: string; status: string; assigned_to: string | null; priority: string | null;
  start_date: string | null; target_date: string | null; vendor_id: string | null; pf_code: string | null;
  order_type: string | null; po_sign_status: string; pf_sign_status: string; pf_usd: number | null; pf_tl: number | null;
}
interface Person { id: string; full_name: string; role: string }
interface Vendor { id: string; code: string | null; name: string }
interface SalesFile { id: string; file_name: string; dropbox_path: string; created_at: string }

interface Props {
  projectId: string; projectCode: string; projectName: string; projectStage: ProjectStage | null;
  hiddenTabs: ProjectSubpage[]; canEdit: boolean;
  rows: Row[]; people: Person[]; vendors: Vendor[]; salesFiles: SalesFile[]; schemaError: string | null;
}

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toISODate = (d: Date | null) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
const parseISODate = (s: string | null) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const PRIORITY_TONE: Record<string, string> = {
  urgent: 'text-error-normal', high: 'text-warning-normal', medium: 'text-ui-body', low: 'text-ui-text-secondary',
};

// Figma "Project production types" (467:19723): one card per type (title + Vendor / PF / Budget chips,
// then a row of 42px fields), then "Sales design files". The frame's Delete / Reset to Draft / Export
// buttons have no action on this page, so they're left out.
const CARD = 'flex flex-col rounded-[8px] border border-ui-divider bg-ui-page-bg p-5';
const CARD_TITLE = 'm-0 text-[20px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading';
const CHIP = 'inline-flex h-[29px] items-center rounded-[6px] border border-[var(--color-secondary-700)] px-4 text-[13px] font-medium whitespace-nowrap text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading';
const INPUT = 'h-[42px] w-full rounded-[6px] border-ui-input-border bg-ui-input-bg px-3 text-[14px] tracking-[-0.308px] text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading';
const DATE_INPUT = cn(INPUT, 'flex-row-reverse justify-between [&_svg]:size-4');
const READ = 'flex min-h-[42px] items-center text-[14px] leading-[1.4] text-[var(--color-secondary-700)] dark:text-ui-heading';

export function ProjectTypesClient({
  projectId, projectCode, projectName, projectStage, hiddenTabs, canEdit, rows, people, vendors, salesFiles, schemaError,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const personName = (uid: string | null) => people.find(p => p.id === uid)?.full_name ?? '—';
  const vendorLabel = (vid: string | null) => { const v = vendors.find(x => x.id === vid); return v ? (v.code ?? v.name) : '-'; };

  async function patch(id: string, field: string, value: string | null) {
    setBusy(id + field);
    const res = await fetch(`/api/production/items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }),
    });
    setBusy(null);
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); return; }
    router.refresh();
  }

  const statusOptions = STATUSES.map(s => ({ value: s, label: s }));
  const ownerOptions = [{ value: '', label: '— unassigned —' }, ...people.map(p => ({ value: p.id, label: p.full_name }))];
  const priorityOptions = [{ value: '', label: '--' }, ...PRIORITIES.map(p => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))];

  return (
    <>
      <ProjectSubpageHeader projectId={projectId} code={projectCode} name={projectName} stage={projectStage} active="types" hidden={hiddenTabs} />

      {schemaError && (
        <div className="mb-4 rounded-[8px] border border-warning-normal bg-ui-page-bg p-3 text-[13px] text-ui-body">⚠️ {schemaError}</div>
      )}

      <div className="flex flex-col gap-[18px]">
        {rows.length === 0 ? (
          <div className={CARD}>
            <EmptyState size="sm" className="justify-center px-4 py-8" icon={<Layers />} title="No types on this project yet." description="Types are seeded from the project's categories on the production board." />
          </div>
        ) : rows.map(r => (
          <section key={r.id} className={cn(CARD, 'gap-8')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={CARD_TITLE}>{r.type}</h2>
              <div className="flex flex-wrap items-center justify-end gap-2 tabular-nums">
                <span className={CHIP}>Vendor: {vendorLabel(r.vendor_id)}</span>
                <span className={cn(CHIP, 'font-mono')}>PF: {r.pf_code ?? '-'}</span>
                <span className={CHIP}>Budget USD: $ {money(Number(r.pf_usd) || 0)}</span>
                <span className={CHIP}>Budget TL: ₺ {money(Number(r.pf_tl) || 0)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,1.06fr)_minmax(0,0.58fr)_minmax(0,1fr)_minmax(0,1fr)_149px]">
              <Field label="Sub-Status">
                {canEdit ? (
                  <Select aria-label="Sub-status" className={INPUT} options={statusOptions} value={r.status}
                    disabled={busy === r.id + 'status'} onValueChange={v => { if (v) void patch(r.id, 'status', v); }} />
                ) : <span className={READ}><StatusBadge group="production" status={PRODUCTION_ITEM_STATUS_TAG[r.status] ?? r.status} label={statusLabel(r.status)} /></span>}
              </Field>

              <Field label="Owner">
                {canEdit ? (
                  <Select aria-label="Owner" className={INPUT} options={ownerOptions} value={r.assigned_to ?? ''}
                    disabled={busy === r.id + 'assigned_to'} onValueChange={v => void patch(r.id, 'assigned_to', v || null)} />
                ) : <span className={READ}>{personName(r.assigned_to)}</span>}
              </Field>

              <Field label="Priority">
                {canEdit ? (
                  <Select aria-label="Priority" className={INPUT} options={priorityOptions} value={r.priority ?? ''}
                    disabled={busy === r.id + 'priority'} onValueChange={v => void patch(r.id, 'priority', v || null)} />
                ) : <span className={cn(READ, 'capitalize', PRIORITY_TONE[r.priority ?? ''])}>{r.priority ?? '—'}</span>}
              </Field>

              <Field label="Start Date">
                {canEdit ? (
                  <DatePicker aria-label="Start date" placeholder="No date" className={DATE_INPUT}
                    value={parseISODate(r.start_date)} onValueChange={d => void patch(r.id, 'start_date', toISODate(d))} />
                ) : <span className={READ}>{r.start_date ? formatDate(r.start_date) : '—'}</span>}
              </Field>

              <Field label="Target Date">
                {canEdit ? (
                  <DatePicker aria-label="Target date" placeholder="No date" className={DATE_INPUT}
                    value={parseISODate(r.target_date)} onValueChange={d => void patch(r.id, 'target_date', toISODate(d))} />
                ) : <span className={READ}>{r.target_date ? formatDate(r.target_date) : '—'}</span>}
              </Field>

              <Field label="PO / PF sign">
                <span className={cn(READ, 'break-all')}>{r.po_sign_status} / {r.pf_sign_status}</span>
              </Field>
            </div>
          </section>
        ))}

        <section className={cn(CARD, 'gap-4')}>
          <div className="flex flex-col gap-1">
            <h2 className={CARD_TITLE}>Sales design files</h2>
            <p className="m-0 text-[12px] leading-[1.4] text-ui-text-secondary">Design output uploaded during Sales Design — the input for Supply detailing.</p>
          </div>
          {salesFiles.length === 0 ? (
            <p className="m-0 text-[15px] font-medium leading-4 text-ui-body">No sales design files linked to this project.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {salesFiles.map(f => (
                <li key={f.id} className="flex min-h-[42px] flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[6px] border border-ui-divider px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-[var(--color-secondary-700)] dark:text-ui-heading">
                    <FileText size={16} aria-hidden className="shrink-0 text-ui-body" />
                    <span className="truncate">{f.file_name}</span>
                  </span>
                  <span className="min-w-0 truncate font-mono text-[11px] text-ui-text-secondary" title={f.dropbox_path}>{f.dropbox_path}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[7px]">
      <span className="text-[12px] font-medium leading-4 text-ui-body">{label}</span>
      {children}
    </div>
  );
}
