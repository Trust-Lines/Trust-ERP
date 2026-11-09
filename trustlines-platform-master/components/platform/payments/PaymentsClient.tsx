'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Search, WalletCards } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import {
  buildSectionsFromProjects,
  mapSignStatus,
  mapStatus,
  mapType,
  vendorText,
  type PItem,
  type PProject,
} from '@/lib/excel/projectsExcelExport';
import styles from './PaymentsClient.module.css';

const TABS = ['Projects', 'Direct Orders', 'Missing Extra'] as const;
type Tab = (typeof TABS)[number];
type BoardPayload = { projects?: PProject[]; directOrders?: PProject[]; missingExtra?: PProject[] };

const mainColumns = [
  'Type', 'PF Code', 'Vendor', 'Order Type', 'PO Status', 'PF Sign Status', 'Status',
  'STD', 'ETD', 'RTR', 'RTD', 'RDY', 'FTD', 'SND', 'PF/USD', 'PF/TL', 'INV/USD',
  'INV/TL', 'Payment Rule', 'Container#', 'Container Date',
];

const dateKeys: (keyof PItem)[] = ['std', 'etd', 'rtr', 'rtd', 'rdy', 'ftd', 'snd'];

function money(value: string | number | null | undefined, currency: 'USD' | 'TL') {
  return `${currency === 'USD' ? '$' : '₺'} ${Number(value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-US');
}

function statusTone(value: string | null | undefined) {
  const normalized = String(value ?? '').toUpperCase();
  if (normalized.includes('SIGNED') && !normalized.includes('NOT')) return styles.success;
  if (normalized.includes('RECEIVED') || normalized.includes('READY')) return styles.warning;
  if (normalized.includes('NOT') || normalized.includes('HOLD')) return styles.danger;
  return styles.neutral;
}

function StatusChip({ children, raw }: { children: string; raw?: string | null }) {
  return <span className={`${styles.chip} ${statusTone(raw ?? children)}`}>{children || '—'}</span>;
}

function itemSearchText(project: PProject, item: PItem) {
  return [project.projectNo, project.projectName, item.type, item.pfCode, vendorText(item.vendor), item.containerNo]
    .join(' ')
    .toLowerCase();
}

function MainItem({ item }: { item: PItem }) {
  return (
    <div className={styles.mainItem}>
      <strong>{mapType(item.type) || '—'}</strong>
      <span>{item.pfCode || '—'}</span>
      <span title={vendorText(item.vendor)}>{vendorText(item.vendor) || '—'}</span>
      <span>{item.orderType || '—'}</span>
      <StatusChip raw={item.poSignStatus}>{mapSignStatus(item.poSignStatus) || '—'}</StatusChip>
      <StatusChip raw={item.pfSignStatus}>{mapSignStatus(item.pfSignStatus) || '—'}</StatusChip>
      <StatusChip raw={item.status}>{mapStatus(item.status) || '—'}</StatusChip>
      {dateKeys.map(key => <span key={key}>{shortDate(item[key] as string | null)}</span>)}
      <span className={styles.usd}>{money(item.pfUsd, 'USD')}</span>
      <span className={styles.tl}>{money(item.pfTl, 'TL')}</span>
      <span className={styles.usd}>{money(item.invoice, 'USD')}</span>
      <span className={styles.tl}>{money(item.invoiceTl, 'TL')}</span>
      <span>{item.paymentRule || '—'}</span>
      <span>{item.containerNo || '—'}</span>
      <span>{shortDate(item.containerDate)}</span>
    </div>
  );
}

function ScheduleItem({ item }: { item: PItem }) {
  return (
    <div className={styles.scheduleItem}>
      <span className={styles.usd}>{money(item.pfUsd, 'USD')}</span><span>{shortDate(item.std)}</span>
      <span className={styles.usd}>—</span><span>{shortDate(item.etd)}</span>
      <span className={styles.tl}>{money(item.pfTl, 'TL')}</span><span>{shortDate(item.rtd)}</span>
      <span className={styles.tl}>—</span><span>{shortDate(item.ftd)}</span>
      <span className={styles.usd}>—</span><span className={styles.tl}>—</span>
      <span className={styles.usd}>—</span><span className={styles.tl}>—</span>
    </div>
  );
}

function PaymentItem({ item }: { item: PItem }) {
  return (
    <div className={styles.paymentItem}>
      <span className={styles.usd}>{money(item.invoice, 'USD')}</span><span className={styles.tl}>{money(item.invoiceTl, 'TL')}</span>
      <span>—</span><span>—</span><span>—</span><span>—</span>
    </div>
  );
}

function InvoiceItem({ item }: { item: PItem }) {
  return (
    <div className={styles.invoiceItem}>
      <span>—</span><span>—</span><span className={styles.quickbook}>—</span><span>{shortDate(item.containerDate)}</span>
    </div>
  );
}

function ProjectGroup({ project, colorIndex }: { project: PProject; colorIndex: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const totals = useMemo(() => project.items.reduce((sum, item) => ({
    pfUsd: sum.pfUsd + Number(item.pfUsd ?? 0),
    pfTl: sum.pfTl + Number(item.pfTl ?? 0),
    invoice: sum.invoice + Number(item.invoice ?? 0),
    invoiceTl: sum.invoiceTl + Number(item.invoiceTl ?? 0),
  }), { pfUsd: 0, pfTl: 0, invoice: 0, invoiceTl: 0 }), [project.items]);

  return (
    <section className={styles.projectGroup}>
      <button type="button" className={styles.projectBar} onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed}>
        {collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
        <span><strong>{project.projectName || project.projectNo}</strong><small>{project.projectNo}</small></span>
      </button>
      {!collapsed && (
        <>
          <div className={styles.projectBody}>
            <div className={styles.projectNumber} data-color={String(colorIndex % 3)}>{project.projectNo}</div>
            <div className={styles.mainItems}>{project.items.map((item, index) => <MainItem key={`${item.type}-${index}`} item={item} />)}</div>
            <div className={styles.scheduleItems}>
              <div className={styles.subhead}><span>1st</span><span>2nd</span><span>1st</span><span>2nd</span><span>Remaining</span><span>Not Ordered</span></div>
              {project.items.map((item, index) => <ScheduleItem key={`${item.type}-${index}`} item={item} />)}
            </div>
            <div className={styles.paymentItems}>
              <div className={`${styles.subhead} ${styles.three}`}><span>Due Payment</span><span>Payments 1</span><span>Payments 2</span></div>
              {project.items.map((item, index) => <PaymentItem key={`${item.type}-${index}`} item={item} />)}
            </div>
            <div className={styles.invoiceItems}>
              <div className={`${styles.subhead} ${styles.one}`}><span>Invoices &amp; Receipts</span></div>
              {project.items.map((item, index) => <InvoiceItem key={`${item.type}-${index}`} item={item} />)}
            </div>
          </div>
          <div className={styles.projectTotals}>
            <div><strong>TOTAL</strong><span className={styles.usd}>{money(totals.pfUsd, 'USD')}</span><span className={styles.tl}>{money(totals.pfTl, 'TL')}</span><span className={styles.usd}>{money(totals.invoice, 'USD')}</span><span className={styles.tl}>{money(totals.invoiceTl, 'TL')}</span></div>
            <div><span className={styles.usd}>{money(totals.pfUsd, 'USD')}</span><span className={styles.tl}>{money(totals.pfTl, 'TL')}</span><span className={styles.usd}>—</span><span className={styles.tl}>—</span></div>
            <div><span className={styles.usd}>{money(totals.invoice, 'USD')}</span><span className={styles.tl}>{money(totals.invoiceTl, 'TL')}</span></div>
            <div />
          </div>
        </>
      )}
    </section>
  );
}

export function PaymentsClient() {
  const [payload, setPayload] = useState<BoardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Projects');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/production/board', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Payments data could not be loaded.');
        setPayload(await response.json() as BoardPayload);
      })
      .catch(reason => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Payments data could not be loaded.');
      });
    return () => controller.abort();
  }, []);

  const projects = useMemo(() => {
    const source = tab === 'Projects' ? payload?.projects : tab === 'Direct Orders' ? payload?.directOrders : payload?.missingExtra;
    const query = search.trim().toLowerCase();
    return (source ?? []).map(project => ({
      ...project,
      items: project.items.filter(item =>
        (!query || itemSearchText(project, item).includes(query))
        && (!type || mapType(item.type) === type)
        && (!status || mapStatus(item.status) === status),
      ),
    })).filter(project => project.items.length > 0);
  }, [payload, search, status, tab, type]);

  const sections = useMemo(() => buildSectionsFromProjects(projects), [projects]);
  const allItems = useMemo(() => (payload?.projects ?? []).flatMap(project => project.items), [payload]);
  const types = useMemo(() => [...new Set(allItems.map(item => mapType(item.type)).filter(Boolean))].sort(), [allItems]);
  const statuses = useMemo(() => [...new Set(allItems.map(item => mapStatus(item.status)).filter(Boolean))].sort(), [allItems]);

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <small>Finance/ Payments</small>
        <h1>Payments</h1>
        <p>{payload ? `${projects.length} projects` : '- · -'}</p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Payment views">
        {TABS.map(item => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}
      </div>

      <div className={styles.controls}>
        <label className={styles.search}><Search size={16} aria-hidden /><input aria-label="Search projects" placeholder="Search project…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label className={styles.select}><span className="sr-only">Filter by type</span><select value={type} onChange={event => setType(event.target.value)}><option value="">Type</option>{types.map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
        <label className={styles.select}><span className="sr-only">Filter by status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="">Status</option>{statuses.map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
        {['Container', 'QuickBook', 'Payment', 'Half'].map(label => <button type="button" className={styles.filter} key={label}>{label}<ChevronDown size={14} /></button>)}
      </div>

      {error ? <div className={styles.message} role="alert">{error}</div> : payload === null ? (
        <div className={styles.loading}><Loader2 className="animate-spin" size={24} /><span>Loading payments…</span></div>
      ) : sections.every(section => section.projects.length === 0) ? (
        <EmptyState icon={<WalletCards />} title="No payment projects" description="Projects with production payment data will appear here." />
      ) : (
        <div className={styles.boardScroll}>
          <div className={styles.board}>
            <div className={`${styles.boardHead} ${styles.mainHead}`}><span>Project #</span>{mainColumns.map(column => <span key={column}>{column}</span>)}</div>
            <div className={`${styles.boardHead} ${styles.scheduleHead}`}>{['Paid/USD','Date','Paid/USD','Date','Paid/TL','Date','Paid/TL','Date','USD','TL','USD','TL'].map((column, index) => <span key={`${column}-${index}`}>{column}</span>)}</div>
            <div className={`${styles.boardHead} ${styles.paymentsHead}`}>{['USD','TL','USD','TL','USD','TL'].map((column, index) => <span key={`${column}-${index}`}>{column}</span>)}</div>
            <div className={`${styles.boardHead} ${styles.invoiceHead}`}>{['Transaction #','Invoice #','Quickbook','Date'].map(column => <span key={column}>{column}</span>)}</div>
            <div className={styles.boardBody}>{sections.filter(section => section.projects.length > 0).map(section => (
              <section key={section.label} className={styles.section}>
                <div className={styles.sectionBar}><ChevronDown size={18} />{section.label}</div>
                {section.projects.map((project, index) => <ProjectGroup key={`${section.label}-${project.projectNo}`} project={project} colorIndex={index} />)}
              </section>
            ))}</div>
          </div>
        </div>
      )}
    </div>
  );
}
