'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Archive, BriefcaseBusiness, CircleCheck, CircleDashed, CircleDotDashed, CircleX, Clock, CloudSync, ExternalLink, Gem, Loader2, Pause, Trash, X,
  type LucideIcon,
} from 'lucide-react';
import { Select as FilterSelect } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalPanel } from '@/components/ui/modal';
import { ToneChip } from '@/components/ui/tone-chip';
import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';
import { BoardTaskPanel } from './BoardTaskPanel';
import { projectNumber } from '@/lib/keyClients/match';
import { buildCardTabs, isShipped, type CardDeal, type CardPhase, type CardProject, type CardTab, type ChipTone } from '@/lib/dashboard/cardTabs';
import type { ProjectFinance } from '@/lib/finance/projectTotals';
import { typeLabel, type TrustItem } from '@/lib/trust/board';
import { STAGE_LABELS } from '@/lib/workflow/machine';
import type { ProjectStage } from '@/types/database';
import type { BoardCardItem, BoardSection } from './BranchBoard';
import { useRouter } from 'next/navigation';
import { SERVICE_LINES, serviceLineLabel } from '@/lib/regions';

// Design: Figma "TRUST-LINES ERP" → "Page content" (node 359:25337, new version 908:25017) — the
// popup a dashboard card opens. Under the heading: T Lines Tasks and Trust Lines Tasks. Left: one tab
// per stage the project has reached (lib/dashboard/cardTabs); middle: that stage's details.
// Potential / Opportunity / Project jump to that part of the list.

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const PHASES: { value: CardPhase; label: string; icon: LucideIcon }[] = [
  { value: 'potential', label: 'Potential', icon: Clock },
  { value: 'opportunity', label: 'Opportunity', icon: Gem },
  { value: 'project', label: 'Project', icon: BriefcaseBusiness },
];
// Status Chip icons by tone (Figma Status Language): idle, in progress, waiting, done, lost.
const TONE_ICON: Record<ChipTone, LucideIcon | 'in-review'> = { t0: CircleDashed, t2: CircleDotDashed, t7: 'in-review', t9: CircleCheck, t10: CircleX };

const notYet = () => toast.info('Not connected yet');

interface CardData { project: CardProject | null; deals: CardDeal[]; finance: ProjectFinance | null; allowed: string[] }

export function BoardItemView({ item, section, assignees, canEdit, companyEdit = 'none', staff = [], canEditTrustTasks = false, onClose }: {
  item: BoardCardItem;
  section: BoardSection;
  /** Set the card's company here: 'any' always, 'empty' only while it has none. */
  companyEdit?: 'any' | 'empty' | 'none';
  assignees: { id: string; full_name: string }[];
  canEdit: boolean;
  /** Who a Trust Lines task can be assigned to. */
  staff?: { id: string; full_name: string }[];
  /** Add / change Trust Lines tasks (the API checks it too). */
  canEditTrustTasks?: boolean;
  onClose: () => void;
}) {
  const [data, setData] = React.useState<CardData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [openDeal, setOpenDeal] = React.useState<CardDeal | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const kind = item.kind === 'opportunity' ? (item.assign?.kind === 'potential' ? 'potential' : 'opportunity') : item.kind;
    const qs = new URLSearchParams({ kind, id: item.id, ...(item.projectNo ? { no: item.projectNo } : {}) });
    fetch(`/api/tlines-dashboard/card?${qs}`)
      .then(async r => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error ?? 'Could not load this project'); return b as CardData; })
      .then(b => { if (!cancelled) setData(b); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load this project'); });
    return () => { cancelled = true; };
  }, [item]);

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tabs = React.useMemo(
    () => (data ? buildCardTabs({ deals: data.deals, project: data.project, trustItems: item.trustItems ?? null, finance: data.finance, today, allowed: data.allowed }) : []),
    [data, item.trustItems, today],
  );
  // Opens on the Opportunity: the card's own deal, else the latest Opportunity (then Potential),
  // else the furthest stage reached.
  const active = tabs.find(t => t.key === selected)
    ?? tabs.find(t => t.view === 'deal' && t.deal.id === item.id)
    ?? tabs.filter(t => t.phase === 'opportunity').at(-1)
    ?? tabs.filter(t => t.phase === 'potential').at(-1)
    ?? tabs.at(-1) ?? null;

  // The card's company (Store Maker / Premium / Design Build).
  const [company, setCompany] = React.useState<string | null>(item.company ?? null);
  const [savingCompany, setSavingCompany] = React.useState(false);
  const canSetCompany = companyEdit === 'any' || (companyEdit === 'empty' && !company);
  // The project number on top: the card's badge, or "#507" when the badge carries no number ("OP").
  const cardBadge = [item.badgeTop, item.badgeBottom].filter(Boolean).join(' ');
  const headBadge = item.projectNo && !/d/.test(cardBadge) ? `#${item.projectNo}` : cardBadge;
  const router = useRouter();
  async function saveCompany(value: string) {
    if (!value || value === company) return;
    setSavingCompany(true);
    try {
      const kind = item.kind === 'opportunity' ? (item.assign?.kind === 'potential' ? 'potential' : 'opportunity') : item.kind;
      const res = await fetch('/api/tlines-dashboard/company', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id: item.id, no: item.projectNo ?? null, serviceLine: value }),
      });
      const b = await res.json().catch(() => null);
      if (!res.ok) throw new Error(b?.error ?? 'Could not save the company');
      setCompany(value);
      toast.success(`Company set: ${serviceLineLabel(value)}`);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save the company'); }
    finally { setSavingCompany(false); }
  }
  // T Lines tasks live on the deal (lead_tasks): the card's own Opportunity / Potential, or for a
  // project card its latest Opportunity (else Potential). Same routes the deal quick view uses.
  const taskDeal = React.useMemo<{ kind: 'opportunity' | 'potential'; id: string } | null>(() => {
    if (item.kind === 'opportunity') return { kind: item.assign?.kind === 'potential' ? 'potential' : 'opportunity', id: item.id };
    const deals = data?.deals ?? [];
    const d = deals.filter(x => x.kind === 'opportunity').at(-1) ?? deals.filter(x => x.kind === 'potential').at(-1);
    return d ? { kind: d.kind, id: d.id } : null;
  }, [item, data]);
  // Trust Lines tasks (migration 153) hang on the project number, so every card of the project
  // shares them; a card without one keeps its own list (lib/board/trustTasks).
  const cardNo = item.projectNo ?? projectNumber(item.badgeTop);
  const trustTasksApi = `/api/tlines-dashboard/trust-tasks/${cardNo ? `no-${cardNo}` : `${item.kind}-${item.id}`}`;
  const tasksApi = taskDeal ? `/api/marketing/${taskDeal.kind === 'potential' ? 'potentials' : 'opportunities'}/${taskDeal.id}` : null;

  const pick = (phase: CardPhase) => {
    const t = phase === 'project' ? tabs.find(x => x.phase === 'project') : tabs.filter(x => x.phase === phase).at(-1);
    if (t) setSelected(t.key);
  };

  // The card's own stage tone: its tint, with the accent darkened for the text.
  const stageInk = `color-mix(in srgb, ${section.accent} 60%, black)`;

  return (
    // While a deal is open on top, Escape / clicks belong to that deal, not this panel.
    <ModalPanel
      onOpenChange={o => { if (!o && !openDeal) onClose(); }}
      aria-label={item.title}
      layerClassName="z-[10000]"
      containerClassName="px-4 py-[3vh]"
    >
      <div
        className="flex h-[94vh] w-[96vw] max-w-[1616px] flex-col gap-6 overflow-hidden rounded-[11px] bg-ui-page-bg p-8 shadow-04"
      >
        {/* ── Page heading ─────────────────────────────────────────── */}
        <div className="flex shrink-0 items-end justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-col">
              <div className="flex min-w-0 items-center gap-4">
                {headBadge && (
                  <span className="flex h-9 shrink-0 items-center rounded-[6px] px-2.5 text-[20px] font-semibold leading-none" style={{ background: section.bg, color: stageInk }}>
                    {headBadge}
                  </span>
                )}
                <h2 className={`m-0 truncate text-[28px] font-semibold leading-[1.35] ${HEADING}`}>{item.title}</h2>
                {item.onHold && <Chip tone="t0" icon={Pause}>On Hold</Chip>}
              </div>
              {item.category && <p className={`m-0 text-[14px] font-medium leading-[1.35] ${HEADING}`}>{item.category}</p>}
            </div>
            <span className="inline-flex h-[22px] w-fit items-center gap-2 rounded-[4px] px-2.5 text-[12px] font-medium leading-4" style={{ background: section.bg, color: stageInk }}>
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: stageInk }} aria-hidden />
              {section.label}
            </span>
            {item.subtitle && <p className="m-0 truncate text-[14px] leading-[1.35] text-ui-text-secondary">{item.subtitle}</p>}
            <div className="flex items-center gap-2 text-[13px] text-ui-body">
              <span className="font-medium text-ui-text-secondary">Company:</span>
              {canSetCompany ? (
                <FilterSelect
                  aria-label="Company"
                  options={[...(company ? [] : [{ value: '', label: 'Choose the company…' }]), ...SERVICE_LINES.map(s => ({ value: s.value, label: s.label }))]}
                  value={company ?? ''}
                  disabled={savingCompany}
                  onValueChange={v => void saveCompany(v ?? '')}
                  className={`h-8 w-[200px] text-[13px] ${company ? '' : 'border-[var(--status-t0-fg)]'}`}
                />
              ) : (
                <span className="font-semibold">{company ? serviceLineLabel(company) : 'Not set'}</span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end justify-between gap-6 self-stretch">
            <button type="button" aria-label="Close" onClick={onClose} className={`-m-1 flex size-10 items-center justify-center rounded-[6px] hover:bg-ui-hover-bg ${HEADING}`}>
              <X size={32} strokeWidth={1.5} aria-hidden />
            </button>
            <div className="flex flex-wrap items-center justify-end gap-4">
              <div className="flex items-center gap-2">
                {PHASES.map(p => {
                  const has = tabs.some(t => t.phase === p.value);
                  return (
                    <button
                      key={p.value} type="button" disabled={!has} aria-pressed={active?.phase === p.value} onClick={() => pick(p.value)}
                      className={`flex h-9 items-center gap-2 rounded-[6px] border border-solid pl-4 pr-[22px] text-[13px] font-semibold leading-[1.4] text-ui-body disabled:cursor-default disabled:opacity-50 ${active?.phase === p.value ? 'border-ui-input-border bg-ui-selected-bg' : 'border-ui-divider bg-ui-surface-elevated enabled:hover:bg-ui-hover-bg'}`}
                    >
                      <p.icon size={16} aria-hidden /> {p.label}
                    </button>
                  );
                })}
                {/* No stage dropdown: the stage list on the left picks the stage. */}
              </div>
              <span className="h-9 w-px bg-ui-divider" aria-hidden />
              <div className="flex items-center gap-2">
                <button type="button" onClick={notYet} className="flex h-10 items-center gap-2 rounded-[6px] border border-solid pl-5 pr-6 text-[13px] font-medium hover:brightness-95" style={{ background: 'var(--status-t10-bg)', borderColor: 'var(--status-t10-fg)', color: 'var(--status-t10-fg)' }}>
                  <Trash size={16} aria-hidden /> Delete
                </button>
                <button type="button" onClick={notYet} className={`flex h-10 items-center gap-2 rounded-[6px] border border-solid border-current pl-5 pr-6 text-[13px] font-medium hover:bg-ui-hover-bg ${HEADING}`}>
                  <CloudSync size={16} aria-hidden /> Back up
                </button>
                <button type="button" onClick={notYet} className="flex h-10 items-center gap-2 rounded-[6px] bg-[var(--color-secondary-700)] pl-5 pr-6 text-[13px] font-medium text-white hover:brightness-110">
                  <Archive size={16} aria-hidden /> Archive
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tasks (Figma 908:25017): T-Lines' deal tasks next to Trust Lines' own ─── */}
        <div className="flex shrink-0 flex-col gap-2.5 lg:flex-row lg:items-start">
          <BoardTaskPanel
            title="T Lines Tasks"
            apiBasePath={tasksApi}
            assignees={assignees}
            canEdit={canEdit}
            unavailable={data || error ? 'No Potential or Opportunity on this card yet — its tasks show here once there is one.' : 'Loading…'}
          />
          <BoardTaskPanel
            title="Trust Lines Tasks"
            apiBasePath={trustTasksApi}
            assignees={staff}
            canEdit={canEditTrustTasks}
            showDueDate
            unavailable="Loading…"
          />
        </div>

        {/* ── Body: stage tabs on the left, the selected stage's details ─── */}
        <div className="flex min-h-0 flex-1 gap-4">
          <div role="tablist" aria-orientation="vertical" className="flex w-[262px] shrink-0 flex-col gap-2 overflow-y-auto rounded-[10px] bg-ui-surface p-2">
            {!data && !error && <p className="m-0 flex items-center gap-2 p-3 text-[13px] text-ui-text-secondary"><Loader2 size={14} className="animate-spin" aria-hidden /> Loading…</p>}
            {data && tabs.length === 0 && <p className="m-0 p-3 text-[13px] text-ui-text-secondary">Nothing recorded for this project yet.</p>}
            {tabs.map(t => {
              const on = t.key === active?.key;
              return (
                <button
                  key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setSelected(t.key)}
                  className={`flex w-full flex-col gap-2 rounded-[6px] border border-solid px-5 py-3 text-left ${on ? 'border-ui-input-border bg-ui-page-bg shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'border-transparent bg-ui-page-bg hover:border-ui-divider'}`}
                >
                  <span className="flex w-full flex-col gap-[3px] leading-[1.4]">
                    <span className="text-[13px] font-semibold text-ui-body">{t.title}</span>
                    {t.sub && <span className="truncate text-[11px] text-ui-text-secondary">{t.sub}</span>}
                  </span>
                  <Chip tone={t.chip.tone}>{t.chip.label}</Chip>
                </button>
              );
            })}
          </div>
          <div role="tabpanel" className="min-w-0 flex-1 overflow-y-auto rounded-[8px] border border-solid border-ui-divider bg-ui-surface p-6">
            {error ? <p className="m-0 text-[13px] font-medium" style={{ color: 'var(--status-t10-fg)' }}>{error}</p>
              : active ? <Detail tab={active} project={data?.project ?? null} today={today} onOpenDeal={setOpenDeal} />
              : data && <EmptyState size="sm" icon={<CircleDashed />} title="No stages yet" description="Its Potential, Opportunity and project stages show up here as it moves along." />}
          </div>
        </div>
      </div>
      {openDeal && (
        <OpportunityQuickView opportunityId={openDeal.id} kind={openDeal.kind} assignees={assignees} canEdit={canEdit} onClose={() => setOpenDeal(null)} />
      )}
    </ModalPanel>
  );
}

/** Figma Status Chip: tone + icon + label (colour is never the only signal). */
function Chip({ tone, icon, children }: { tone: ChipTone; icon?: LucideIcon; children: React.ReactNode }) {
  const Icon = icon ?? TONE_ICON[tone];
  return (
    <ToneChip
      tone={tone}
      className="h-[22px] w-fit"
      icon={Icon === 'in-review'
        // Figma's own icon for this tone (Status Chip, In review), tinted with the tone's text colour.
        ? <span aria-hidden className="size-3.5 shrink-0 bg-current" style={{ mask: 'url(/icons/status-in-review.svg) center / contain no-repeat', WebkitMask: 'url(/icons/status-in-review.svg) center / contain no-repeat' }} />
        : Icon}
    >
      {children}
    </ToneChip>
  );
}

function Detail({ tab, project, today, onOpenDeal }: { tab: CardTab; project: CardProject | null; today: string; onOpenDeal: (d: CardDeal) => void }) {
  if (tab.view === 'deal') {
    const d = tab.deal;
    return (
      <Panel title={tab.title} action={<ActionButton onClick={() => onOpenDeal(d)}>Open {tab.title.toLowerCase()} <ExternalLink size={14} aria-hidden /></ActionButton>}>
        <Fields rows={[
          ['Name', d.title], ['Brand', d.brand], ['Project code', d.code], ['Stage', d.stageLabel ?? typeLabel(d.stage)],
          ['Owner', d.owner], ['Created', fmtDate(d.createdAt)], ['Next step', d.nextAction], ['Next step date', fmtDate(d.nextActionDate)],
          ['Due', fmtDate(d.dueDate)],
        ]} />
      </Panel>
    );
  }
  if (tab.view === 'finalization') {
    return (
      <Panel title="Finalization" action={project && <ActionLink href={`/projects/${project.id}`}>Open project <ExternalLink size={14} aria-hidden /></ActionLink>}>
        {project ? (
          <Fields rows={[
            ['Project', `${project.code} — ${project.name}`], ['Stage', STAGE_LABELS[project.currentStage as ProjectStage] ?? project.currentStage],
            ['Site', project.site], ['Closed deal', fmtDate(project.closedDealDate)], ['Est. delivery', fmtDate(project.estDeliveryDate)],
          ]} />
        ) : <p className="m-0 text-[13px] text-ui-text-secondary">In the Trust System — not opened as a project here yet.</p>}
      </Panel>
    );
  }
  if (tab.view === 'items') return <ItemsTable tab={tab} today={today} />;
  return <FinanceDetail finance={tab.finance} />;
}

function ItemsTable({ tab, today }: { tab: Extract<CardTab, { view: 'items' }>; today: string }) {
  const cols: { label: string; cell: (i: TrustItem) => React.ReactNode }[] =
    tab.key === 'po_pf' ? [
      { label: 'PF code', cell: i => i.pfCode || '—' },
      { label: 'PF signed', cell: i => typeLabel(i.pfSignStatus ?? null) ?? '—' },
      { label: 'PO signed', cell: i => typeLabel(i.poSignStatus ?? null) ?? '—' },
    ] : tab.key === 'production' ? [
      { label: 'Production status', cell: i => typeLabel(i.status) ?? '—' },
    ] : [
      { label: 'Container', cell: i => i.containerNo || '—' },
      { label: 'Container date', cell: i => fmtDate(i.containerDate) },
      { label: 'Shipped', cell: i => (isShipped(i, today) ? 'Yes' : i.containerNo ? 'Not yet' : '—') },
    ];
  return (
    <Panel title={tab.title}>
      <div className="overflow-x-auto rounded-[8px] border border-solid border-ui-divider bg-ui-page-bg">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-solid border-ui-divider text-[12px] text-ui-text-secondary">
              <th className="px-4 py-2.5 font-medium">Type</th>
              {cols.map(c => <th key={c.label} className="px-4 py-2.5 font-medium">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {tab.items.map((i, n) => (
              <tr key={n} className="border-b border-solid border-ui-divider text-ui-body last:border-b-0">
                <td className="px-4 py-2.5 font-semibold">{typeLabel(i.type) ?? '—'}</td>
                {cols.map(c => <td key={c.label} className="px-4 py-2.5">{c.cell(i)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[12px] text-ui-text-secondary">From the Trust System.</p>
    </Panel>
  );
}

function FinanceDetail({ finance }: { finance: ProjectFinance }) {
  const p = finance.production;
  const cur = (r: Record<string, number>) => Object.entries(r).filter(([, v]) => v).map(([c, v]) => money(v, c)).join(' · ') || '—';
  return (
    <Panel title="Finance">
      <Fields rows={[
        ['PF', [p.pfUsd && money(p.pfUsd, 'USD'), p.pfTl && money(p.pfTl, 'TL')].filter(Boolean).join(' · ') || '—'],
        ['Invoiced', [p.invoiceUsd && money(p.invoiceUsd, 'USD'), p.invoiceTl && money(p.invoiceTl, 'TL')].filter(Boolean).join(' · ') || '—'],
        ['Production expenses', [p.expensesUsd && money(p.expensesUsd, 'USD'), p.expensesTl && money(p.expensesTl, 'TL')].filter(Boolean).join(' · ') || '—'],
        ['Supplier invoices', cur(finance.supplierInvoices)],
        ['Supplier payments', cur(finance.supplierPayments)],
        ['Supplier balance', cur(finance.supplierBalance)],
        ['Trust expenses', cur(finance.trustExpenses)],
      ]} />
    </Panel>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className={`m-0 text-[18px] font-semibold leading-[1.35] ${HEADING}`}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fields({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-3 rounded-[8px] bg-ui-page-bg p-5 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[12px] text-ui-text-secondary">{label}</dt>
          <dd className="m-0 truncate text-[14px] font-medium text-ui-body">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

const ACTION = `flex h-9 items-center gap-2 rounded-[6px] border border-solid border-ui-divider bg-ui-surface-elevated px-4 text-[13px] font-semibold no-underline hover:bg-ui-hover-bg ${HEADING}`;
const ActionButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) =>
  <button type="button" onClick={onClick} className={ACTION}>{children}</button>;
const ActionLink = ({ href, children }: { href: string; children: React.ReactNode }) =>
  <Link href={href} className={ACTION}>{children}</Link>;

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const [y, m, day] = d.slice(0, 10).split('-');
  return y && m && day ? `${m}/${day}/${y}` : d;
}

const money = (v: number, cur: string) =>
  `${cur === 'USD' ? '$' : cur === 'EUR' ? '€' : ''}${Math.round(v).toLocaleString('en-US')}${cur === 'TL' ? ' TL' : ''}`;
