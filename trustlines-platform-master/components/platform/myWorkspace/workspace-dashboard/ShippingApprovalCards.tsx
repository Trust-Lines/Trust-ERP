'use client';

import Link from 'next/link';
import { ClipboardPenLine, Ship } from 'lucide-react';
import type { MyApproval } from '@/lib/approvals/mine';
import { DAY_MS, MON, dayStart, listState, parseDay, type Container, type Loaded } from './dashboardData';
import { CodeChip, ListCard, Pill, Row } from './ListParts';

/** Containers on the way, plus the PO and PF waiting for this person's signature. */
export function ShippingApprovalCards({ containers, upcoming, docState, po, pf, now }: {
  containers: Loaded<Container>;
  upcoming: Container[];
  docState: MyApproval[] | 'error' | null;
  po: MyApproval[];
  pf: MyApproval[];
  now: Date;
}) {
  const ageDays = (iso: string) => Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
      {containers !== 'denied' && (
        <ListCard title="Containers" icon={<Ship strokeWidth={1.5} />} color="var(--status-t8-fg)" href="/logistics"
          state={listState(containers, upcoming.length)} emptyText="No containers on the way.">
          {upcoming.slice(0, 3).map(c => {
            const eta = parseDay(c.estimated_arrival_date!);
            const left = Math.round((eta.getTime() - dayStart(now).getTime()) / DAY_MS);
            return (
              <Row key={c.id} color="var(--status-t8-fg)" href={`/logistics/${c.id}`} label={`Open container ${c.container_no ?? ''}`} action="none"
                lead={<Link href={`/logistics/${c.id}`} aria-label={`Open container ${c.container_no ?? ''}`} className="inline-flex size-[35px] items-center justify-center rounded-[6px] text-current" style={{ background: 'var(--status-t8-bg)' }}><Ship className="size-[22px]" strokeWidth={1.5} aria-hidden /></Link>}
                title={`Container ${c.container_no ?? '#'}`} sub={`${c.item_count} item${c.item_count === 1 ? '' : 's'}`}
                right={<>
                  <Pill solid={left <= 7} color={left <= 7 ? 'var(--color-error-normal)' : 'var(--status-t8-fg)'}>{left < 0 ? `${-left} day${left === -1 ? '' : 's'} late` : `${left} day${left === 1 ? '' : 's'} left`}</Pill>
                  <span className="flex w-[34px] flex-col items-center text-center leading-[1.1]">
                    <span className="text-[14px] tracking-[-0.308px]">{MON.format(eta).toUpperCase()}</span>
                    <span className="text-[24px] font-semibold">{eta.getDate()}</span>
                  </span>
                </>} />
            );
          })}
        </ListCard>
      )}
      {[{ title: 'PO to Sign', list: po, t: 't1', empty: 'No POs waiting for you.' },
        { title: 'PF to Sign', list: pf, t: 't7', empty: 'No PFs waiting for you.' }].map(card => (
        <ListCard key={card.title} title={card.title} icon={<ClipboardPenLine strokeWidth={1.5} />} color={`var(--status-${card.t}-fg)`} href="/workspace/approvals"
          state={listState(docState, card.list.length)} emptyText={card.empty}>
          {card.list.slice(0, 3).map(a => {
            const age = ageDays(a.createdAt);
            return (
              <Row key={a.approvalId} color={`var(--status-${card.t}-fg)`} href={`/projects/${a.projectId}`} label={`Open ${a.projectCode} ${a.fileName}`}
                lead={<CodeChip t={card.t}>#{a.projectCode}</CodeChip>} title={a.projectName} sub={`V${a.versionNum ?? a.version} · ${a.stageLabel}`}
                right={age >= 3 ? <Pill solid color="var(--color-error-normal)">High Priority</Pill> : <Pill color={`var(--status-${card.t}-fg)`}>{age === 0 ? 'Today' : `${age} day${age === 1 ? '' : 's'}`}</Pill>} />
            );
          })}
        </ListCard>
      ))}
    </div>
  );
}
