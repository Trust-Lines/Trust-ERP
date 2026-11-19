'use client';

import { cn } from '@/lib/utils';
import { PANEL, TD_CLS, TH_CLS, fmtNumber } from '@/components/platform/marketing/pr/shared';
import type { TopLink } from './campaignData';

export function LinksTable({ links }: { links: TopLink[] }) {
  return (
    <section className={cn(PANEL, 'p-6')}>
      <h2 className="m-0 mb-3 text-[15px] font-semibold text-ui-heading">Links clicked</h2>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-ui-divider"><th className={TH_CLS}>Link</th><th className={cn(TH_CLS, 'text-right')}>People</th><th className={cn(TH_CLS, 'text-right')}>Clicks</th></tr></thead>
        <tbody>{links.map(l => (
          <tr key={l.url} className="border-b border-ui-divider last:border-b-0">
            <td className={TD_CLS}><a href={l.url} target="_blank" rel="noreferrer" className="block max-w-[560px] truncate text-ui-link hover:underline">{l.url}</a></td>
            <td className={cn(TD_CLS, 'text-right tabular-nums')}>{fmtNumber(l.people)}</td>
            <td className={cn(TD_CLS, 'text-right tabular-nums')}>{fmtNumber(l.clicks)}</td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}
