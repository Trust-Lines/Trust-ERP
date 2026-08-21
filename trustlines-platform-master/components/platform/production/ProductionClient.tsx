'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { OperationalBoard } from './OperationalBoard';
import { ExtraItemsPanel } from './ExtraItemsPanel';
import {
  buildSectionsFromProjects, exportProjectsWorkbook,
  type PProject, type PSection,
} from '@/lib/excel/projectsExcelExport';

const TABS = ['Projects', 'Direct Orders', 'Missing Extra'] as const;
type Tab = typeof TABS[number];

const PROJECT_TOTAL_RATE = 41.23;

type BoardData = Record<Tab, PProject[]>;
const EMPTY: BoardData = { 'Projects': [], 'Direct Orders': [], 'Missing Extra': [] };

export function ProductionClient({ canEdit = false }: { canEdit?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>('Projects');
  const [exporting, setExporting] = useState(false);
  const [data, setData]   = useState<BoardData | null>(null);

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/production/board', { cache: 'no-store' });
      const json = await res.json() as { projects?: PProject[]; directOrders?: PProject[]; missingExtra?: PProject[] };
      setData({
        'Projects':      json.projects     ?? [],
        'Direct Orders': json.directOrders ?? [],
        'Missing Extra': json.missingExtra ?? [],
      });
    } catch {
      setData(EMPTY);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [load]);

  const sectionsByTab = useMemo(() => ({
    'Projects':      buildSectionsFromProjects((data ?? EMPTY)['Projects']),
    'Direct Orders': buildSectionsFromProjects((data ?? EMPTY)['Direct Orders']),
    'Missing Extra': buildSectionsFromProjects((data ?? EMPTY)['Missing Extra']),
  } satisfies Record<Tab, PSection[]>), [data]);

  async function handleExport() {
    setExporting(true);
    try {
      await exportProjectsWorkbook({
        projects:     sectionsByTab['Projects'],
        directOrders: sectionsByTab['Direct Orders'],
        missingExtra: sectionsByTab['Missing Extra'],
        projectTotalRate: PROJECT_TOTAL_RATE,
      });
      toast.success('Excel exported — 4 sheets (Projects, Missing & Extra, Direct Orders, Project Total)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally { setExporting(false); }
  }

  const sections = sectionsByTab[activeTab];
  const projectCount = sections.reduce((n, s) => n + s.projects.length, 0);

  return (
    <div className="full-bleed-page" style={{ padding: '24px 32px', width: '100%', boxSizing: 'border-box' }}>
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Production</h1>
        <button
          className="btn btn-accent"
          onClick={handleExport}
          disabled={exporting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: exporting ? 0.7 : 1 }}
        >
          {exporting
            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <Download size={14} />}
          Export Excel
        </button>
      </div>

      <div className="tab-bar">
        {TABS.map(tab => {
          const count = sectionsByTab[tab].reduce((n, s) => n + s.projects.length, 0);
          return (
            <button
              key={tab}
              className={`tab-item${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {count > 0 && (
                <span style={{
                  marginLeft: 7, fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 99,
                  background: activeTab === tab ? 'var(--brand-teal)' : 'var(--bg-subtle)',
                  color: activeTab === tab ? 'white' : 'var(--fg-subtle)',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-body" style={{ padding: 14 }}>
          {data === null ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} />
            </div>
          ) : (
            <>
              {activeTab === 'Direct Orders' && (
                <ExtraItemsPanel source="direct_order" label="Direct Orders" canEdit={canEdit} onChanged={load} />
              )}
              {activeTab === 'Missing Extra' && (
                <ExtraItemsPanel source="missing_extra" label="Missing & Extra" canEdit={canEdit} onChanged={load} />
              )}
              <div style={{ fontSize: 12, color: 'var(--fg-faint)', marginBottom: 10 }}>
                {activeTab} · {projectCount} project{projectCount === 1 ? '' : 's'} across {sections.length} region{sections.length === 1 ? '' : 's'}
              </div>
              <OperationalBoard sections={sections} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
