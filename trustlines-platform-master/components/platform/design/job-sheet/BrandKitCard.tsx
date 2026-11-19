'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HEADING } from '../designShared';
import { BrandSwatches, type BrandKit } from '../library/BrandKitsClient';
import { Card } from './sheetShared';

/** The customer's Brand Kit(s) on the Brief — colours to copy, fonts, rules, link to the files. */
export function BrandKitCard({ prospectId }: { prospectId: string | null }) {
  const [kits, setKits] = useState<BrandKit[] | null>(null);
  useEffect(() => {
    if (!prospectId) { setKits([]); return; }
    let live = true;
    fetch(`/api/design/brands?prospectId=${prospectId}`).then(r => (r.ok ? r.json() : { kits: [] })).then(b => { if (live) setKits(b.kits ?? []); }).catch(() => { if (live) setKits([]); });
    return () => { live = false; };
  }, [prospectId]);
  const create = (
    <Link href="/design/brands" className="inline-flex h-6 shrink-0 items-center gap-2 rounded-[6px] bg-ui-btn-accent pl-[7px] pr-3 text-[13px] font-medium text-ui-btn-accent-fg no-underline transition-opacity hover:opacity-90">
      <Plus size={16} aria-hidden /> Create New
    </Link>
  );
  return (
    <Card title="Brand Kit" action={create}>
      {kits === null ? (
        <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p>
      ) : kits.length === 0 ? (
        <p className="m-0 text-[13px] text-ui-text-secondary">{prospectId ? 'No brand kit for this customer yet — create one with the logo, colours and fonts.' : 'No customer linked to this job yet.'}</p>
      ) : kits.map(k => (
        <div key={k.id} className="flex flex-col gap-2">
          <p className={cn('m-0 text-[13px] font-medium', HEADING)}>{k.name}{k.fonts.length ? <span className="font-normal text-ui-text-secondary"> · {k.fonts.join(', ')}</span> : null}</p>
          <BrandSwatches colors={k.colors} />
          {k.guidelines && <p className="m-0 line-clamp-3 whitespace-pre-wrap text-[12px] text-ui-body">{k.guidelines}</p>}
          <Link href="/design/brands" className="w-fit text-[12px] text-ui-link">Logo & files in Brand Kits →</Link>
        </div>
      ))}
    </Card>
  );
}
