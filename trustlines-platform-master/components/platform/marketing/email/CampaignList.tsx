'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Ellipsis, ExternalLink, Mail, MailOpen, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/feedback-states';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmModal } from '@/components/ui/modal';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { findStatusTag, STATUS_TAGS } from '@/lib/status/tags';
import type { CampaignStats, EmailCampaignRow } from '@/lib/email/campaigns';
import { fmtNumber, sendJson } from '../pr/shared';

// Figma "Email Campaigns" (990:15405, dark 1019:27897) — campaigns tab: search + status filter, then the
// bordered table (grey heading row, 64px rows, row "…" menu, selection for bulk delete).

const DAY = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const TH = 'h-[46px] whitespace-nowrap px-2.5 text-[12px] font-semibold leading-[1.4] text-ui-body';
const TD = 'h-16 px-2.5 text-[13px] leading-[1.4] text-ui-body';
const NUM = cn(TD, 'text-center tabular-nums');

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...STATUS_TAGS.email_campaign.tags.map(t => ({ value: t.key, label: t.label })),
];

export function CampaignList({ campaigns, stats, error, canEdit, mounted, creating, onCreate, onChanged }: {
  campaigns: EmailCampaignRow[] | null;
  stats: Record<string, CampaignStats>;
  error: string | null;
  canEdit: boolean;
  /** Dates render after mount only (server and browser time zones differ). */
  mounted: boolean;
  creating: boolean;
  onCreate: () => void;
  onChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'asc' | 'desc' | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<EmailCampaignRow[] | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (campaigns ?? []).filter(c =>
      (!status || c.status === status) && (!q || c.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q)));
    if (sort) list.sort((a, b) => a.name.localeCompare(b.name) * (sort === 'asc' ? 1 : -1));
    return list;
  }, [campaigns, query, status, sort]);

  const shownPicked = rows.filter(r => picked.has(r.id));
  const allPicked = rows.length > 0 && shownPicked.length === rows.length;
  const toggle = (id: string, on: boolean) => setPicked(p => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });

  async function remove() {
    if (!removing) return;
    let failed = 0; let firstError = '';
    for (const c of removing) {
      try { await sendJson(`/api/marketing/email-campaigns/${c.id}`, 'DELETE'); }
      catch (e) { failed += 1; firstError ||= e instanceof Error ? e.message : 'Could not delete'; }
    }
    const done = removing.length - failed;
    if (done) toast.success(done === 1 ? 'Campaign deleted' : `${done} campaigns deleted`);
    if (failed) toast.error(failed === removing.length ? firstError : `${failed} not deleted — ${firstError}`);
    setPicked(new Set()); setRemoving(null);
    await onChanged();
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-[380px]">
            <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
            <Input className="h-10 pl-8 text-[13px] dark:rounded-[6px] dark:border-secondary-500 dark:bg-primary-800 dark:pl-8" placeholder="Search campaigns…" value={query}
              onChange={e => setQuery(e.target.value)} aria-label="Search campaigns" />
          </div>
          <Select aria-label="Filter by status" value={status} onValueChange={v => setStatus(v ?? '')} options={STATUS_OPTIONS}
            className="h-10 w-auto min-w-[130px] text-[11px] dark:rounded-[4px] dark:border-primary-50 dark:bg-primary-800 dark:px-[11px] dark:text-primary-50" />
        </div>
        {canEdit && shownPicked.length > 0 && (
          <div className="flex items-center gap-2 text-[12px] text-ui-body">
            {shownPicked.length} selected
            <Button variant="secondary" size="sm" onClick={() => setRemoving(shownPicked)}><Trash2 /> Delete</Button>
          </div>
        )}
      </div>

      {error ? <ErrorState title="Campaigns aren’t available" description={error} />
        : campaigns === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p>
          : campaigns.length === 0 ? (
            <EmptyState icon={<MailOpen />} title="No email campaigns yet"
              description="Pick an audience from Contacts, design the email from a template, send yourself a test, then send or schedule it."
              action={canEdit ? <Button loading={creating} onClick={onCreate}><Plus /> New Campaign</Button> : undefined} />
          ) : (
            <div className="overflow-x-auto rounded-[8px] border border-ui-divider bg-ui-page-bg">
              <table className="w-full min-w-[1100px] border-collapse">
                <thead>
                  <tr className="border-b border-ui-divider bg-ui-surface">
                    <th className={cn(TH, 'w-[44px] pl-[18px] pr-2.5')}>
                      <Checkbox aria-label="Select all campaigns" checked={allPicked}
                        indeterminate={shownPicked.length > 0 && !allPicked}
                        onCheckedChange={on => setPicked(on ? new Set(rows.map(r => r.id)) : new Set())} />
                    </th>
                    <th className={cn(TH, 'text-left')} aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none'}>
                      <button type="button" onClick={() => setSort(s => (s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc'))}
                        className="inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-semibold text-inherit">
                        Campaign {sort === 'desc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden className={sort ? '' : 'opacity-60'} />}
                      </button>
                    </th>
                    <th className={cn(TH, 'text-left')}>Status</th>
                    <th className={cn(TH, 'text-center')}>Recipients</th>
                    <th className={cn(TH, 'text-center')}>Sent</th>
                    <th className={cn(TH, 'text-center')}>Opened</th>
                    <th className={cn(TH, 'text-center')}>Clicked</th>
                    <th className={cn(TH, 'text-center')}>Unsubscribed</th>
                    <th className={cn(TH, 'text-center')}>Date</th>
                    <th className={cn(TH, 'w-[68px]')}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-[13px] text-ui-text-secondary">No campaign matches these filters.</td></tr>
                  )}
                  {rows.map(c => {
                    const s = stats[c.id];
                    const when = c.finished_at ?? c.started_at ?? c.scheduled_at ?? c.created_at;
                    const open = () => router.push(`/marketing/email/${c.id}`);
                    const label = findStatusTag('email_campaign', c.status)?.label ?? c.status;
                    return (
                      <tr key={c.id} className="cursor-pointer border-b border-ui-divider last:border-b-0 hover:bg-ui-hover-bg" onClick={open}>
                        <td className={cn(TD, 'pl-[18px]')} onClick={e => e.stopPropagation()}>
                          <Checkbox aria-label={`Select ${c.name}`} checked={picked.has(c.id)} onCheckedChange={on => toggle(c.id, !!on)} />
                        </td>
                        <td className={TD}>
                          <Link href={`/marketing/email/${c.id}`} onClick={e => e.stopPropagation()}
                            className="flex max-w-[300px] items-end gap-1 font-semibold text-[var(--color-secondary-700)] no-underline dark:text-ui-heading">
                            <Mail size={16} className="mb-px shrink-0" aria-hidden />
                            <span className="truncate">{c.name}</span>
                          </Link>
                          <div className="max-w-[300px] truncate text-[10px] text-ui-text-secondary">{c.subject || 'No subject yet'}</div>
                        </td>
                        <td className={TD}>
                          <StatusBadge group="email_campaign" status={c.status} size="lg" className="h-7 gap-1 px-3 text-[12px] [&_svg]:size-4" />
                        </td>
                        <td className={NUM}>{c.recipient_count ? fmtNumber(c.recipient_count) : '—'}</td>
                        <td className={NUM}>{s ? fmtNumber(Number(s.sent)) : '—'}</td>
                        <td className={NUM}>{s ? fmtNumber(Number(s.opened)) : '—'}</td>
                        <td className={NUM}>{s ? fmtNumber(Number(s.clicked)) : '—'}</td>
                        <td className={NUM}>{s && Number(s.unsubscribed) ? fmtNumber(Number(s.unsubscribed)) : '—'}</td>
                        <td className={cn(NUM, 'whitespace-nowrap')}>
                          {mounted ? `${c.status === 'scheduled' ? 'Scheduled ' : ''}${DAY.format(new Date(when)).toUpperCase()}` : ''}
                        </td>
                        <td className={cn(TD, 'pr-5 text-right')} onClick={e => e.stopPropagation()}>
                          <Menu>
                            <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name} (${label})`} />}>
                              <Ellipsis />
                            </MenuTrigger>
                            <MenuContent>
                              <MenuItem onClick={open}><ExternalLink /> Open</MenuItem>
                              {canEdit && c.status !== 'sending' && (
                                <>
                                  <MenuSeparator />
                                  <MenuItem variant="destructive" onClick={() => setRemoving([c])}><Trash2 /> Delete</MenuItem>
                                </>
                              )}
                            </MenuContent>
                          </Menu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

      <ConfirmModal
        open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }}
        title={removing && removing.length > 1 ? `Delete ${removing.length} campaigns?` : 'Delete this campaign?'}
        description={removing?.length === 1 ? removing[0].name : undefined}
        tone="destructive" confirmLabel="Delete"
        warning={removing?.some(c => c.status === 'sending') ? 'Campaigns that are sending right now are skipped — pause or cancel them first.' : undefined}
        onConfirm={remove}
      />
    </div>
  );
}
