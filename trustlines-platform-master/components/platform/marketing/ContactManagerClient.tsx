'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { ProspectQuickView } from './ProspectQuickView';
import { Select } from '@/components/platform/shared/Select';
import { TagMultiSelect } from './TagMultiSelect';
import { REGIONS } from '@/lib/regions';
import { exportContactsWorkbook, type ContactExportRow } from '@/lib/excel/contactsExcelExport';

// Deliberately NOT the query-builder Contacts page (2026-09-23's restriction — no browsing
// without a criterion, campaign/survey/project-status filters). This is the one exception to
// that, by design (2026-09-28): shows every Contact, newest-added first, same as the old
// unrestricted Contacts list — so manually-tagged rows that don't fit any query-builder
// criterion (e.g. "HRA 2026") are always reachable — with name/source/region filters on top to
// narrow it, and those same filters feed the Excel export. Sends browseAll=1 on every request;
// app/api/marketing/prospects/route.ts is the only place that flag is honored.

interface Row extends ContactExportRow {
  id: string;
  main_email: string | null;
  main_phone: string | null;
  source_raw_label: string | null;
  source_label: string | null;
  state: string | null;
  region: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ContactManagerClient({ canEdit }: { canEdit: boolean }) {
  const [query, setQuery] = useState('');
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState('');
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    fetch('/api/marketing/prospects/source-options').then(r => r.json()).then(b => setSourceOptions(b.options ?? [])).catch(() => {});
  }, []);

  function buildParams(extra: Record<string, string>) {
    const params = new URLSearchParams({ browseAll: '1', ...extra });
    const name = query.trim();
    if (name) params.set('q', name);
    sourceFilters.forEach(s => params.append('source', s));
    if (regionFilter) params.set('region', regionFilter);
    return params;
  }

  async function load(nextPage: number) {
    setLoading(true);
    try {
      const params = buildParams({ page: String(nextPage), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/marketing/prospects?${params.toString()}`);
      const body = await res.json().catch(() => null);
      setRows(body?.prospects ?? []);
      setTotal(body?.total ?? 0);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; load(1); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, sourceFilters, regionFilter]);

  async function exportExcel() {
    setExporting(true);
    try {
      // export=1&detail=1: every field the card has, project name/number included — the API
      // itself fetches every matching row (capped at 5000), not just this page's 50.
      const params = buildParams({ export: '1', detail: '1' });
      const res = await fetch(`/api/marketing/prospects?${params.toString()}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) { toast.error(body?.error ?? 'Could not export.'); return; }
      const contacts = (body.contacts ?? []) as ContactExportRow[];
      if (contacts.length === 0) { toast.error('Nothing to export.'); return; }
      await exportContactsWorkbook(contacts);
      toast.success(`Exported ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}.`);
    } catch {
      toast.error('Could not export.');
    } finally {
      setExporting(false);
    }
  }

  const hasFilters = !!(query.trim() || sourceFilters.length > 0 || regionFilter);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Contact Manager</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {total.toLocaleString('en-US')} contact{total !== 1 ? 's' : ''} — newest added first.
          </p>
        </div>
        <button className="btn btn-primary" disabled={exporting || total === 0} onClick={exportExcel}>
          <FileSpreadsheet size={14} style={{ marginRight: 5 }} /> {exporting ? 'Exporting…' : 'Export to Excel'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', minWidth: 240, flex: '1 1 240px', maxWidth: 380 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)' }} />
          <input
            className="form-input" style={{ paddingLeft: 36, fontSize: 14, height: 40, width: '100%' }}
            placeholder="Search by name…" value={query} onChange={e => setQuery(e.target.value)}
            aria-label="Search Contacts by name"
          />
        </div>
        {/* Multi-select (2026-09-28, "birden fazla source seçebilsin") — same TagMultiSelect
            Contacts' filter bar uses. */}
        <div
          style={{
            minWidth: 170, maxWidth: 320, padding: '5px 8px', fontSize: 13,
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'white',
          }}
        >
          <TagMultiSelect values={sourceFilters} options={sourceOptions} onChange={setSourceFilters} placeholder="All sources" />
        </div>
        <Select className="form-input" style={{ maxWidth: 170, fontSize: 13 }} value={regionFilter} onChange={e => setRegionFilter(e.target.value)} aria-label="Filter by region">
          <option value="">All regions</option>
          {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </Select>
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQuery(''); setSourceFilters([]); setRegionFilter(''); }}>
            Clear filters
          </button>
        )}
        {loading && <Loader2 size={15} style={{ color: 'var(--fg-subtle)', animation: 'spin 1s linear infinite' }} />}
      </div>

      {total === 0 && !loading ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          <div>{hasFilters ? 'No contact matches your filters.' : 'No contacts yet.'}</div>
        </div></div>
      ) : (
        <>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 800 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Phone</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Source</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>State</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Added</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr
                    key={r.id} onClick={() => setQuickViewId(r.id)}
                    style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.display_name}</td>
                    <td style={{ padding: '10px 12px' }}>{r.main_email || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{r.main_phone || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{r.source_raw_label || r.source_label || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{r.state || '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--fg-subtle)' }}>{fmtDate(r.effective_created_at ?? r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, fontSize: 12.5, color: 'var(--fg-subtle)' }}>
              <span>Showing {from}–{to} of {total.toLocaleString('en-US')}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="btn btn-ghost btn-sm" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
                  <ChevronLeft size={14} /> Prev
                </button>
                <span>Page {page} of {totalPages}</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= totalPages || loading} onClick={() => load(page + 1)}>
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {quickViewId && <ProspectQuickView prospectId={quickViewId} onClose={() => setQuickViewId(null)} canEdit={canEdit} />}
    </>
  );
}
