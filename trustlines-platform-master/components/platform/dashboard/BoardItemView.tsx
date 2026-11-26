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
import { ProspectQuickView } from '@/components/platform/marketing/ProspectQuickView';
import { StepStrip, type ContactStep } from '@/components/platform/marketing/prospect-detail/StepStrip';
import { BoardTaskPanel } from './BoardTaskPanel';
import { projectNumber } from '@/lib/keyClients/match';
import {
  buildCardTabs, isShipped, type CardDeal, type CardDetails, type CardInstall, type CardItemDetail, type CardMoney, type CardPhase,
  type CardProject, type CardProjectExtra, type CardTab, type ChipTone, type MoneyLevel,
} from '@/lib/dashboard/cardTabs';
import { typeLabel, type TrustItem } from '@/lib/trust/board';
import { STAGE_LABELS } from '@/lib/workflow/machine';
import type { ProjectStage } from '@/types/database';
import type { BoardCardItem, BoardSection } from './BranchBoard';
import { useRouter } from 'next/navigation';
import { SERVICE_LINES, serviceLineLabel } from '@/lib/regions';
import { HEADING } from '@/components/platform/shared/panelStyles';
import { isoDateToUS as fmtDate } from '@/lib/formatters';

// Design: Figma "TRUST-LINES ERP" → "Page content" (node 359:25337, new version 908:25017) — the
// popup a dashboard card opens. Under the heading: T Lines Tasks and Trust Lines Tasks. Left: one tab
// per stage the project has reached (lib/dashboard/cardTabs); middle: that stage's details.
// Potential / Opportunity / Project jump to that part of the list.
// On top, the Contact pop-up's three steps: Before Closed = the Potential / Opportunity stages, After
// Closed = the project's (Finalization, PO + PF, Production…); Client Info opens the Contact itself.

const PHASES: { value: CardPhase; label: string; icon: LucideIcon }[] = [
  { value: 'potential', label: 'Potential', icon: Clock },
  { value: 'opportunity', label: 'Opportunity', icon: Gem },
  { value: 'project', label: 'Project', icon: BriefcaseBusiness },
];

// Status Chip icons by tone (Figma Status Language): idle, in progress, waiting, done, lost.
const TONE_ICON: Record<ChipTone, LucideIcon | 'in-review'> = { t0: CircleDashed, t2: CircleDotDashed, t7: 'in-review', t9: CircleCheck, t10: CircleX };

const notYet = () => toast.info('Not connected yet');

interface CardData { project: CardProject | null; deals: CardDeal[]; details: CardDetails | null; allowed: string[]; prospectId?: string | null }

export function BoardItemView({ item, section, assignees, canEdit, companyEdit = 'none', staff = [], everyone = [], meId = null, canEditTrustTasks = false, onClose }: {
  item: BoardCardItem;
  section: BoardSection;
  /** Set the card's company here: 'any' always, 'empty' only while it has none. */
  companyEdit?: 'any' | 'empty' | 'none';
  assignees: { id: string; full_name: string }[];
  canEdit: boolean;
  /** Who a Trust Lines task can be assigned to. */
  staff?: { id: string; full_name: string }[];
  /** Who a T Lines task can be assigned to. */
  everyone?: { id: string; full_name: string }[];
  /** The viewer (an assignee may tick their own task done). */
  meId?: string | null;
  /** Add / change the meeting tasks (the API checks it too). */
  canEditTrustTasks?: boolean;
  onClose: () => void;
}) {
  const [data, setData] = React.useState<CardData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [openDeal, setOpenDeal] = React.useState<CardDeal | null>(null);
  const [step, setStep] = React.useState<ContactStep | null>(null);

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
    () => (data ? buildCardTabs({ deals: data.deals, project: data.project, trustItems: item.trustItems ?? null, details: data.details ?? null, today, allowed: data.allowed }) : []),
    [data, item.trustItems, today],
  );
  // Opens on the Opportunity: the card's own deal, else the latest Opportunity (then Potential),
  // else the furthest stage reached.
  const opening = tabs.find(t => t.view === 'deal' && t.deal.id === item.id)
    ?? tabs.filter(t => t.phase === 'opportunity').at(-1)
    ?? tabs.filter(t => t.phase === 'potential').at(-1)
    ?? tabs.at(-1) ?? null;
  // Before Closed until the project has started, then After Closed — unless a step was picked.
  const shownStep: ContactStep = step ?? (opening?.phase === 'project' ? 'after' : 'before');
  const stepTabs = tabs.filter(t => (shownStep === 'after' ? t.phase === 'project' : t.phase !== 'project'));
  const active = stepTabs.find(t => t.key === selected)
    ?? (opening && stepTabs.includes(opening) ? opening : null)
    ?? (shownStep === 'after' ? stepTabs[0] : stepTabs.at(-1)) ?? null;

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
  // The meeting task lists (T Lines / Trust Lines, migrations 153-154) hang on the project number,
  // so every card of the project shares them; a card without one keeps its own lists.
  const cardNo = item.projectNo ?? projectNumber(item.badgeTop);
  const boardTasksApi = `/api/tlines-dashboard/trust-tasks/${cardNo ? `no-${cardNo}` : `${item.kind}-${item.id}`}`;

  const pick = (phase: CardPhase) => {
    const t = phase === 'project' ? tabs.find(x => x.phase === 'project') : tabs.filter(x => x.phase === phase).at(-1);
    if (t) { setStep(phase === 'project' ? 'after' : 'before'); setSelected(t.key); }
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
        <StepStrip
          flush step={shownStep} disabled={data?.prospectId ? [] : ['client']}
          onStep={s => { setStep(s); setSelected(null); }}
        />
        {/* Client Info: the card's Contact, in this same pop-up (its own header, tabs and Activity). */}
        {shownStep === 'client' && data?.prospectId ? (
          <div className="min-h-0 flex-1">
            <ProspectQuickView embedded prospectId={data.prospectId} canEdit={canEdit} onClose={onClose} />
          </div>
        ) : (<>
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

        {/* ── Tasks (Figma 908:25017): the project's meeting to-dos, T Lines' and Trust Lines' ─── */}
        <div className="flex shrink-0 flex-col gap-2.5 xl:flex-row xl:items-start">
          <BoardTaskPanel title="T Lines Tasks" apiBasePath={boardTasksApi} query="?side=tlines"
            assignees={everyone} canEdit={canEditTrustTasks} meId={meId} />
          <BoardTaskPanel title="Trust Lines Tasks" apiBasePath={boardTasksApi} query="?side=trust"
            assignees={staff} canEdit={canEditTrustTasks} meId={meId} />
        </div>

        {/* ── Body: stage tabs on the left, the selected stage's details ─── */}
        <div className="flex min-h-0 flex-1 gap-4">
          <div role="tablist" aria-orientation="vertical" className="flex w-[262px] shrink-0 flex-col gap-2 overflow-y-auto rounded-[10px] bg-ui-surface p-2">
            {!data && !error && <p className="m-0 flex items-center gap-2 p-3 text-[13px] text-ui-text-secondary"><Loader2 size={14} className="animate-spin" aria-hidden /> Loading…</p>}
            {data && stepTabs.length === 0 && (
              <p className="m-0 p-3 text-[13px] text-ui-text-secondary">
                {tabs.length === 0 ? 'Nothing recorded for this project yet.' : shownStep === 'after' ? 'Not closed yet — the project stages show up here once it is won.' : 'No Potential or Opportunity on this project.'}
              </p>
            )}
            {stepTabs.map(t => {
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
              : active ? <Detail tab={active} project={data?.project ?? null} details={data?.details ?? null} today={today} onOpenDeal={setOpenDeal} />
              : data && <EmptyState size="sm" icon={<CircleDashed />} title="No stages yet" description="Its Potential, Opportunity and project stages show up here as it moves along." />}
          </div>
        </div>
        </>)}
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

function Detail({ tab, project, details, today, onOpenDeal }: {
  tab: CardTab; project: CardProject | null; details: CardDetails | null; today: string; onOpenDeal: (d: CardDeal) => void;
}) {
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
  if (tab.view === 'finalization') return <ProjectDetail project={project} extra={details?.extra ?? null} money={details?.money ?? 'none'} />;
  if (tab.view === 'installation') return <InstallDetail installs={tab.installs} />;
  if (tab.view === 'items') {
    return details?.items.length
      ? <RowsTable tab={tab} rows={details.items} money={details.money} today={today} />
      : <ItemsTable tab={tab} today={today} />;
  }
  return <FinanceDetail finance={tab.finance} />;
}

/** Finalization: everything we hold on the project — overview, dates, people, commercial terms. */
function ProjectDetail({ project, extra, money }: { project: CardProject | null; extra: CardProjectExtra | null; money: MoneyLevel }) {
  if (!project) {
    return (
      <Panel title="Finalization">
        <p className="m-0 text-[13px] text-ui-text-secondary">In the Trust System — not opened as a project here yet.</p>
      </Panel>
    );
  }
  const commercial: [string, string | null][] = [];
  if (extra && (money === 'all' || money === 'po')) {
    commercial.push(['Deal value', extra.dealValue ? money_(extra.dealValue, extra.currency ?? 'USD') : null], ['Payment terms', extra.paymentTerms ?? null]);
  }
  if (extra && money === 'all') commercial.push(['Margin target', extra.marginTarget != null ? `${extra.marginTarget}%` : null]);
  return (
    <Panel title="Finalization" action={<ActionLink href={`/projects/${project.id}`}>Open project <ExternalLink size={14} aria-hidden /></ActionLink>}>
      <Section title="Project">
        <Fields rows={[
          ['Project', `${project.code} — ${project.name}`], ['Stage', STAGE_LABELS[project.currentStage as ProjectStage] ?? project.currentStage],
          ['Client', extra?.client], ['Company', extra?.company ? serviceLineLabel(extra.company) : null],
          ['Region', extra?.region], ['Site', project.site],
          ['Scope', extra?.categories.length ? extra.categories.map(c => typeLabel(c) ?? c).join(', ') : null], ['Opened', fmtDate(extra?.createdAt)],
        ]} />
        {extra?.scope && <p className="m-0 whitespace-pre-line rounded-[8px] bg-ui-page-bg px-5 py-3 text-[13px] text-ui-body">{extra.scope}</p>}
      </Section>
      <Section title="Dates">
        <Fields rows={[
          ['Closed deal', fmtDate(project.closedDealDate)], ['Est. finalization', fmtDate(extra?.estFinalization)],
          ['Est. production start', fmtDate(extra?.estProductionStart)],
          ['Est. delivery', [fmtDate(project.estDeliveryDate), extra?.hardDeadline ? '(hard deadline)' : null].filter(Boolean).join(' ') || null],
          ['Actual delivery', fmtDate(extra?.actualDelivery)],
        ]} />
      </Section>
      {extra && (
        <Section title="People">
          <Fields rows={extra.people.map(p => [p.label, p.name] as [string, string | null])} />
        </Section>
      )}
      {commercial.length > 0 && (
        <Section title="Commercial">
          <Fields rows={commercial} />
        </Section>
      )}
    </Panel>
  );
}

/** PO + PF / Production / Shipping from our production rows, money cut to the viewer's level. */
function RowsTable({ tab, rows, money, today }: { tab: Extract<CardTab, { view: 'items' }>; rows: CardItemDetail[]; money: MoneyLevel; today: string }) {
  const pf = money === 'all' || money === 'pf';
  const po = money === 'all' || money === 'po';
  const has = (k: keyof CardItemDetail) => rows.some(r => r[k] !== undefined);
  type Col = { label: string; cell: (r: CardItemDetail) => React.ReactNode; num?: boolean; total?: (rs: CardItemDetail[]) => string };
  const sumOf = (k: 'pfUsd' | 'pfTl' | 'poUsd' | 'poTl' | 'expensesUsd' | 'paidUsd', cur: string) =>
    (rs: CardItemDetail[]) => money_(rs.reduce((a, r) => a + (r[k] ?? 0), 0), cur);
  const cols: Col[] =
    tab.key === 'po_pf' ? [
      { label: 'Order type', cell: r => typeLabel(r.orderType) ?? '—' },
      ...(pf ? [
        { label: 'Vendor', cell: (r: CardItemDetail) => r.vendor || '—' },
        { label: 'PF code', cell: (r: CardItemDetail) => r.pfCode || '—' },
        { label: 'PF signed', cell: (r: CardItemDetail) => typeLabel(r.pfSign ?? null) ?? '—' },
      ] : []),
      { label: 'PO signed', cell: r => typeLabel(r.poSign) ?? '—' },
      ...(pf && has('pfUsd') ? [
        { label: 'PF $', num: true, cell: (r: CardItemDetail) => money_(r.pfUsd, 'USD'), total: sumOf('pfUsd', 'USD') },
        { label: 'PF TL', num: true, cell: (r: CardItemDetail) => money_(r.pfTl, 'TL'), total: sumOf('pfTl', 'TL') },
      ] : []),
      ...(po ? [
        { label: 'Invoice $', num: true, cell: (r: CardItemDetail) => money_(r.poUsd, 'USD'), total: sumOf('poUsd', 'USD') },
        { label: 'Invoice TL', num: true, cell: (r: CardItemDetail) => money_(r.poTl, 'TL'), total: sumOf('poTl', 'TL') },
        { label: 'Invoice', cell: (r: CardItemDetail) => [r.invoiceNo, fmtDate(r.invoiceDate)].filter(Boolean).join(' · ') || '—' },
      ] : []),
      ...(money === 'all' ? [
        { label: 'Paid $', num: true, cell: (r: CardItemDetail) => money_(r.paidUsd, 'USD'), total: sumOf('paidUsd', 'USD') },
      ] : []),
    ] : tab.key === 'production' ? [
      { label: 'Status', cell: r => typeLabel(r.status) ?? '—' },
      { label: 'Note', cell: r => r.note || '—' },
      { label: 'STD', cell: r => fmtDate(r.dates.std) ?? '—' },
      { label: 'ETD', cell: r => fmtDate(r.dates.etd) ?? '—' },
      { label: 'RTD', cell: r => fmtDate(r.dates.rtd) ?? '—' },
      { label: 'RDY', cell: r => fmtDate(r.dates.rdy) ?? '—' },
      { label: 'FTD', cell: r => fmtDate(r.dates.ftd) ?? '—' },
      { label: 'Target', cell: r => fmtDate(r.dates.target) ?? '—' },
    ] : [
      { label: 'Container', cell: r => r.container?.no || '—' },
      { label: 'Status', cell: r => typeLabel(r.container?.status ?? null) ?? '—' },
      { label: 'Carrier / vessel', cell: r => [r.container?.carrier, r.container?.vessel].filter(Boolean).join(' · ') || '—' },
      { label: 'Departure', cell: r => fmtDate(r.container?.departure) ?? '—' },
      { label: 'ETA', cell: r => fmtDate(r.container?.eta) ?? '—' },
      { label: 'Arrived', cell: r => fmtDate(r.container?.arrival) ?? (r.container?.departure && r.container.departure.slice(0, 10) <= today ? 'On the way' : '—') },
      { label: 'To', cell: r => typeLabel(r.container?.destination ?? null) ?? '—' },
    ];
  const shown = tab.key === 'shipping' ? rows.filter(r => r.container) : rows;
  const totals = cols.some(c => c.total);
  return (
    <Panel title={tab.title}>
      <div className="overflow-x-auto rounded-[8px] border border-solid border-ui-divider bg-ui-page-bg">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-solid border-ui-divider text-[12px] text-ui-text-secondary">
              <th className="px-4 py-2.5 font-medium">Type</th>
              {cols.map(c => <th key={c.label} className={`whitespace-nowrap px-4 py-2.5 font-medium ${c.num ? 'text-right' : ''}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className="border-b border-solid border-ui-divider align-top text-ui-body last:border-b-0">
                <td className="px-4 py-2.5">
                  <span className="font-semibold">{typeLabel(r.type) ?? r.type}</span>
                  {r.source && r.source !== 'project' && <span className="ml-1.5 text-[11px] text-ui-text-secondary">({typeLabel(r.source)})</span>}
                  {r.description && <span className="block max-w-[260px] truncate text-[11px] text-ui-text-secondary" title={r.description}>{r.description}</span>}
                </td>
                {cols.map(c => <td key={c.label} className={`px-4 py-2.5 ${c.num ? 'whitespace-nowrap text-right tabular-nums' : ''}`}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="border-t border-solid border-ui-divider font-semibold text-ui-body">
                <td className="px-4 py-2.5">Total</td>
                {cols.map(c => <td key={c.label} className={`px-4 py-2.5 ${c.num ? 'whitespace-nowrap text-right tabular-nums' : ''}`}>{c.total ? c.total(shown) : ''}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="m-0 text-[12px] text-ui-text-secondary">
        From the production board.{money === 'po' ? ' Prices: PO only.' : money === 'pf' ? ' Prices: PF only.' : ''}
      </p>
    </Panel>
  );
}

function InstallDetail({ installs }: { installs: CardInstall[] }) {
  return (
    <Panel title="Installation">
      {installs.map((i, n) => (
        <Section key={n} title={installs.length > 1 ? `#${i.label}` : undefined}>
          <Fields rows={[
            ['Planned', [fmtDate(i.start), fmtDate(i.finish)].filter(Boolean).join(' → ') || null], ['Status', i.status],
            ['Team', [i.team, i.teamSize ? `${i.teamSize} people` : null].filter(Boolean).join(' · ') || null], ['PM', i.pm],
            ['Scope', i.scope], ['Confidence', i.confidence], ['Blockers', i.blockers], ['Notes', i.notes],
          ]} />
        </Section>
      ))}
    </Panel>
  );
}

function FinanceDetail({ finance: f }: { finance: CardMoney }) {
  const pair = (usd?: number, tl?: number) => [usd ? money_(usd, 'USD') : null, tl ? money_(tl, 'TL') : null].filter(Boolean).join(' · ') || null;
  const cur = (r?: Record<string, number>) => (r ? Object.entries(r).filter(([, v]) => v).map(([c, v]) => money_(v, c)).join(' · ') || null : null);
  const po = f.level === 'all' || f.level === 'po';
  const pf = f.level === 'all' || f.level === 'pf';
  return (
    <Panel title="Finance">
      {po && (
        <Section title="Client side (PO)">
          <Fields rows={[
            ['PO total (PO documents)', f.poUsd ? money_(f.poUsd, 'USD') : (f.poDocs?.length ? '$0' : 'No PO document yet')],
            ...(f.poDocs ?? []).map(d => [`  ${d.type} PO v${d.version} · ${d.status}`, money_(d.usd, 'USD')] as [string, string | null]),
            ['Invoiced (production rows)', pair(f.invoicedUsd, f.invoicedTl)],
            ['Deal value', f.dealValue ? money_(f.dealValue, f.currency ?? 'USD') : null],
            ...(f.level === 'all' ? [['Paid', pair(f.paidUsd, f.paidTl)] as [string, string | null]] : []),
          ]} />
        </Section>
      )}
      {pf && (
        <Section title="Supplier side (PF)">
          <Fields rows={[
            ['PF total', pair(f.pfUsd, f.pfTl)], ['Production expenses', pair(f.expensesUsd, f.expensesTl)],
            ['Supplier invoices', cur(f.supplierInvoices)], ['Supplier payments', cur(f.supplierPayments)],
            ['Supplier balance', cur(f.supplierBalance)], ['Trust expenses', cur(f.trustExpenses)],
          ]} />
        </Section>
      )}
      {f.level === 'all' && (
        <Section title="Result">
          <Fields rows={[
            ['Margin (PO − PF − expenses, USD)', f.marginUsd != null ? money_(f.marginUsd, 'USD') : null],
            ['Margin %', f.marginUsd != null && f.poUsd ? `${Math.round((f.marginUsd / f.poUsd) * 1000) / 10}%` : null],
            ['TL costs (not in the margin yet)', (f.pfTl || 0) + (f.expensesTl || 0) ? money_((f.pfTl || 0) + (f.expensesTl || 0), 'TL') : null],
            ['Margin target', f.marginTarget != null ? `${f.marginTarget}%` : null],
          ]} />
        </Section>
      )}
    </Panel>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {title && <h4 className="m-0 text-[13px] font-semibold uppercase tracking-[0.6px] text-ui-text-secondary">{title}</h4>}
      {children}
    </div>
  );
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

/** A price, or — when there is none. */
const money_ = (v: number | null | undefined, cur: string) => (v ? money(v, cur) : '—');
const money = (v: number, cur: string) =>
  `${cur === 'USD' ? '$' : cur === 'EUR' ? '€' : ''}${Math.round(v).toLocaleString('en-US')}${cur === 'TL' ? ' TL' : ''}`;
