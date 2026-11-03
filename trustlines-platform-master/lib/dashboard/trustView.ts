// The Trust Lines dashboard (app/(platform)/dashboard, for the Trust Lines side and the GM): every
// branch's Trust System projects as one board by production stage — Finalization → Technical /
// PO + PF → To Production → In Production → Shipped — and KPIs about the work Trust Lines does.
// The T-Lines side keeps its branch board. No I/O: built from what the page already loaded.
import type { BoardCardItem, BoardColumn } from '@/components/platform/dashboard/BranchBoard';
import type { KpiItem } from '@/components/platform/dashboard/TopSummaryRow';
import type { TrustProject, TrustStage } from '@/lib/trust/board';

export interface TrustCard { region: string; stage: TrustStage; item: BoardCardItem; createdAt: string }

const STAGES: { key: TrustStage; label: string; accent: string; bg: string }[] = [
  { key: 'finalization',  label: 'Finalization',           accent: 'var(--stage-finalization-fg)', bg: 'var(--stage-finalization-bg)' },
  { key: 'technical',     label: 'Technical / PO + PF',    accent: 'var(--stage-technical-fg)', bg: 'var(--stage-technical-bg)' },
  { key: 'to_production', label: 'To Production',          accent: 'var(--stage-to-production-fg)', bg: 'var(--stage-to-production-bg)' },
  { key: 'in_production', label: 'Production In Progress', accent: 'var(--stage-production-fg)', bg: 'var(--stage-production-bg)' },
  { key: 'shipped',       label: 'Shipped',                accent: 'var(--stage-shipped-fg)', bg: 'var(--stage-shipped-bg)' },
];
const REGION_SHORT: Record<string, string> = { TLINES_NE: 'NE', TLINES_SE: 'SE', TLINES_NW: 'NW', CVW: 'West' };

/** A PF / PO that still waits for a signature: the type has a PF code and either isn't signed. */
const signed = (s: string | null | undefined) => (s ?? '').toUpperCase().replace(/[\s_]/g, '').startsWith('SIGNED');
export function waitsForSignature(p: TrustProject): boolean {
  return (p.items ?? []).some(i => !!i.pfCode?.trim() && (!signed(i.pfSignStatus) || !signed(i.poSignStatus)));
}

export function trustDashboard({ projects, cards, weekAgo }: { projects: TrustProject[]; cards: TrustCard[]; weekAgo: string }): { columns: BoardColumn[]; kpis: KpiItem[] } {
  const byDate = (a: BoardCardItem, b: BoardCardItem) =>
    a.dateISO && b.dateISO ? b.dateISO.localeCompare(a.dateISO) : a.dateISO ? -1 : b.dateISO ? 1 : 0;

  const columns: BoardColumn[] = STAGES.map(s => {
    const items = cards.filter(c => c.stage === s.key)
      // Which branch it's for, in front of its types — the board mixes all of them.
      .map(c => ({ ...c.item, category: [REGION_SHORT[c.region] ?? c.region, c.item.category].filter(Boolean).join(' · ') }))
      .sort(byDate);
    return {
      regionCode: s.key, logoSrc: '', logoCode: '', headerColor: s.accent, title: s.label,
      sections: [{ key: s.key, label: `${items.length} project${items.length === 1 ? '' : 's'}`, accent: s.accent, bg: s.bg, items, emptyLabel: 'No projects at this stage' }],
    };
  });

  const count = (stages: TrustStage[]) => cards.filter(c => stages.includes(c.stage));
  const fresh = (rows: TrustCard[]) => { const n = rows.filter(c => c.createdAt >= weekAgo).length; return n > 0 ? `+${n} New` : undefined; };
  const toSign = projects.filter(waitsForSignature).length;
  const onHold = cards.filter(c => c.item.onHold).length;
  const kpis: KpiItem[] = [
    { key: 'active', label: 'Projects in Trust', value: cards.length, href: '/production', badge: fresh(cards) },
    { key: 'to_sign', label: 'PF / PO to sign', value: toSign, href: '/production', badge: toSign > 0 ? 'Waiting' : undefined },
    { key: 'to_order', label: 'To Production', value: count(['to_production']).length, href: '/production' },
    { key: 'production', label: 'In Production', value: count(['in_production']).length, href: '/production' },
    { key: 'on_hold', label: 'On Hold', value: onHold, href: '/production', badge: onHold > 0 ? 'Check' : undefined },
    { key: 'shipped', label: 'Shipped', value: count(['shipped']).length, href: '/logistics' },
  ];
  return { columns, kpis };
}
