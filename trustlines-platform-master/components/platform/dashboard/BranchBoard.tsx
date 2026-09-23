'use client';

import * as React from 'react';
import { ProjectQuickView } from './ProjectQuickView';
// The real, editable opportunity popup — same one /leads and /marketing/opportunities use
// (comments, files, ClickUp reference, inline edits) — not a dashboard-only rebuild.
import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';

// Design: Figma "Tlines-Websites" → "Desktop - 17" (node 60:1139) — the 4-branch board that
// replaces the old company-wide dashboard. Each column is one real T-Lines region
// (lib/regions.ts), each row one pipeline stage. Who sees which columns is decided by the
// caller (app/(platform)/dashboard/page.tsx, via lib/access/regionScope) — this component
// only renders whatever columns it's given.
//
// Every card opens a quick-view popup in place — a project's shows files + progress, an
// opportunity's shows its pipeline details — instead of navigating off the dashboard.

export interface BoardCardItem {
  id: string;
  kind: 'project' | 'opportunity';
  badgeTop: string;
  badgeBottom: string;
  title: string;
  subtitle: string | null;
  // Raw yyyy-mm-dd (project: est. delivery, falling back to closed-deal date; opportunity: the
  // date it became an opportunity — ClickUp's own creation date, reliably set, unlike the
  // often-blank expected_close_date) — kept separate from dateLabel so the date filter can
  // compare it without reparsing the formatted display string.
  dateISO: string | null;
  dateLabel: string | null;
  href: string;
}

export interface BoardSection {
  key: string;
  label: string;
  accent: string;   // dot + label text
  bg: string;        // section tint
  badgeBg: string;
  badgeText: string;
  items: BoardCardItem[];
  emptyLabel: string;
}

export interface BoardColumn {
  regionCode: string;
  logoSrc: string;
  logoCode: string;
  headerColor: string;
  total: number;
  sections: BoardSection[];
}

// The source PNGs (public/TLINES LOGOS PNG) are 4500x4500 canvases with a lot of transparent
// padding baked in around the actual mark — measured once (bounding box of non-transparent
// pixels) so the header can crop straight to the logo instead of shrinking it to fit the pad.
const LOGO_INSET: Record<string, { l: number; t: number; r: number; b: number }> = {
  NE:  { l: 23.8,  t: 34.53, r: 23.8,  b: 34.6 },
  SE:  { l: 23.8,  t: 34.53, r: 23.8,  b: 34.6 },
  NW:  { l: 23.8,  t: 34.53, r: 23.8,  b: 34.6 },
  CVW: { l: 13.27, t: 37.93, r: 13.27, b: 38 },
};

function CroppedLogo({ src, code, className }: { src: string; code: string; className?: string }) {
  const inset = LOGO_INSET[code] ?? { l: 0, t: 0, r: 0, b: 0 };
  const w = 100 - inset.l - inset.r;
  const h = 100 - inset.t - inset.b;
  return (
    <span className={`relative block overflow-hidden ${className ?? ''}`} style={{ aspectRatio: `${w} / ${h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={src}
        className="absolute max-w-none"
        style={{
          width: `${(100 / w) * 100}%`,
          height: `${(100 / h) * 100}%`,
          left: `${-(inset.l / w) * 100}%`,
          top: `${-(inset.t / h) * 100}%`,
          filter: 'brightness(0) invert(1)',
        }}
      />
    </span>
  );
}

function CardBody({ item }: { item: BoardCardItem }) {
  return (
    <span className="min-w-0 flex-1 text-[#2f2f2f]">
      <span className="flex items-center justify-between gap-3">
        <span className="truncate text-[14px] font-bold">{item.title}</span>
        {item.dateLabel && <span className="shrink-0 text-[11px] font-medium opacity-70">{item.dateLabel}</span>}
      </span>
      {item.subtitle && <span className="block truncate text-[11px] opacity-90">{item.subtitle}</span>}
    </span>
  );
}

function CardBadge({ item, badgeBg, badgeText }: { item: BoardCardItem; badgeBg: string; badgeText: string }) {
  return (
    <span
      className="shrink-0 rounded px-2 py-1 text-[12px] font-bold text-center leading-tight"
      style={{ background: badgeBg, color: badgeText }}
    >
      {item.badgeTop}
      {item.badgeBottom && <><br />{item.badgeBottom}</>}
    </span>
  );
}

function Card({ item, badgeBg, badgeText, onOpen }: {
  item: BoardCardItem; badgeBg: string; badgeText: string; onOpen: (item: BoardCardItem) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-3.5 py-3 border-t first:border-t-0 text-left hover:brightness-[0.98] transition-[filter]"
      style={{ borderColor: 'rgba(0,0,0,0.06)' }}
      onClick={() => onOpen(item)}
    >
      <CardBadge item={item} badgeBg={badgeBg} badgeText={badgeText} />
      <CardBody item={item} />
    </button>
  );
}

function Section({ section, onOpen }: { section: BoardSection; onOpen: (item: BoardCardItem) => void }) {
  return (
    <div className="rounded-md pt-2.5" style={{ background: section.bg }}>
      <div className="flex items-center gap-2 px-3.5 pb-2">
        <span className="size-2 shrink-0 rounded-full" style={{ background: section.accent }} />
        <span className="text-[12.5px] font-bold uppercase tracking-wide" style={{ color: section.accent }}>
          {section.label}
        </span>
      </div>
      {section.items.length === 0 ? (
        <div className="border-t px-3.5 py-2.5" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <p className="text-[12.5px] opacity-60" style={{ color: section.accent }}>{section.emptyLabel}</p>
        </div>
      ) : (
        section.items.map(item => (
          <Card key={item.id} item={item} badgeBg={section.badgeBg} badgeText={section.badgeText} onOpen={onOpen} />
        ))
      )}
    </div>
  );
}

function DateFilterBar({ from, to, onFrom, onTo, onClear }: {
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; onClear: () => void;
}) {
  const active = from !== '' || to !== '';
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Date filter</span>
      <label className="flex items-center gap-1.5 text-[13px] text-neutral-700">
        From
        <input
          type="date" value={from} onChange={e => onFrom(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-[13px]"
        />
      </label>
      <label className="flex items-center gap-1.5 text-[13px] text-neutral-700">
        To
        <input
          type="date" value={to} onChange={e => onTo(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-[13px]"
        />
      </label>
      {active && (
        <button type="button" onClick={onClear} className="text-[12px] font-medium text-neutral-500 hover:text-neutral-800 hover:underline">
          Clear
        </button>
      )}
      <span className="basis-full text-[11px] text-neutral-400 sm:basis-auto">
        Project cards: delivery date. Opportunity cards: date it became an opportunity (ClickUp
        creation date). Cards with no date are hidden while a filter is set.
      </span>
    </div>
  );
}

function Column({ column, onOpen }: { column: BoardColumn; onOpen: (item: BoardCardItem) => void }) {
  return (
    // The count badge sits half outside the header (-top-3 -right-3), so it must stay OUTSIDE
    // the clipped/rounded wrapper below — clipping it together with the header would cut it off.
    <div className="relative">
      <div className="overflow-hidden rounded-xl shadow-sm" style={{ background: column.headerColor }}>
        <div className="flex items-center justify-center px-4 pb-3 pt-5">
          <CroppedLogo src={column.logoSrc} code={column.logoCode} className="h-16 sm:h-20" />
        </div>
        {/* No fixed/stretched height here — each column is exactly as tall as its own content,
            so a branch with fewer items never drags a leftover block of header color below it. */}
        <div className="space-y-3.5 bg-white p-3 sm:p-3.5">
          {column.sections.map(section => (
            <Section key={section.key} section={section} onOpen={onOpen} />
          ))}
        </div>
      </div>
      <div
        className="absolute -top-3 -right-3 grid size-11 place-items-center rounded-[10px] border-4 border-[#f4f4f4] text-[22px] font-bold text-[#f4f4f4]"
        style={{ background: column.headerColor }}
      >
        {column.total}
      </div>
    </div>
  );
}

export function BranchBoard({ columns, assignees, canEdit }: {
  columns: BoardColumn[];
  // Same "marketingAssignees" list /leads passes into this popup (profiles that can own an
  // opportunity) and the same canEdit gate that page computes from the viewer's role — both
  // decided server-side in app/(platform)/dashboard/page.tsx, not guessed here.
  assignees: { id: string; full_name: string }[];
  canEdit: boolean;
}) {
  const [openProjectId, setOpenProjectId] = React.useState<string | null>(null);
  const [openOpportunityId, setOpenOpportunityId] = React.useState<string | null>(null);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const handleOpen = (item: BoardCardItem) => {
    if (item.kind === 'project') setOpenProjectId(item.id);
    else setOpenOpportunityId(item.id);
  };

  const filteredColumns = React.useMemo(() => {
    if (!dateFrom && !dateTo) return columns;
    const inRange = (d: string | null) => {
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };
    return columns.map(column => {
      const sections = column.sections.map(s => ({ ...s, items: s.items.filter(i => inRange(i.dateISO)) }));
      return { ...column, sections, total: sections.reduce((sum, s) => sum + s.items.length, 0) };
    });
  }, [columns, dateFrom, dateTo]);

  if (columns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#d8d8d8] bg-white p-8 text-center text-sm text-[#777]">
        No branch is assigned to your account yet — ask an admin to set your region on the Team page.
      </div>
    );
  }
  return (
    <>
      <DateFilterBar
        from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo}
        onClear={() => { setDateFrom(''); setDateTo(''); }}
      />
      {/* items-start: columns must NOT stretch to match the tallest one (grid's default) — see
          the Column comment above for why that mattered. */}
      <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {filteredColumns.map(column => (
          <Column key={column.regionCode} column={column} onOpen={handleOpen} />
        ))}
      </div>
      <ProjectQuickView projectId={openProjectId} onClose={() => setOpenProjectId(null)} />
      {openOpportunityId && (
        <OpportunityQuickView
          opportunityId={openOpportunityId}
          kind="opportunity"
          assignees={assignees}
          canEdit={canEdit}
          onClose={() => setOpenOpportunityId(null)}
        />
      )}
    </>
  );
}
