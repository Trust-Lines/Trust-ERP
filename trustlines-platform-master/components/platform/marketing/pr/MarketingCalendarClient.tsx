'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/feedback-states';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { CALENDAR_KINDS, calendarKindLabel, daysBetween, monthGridRange } from '@/lib/marketing/prWorkspace';
import type { CalendarEntryRow, CampaignOption, SocialPostRow } from '@/lib/marketing/prWorkspaceServer';
import type { StatusTone } from '@/lib/status/tags';
import { Field, PANEL, PageHeading, fmtDay, localToday, sendJson } from './shared';

type CalendarPost = Pick<SocialPostRow, 'id' | 'title' | 'status' | 'planned_on' | 'published_on' | 'account_id'>;
interface CalendarData { from: string; to: string; entries: CalendarEntryRow[]; posts: CalendarPost[]; campaigns: CampaignOption[] }

interface Props {
  initialMonth: string; // YYYY-MM
  initial: CalendarData | null;
  campaigns: CampaignOption[];
  canEdit: boolean;
  isManager: boolean;
  userId: string;
  loadError: string | null;
}

/** One thing drawn on a day: a team entry, a social post or a campaign. */
interface DayItem {
  key: string;
  label: string;
  time: string | null;
  tone: StatusTone;
  kindLabel: string;
  entry?: CalendarEntryRow;
  href?: string;
}

const KIND_TONE: Record<string, StatusTone> = { event: 't2', press: 't3', meeting: 't1', deadline: 't10', content: 't4', other: 't0' };
const POST_TONE: StatusTone = 't6';
const CAMPAIGN_TONE: StatusTone = 't7';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_TITLE = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const MAX_PER_CELL = 3;

type EntryForm = { title: string; kind: string; starts_on: string; ends_on: string; start_time: string; end_time: string; location: string; notes: string; campaign_id: string };
const emptyEntry = (day: string): EntryForm => ({ title: '', kind: 'event', starts_on: day, ends_on: '', start_time: '', end_time: '', location: '', notes: '', campaign_id: '' });
const toEntryForm = (e: CalendarEntryRow): EntryForm => ({
  title: e.title, kind: e.kind, starts_on: e.starts_on, ends_on: e.ends_on ?? '', start_time: e.start_time?.slice(0, 5) ?? '',
  end_time: e.end_time?.slice(0, 5) ?? '', location: e.location ?? '', notes: e.notes ?? '', campaign_id: e.campaign_id ?? '',
});

function shiftMonth(month: string, by: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

const toneStyle = (tone: StatusTone) => ({ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` });

export function MarketingCalendarClient({ initialMonth, initial, campaigns, canEdit, isManager, userId, loadError }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<CalendarData | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(loadError);
  const [today, setToday] = useState<string | null>(null);
  const [entryEdit, setEntryEdit] = useState<{ id: string | null; createdBy: string | null; form: EntryForm } | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CalendarEntryRow | null>(null);

  useEffect(() => { setToday(localToday()); }, []);

  async function load(m: string) {
    setLoading(true);
    try {
      setData(await sendJson<CalendarData>(`/api/marketing/calendar?month=${m}`, 'GET'));
      setError(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load the calendar');
    } finally {
      setLoading(false);
    }
  }

  function goTo(m: string) {
    setMonth(m);
    // Keep the month in the address so a link or a refresh opens the same view.
    window.history.replaceState(null, '', `?month=${m}`);
    load(m);
  }

  const range = useMemo(() => monthGridRange(month), [month]);
  const days = useMemo(() => daysBetween(range.from, range.to), [range]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const add = (day: string, item: DayItem) => map.set(day, [...(map.get(day) ?? []), item]);
    if (!data) return map;
    for (const e of data.entries) {
      for (const day of daysBetween(e.starts_on, e.ends_on ?? e.starts_on)) {
        add(day, {
          key: `e-${e.id}`, label: e.title, time: day === e.starts_on ? e.start_time?.slice(0, 5) ?? null : null,
          tone: KIND_TONE[e.kind] ?? 't0', kindLabel: calendarKindLabel(e.kind), entry: e,
        });
      }
    }
    for (const p of data.posts) {
      const day = p.status === 'published' ? p.published_on ?? p.planned_on : p.planned_on;
      if (!day || p.status === 'cancelled') continue;
      add(day, { key: `p-${p.id}`, label: p.title, time: null, tone: POST_TONE, kindLabel: p.status === 'published' ? 'Post · published' : 'Post · planned', href: `/marketing/social?post=${p.id}` });
    }
    for (const c of data.campaigns) {
      if (!c.start_date) continue;
      for (const day of daysBetween(c.start_date, c.end_date ?? c.start_date)) {
        add(day, { key: `c-${c.id}`, label: c.name, time: null, tone: CAMPAIGN_TONE, kindLabel: 'Campaign', href: `/marketing/campaigns/${c.id}` });
      }
    }
    // Timed items first, by time; then all-day items.
    for (const list of map.values()) list.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
    return map;
  }, [data]);

  const monthDays = days.filter(d => d.startsWith(month));
  const agenda = monthDays.filter(d => itemsByDay.get(d)?.length);
  const campaignOptions = [{ value: '', label: 'No campaign' }, ...campaigns.map(c => ({ value: c.id, label: c.name }))];

  function openNew(day: string) {
    if (canEdit) setEntryEdit({ id: null, createdBy: userId, form: emptyEntry(day) });
  }
  function openItem(item: DayItem) {
    if (item.entry) setEntryEdit({ id: item.entry.id, createdBy: item.entry.created_by, form: toEntryForm(item.entry) });
  }

  async function saveEntry() {
    if (!entryEdit) return;
    const { id, form } = entryEdit;
    if (!form.title.trim() || !form.starts_on) { toast.error('Title and start date are required'); return; }
    try {
      await sendJson(id ? `/api/marketing/calendar/${id}` : '/api/marketing/calendar', id ? 'PATCH' : 'POST', form);
      toast.success(id ? 'Entry saved' : 'Added to the calendar');
      setEntryEdit(null);
      await load(month);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await sendJson(`/api/marketing/calendar/${toDelete.id}`, 'DELETE');
      toast.success('Entry deleted');
      setToDelete(null);
      setEntryEdit(null);
      await load(month);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
      throw e;
    }
  }

  const heading = (
    <PageHeading
      trail={[{ label: 'Marketing', href: '/marketing' }, { label: 'Calendar', href: '/marketing/calendar' }]}
      title="Calendar"
      subtitle="Events, press, meetings and deadlines for the Marketing & PR team, with planned posts and campaigns."
      actions={canEdit && !error && <Button onClick={() => openNew(today ?? `${month}-01`)}><Plus /> New entry</Button>}
    />
  );

  if (error && !data) {
    return (
      <div className="flex flex-col gap-[30px]">
        {heading}
        <div className={cn(PANEL, 'p-6')}><ErrorState title="The calendar isn’t available" description={error} /></div>
      </div>
    );
  }

  const canDeleteEntry = (createdBy: string | null) => canEdit && (isManager || createdBy === userId);

  return (
    <div className="flex flex-col gap-[30px]">
      {heading}

      <div className={cn(PANEL, 'flex flex-col gap-4 p-4 sm:p-6')} aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => goTo(shiftMonth(month, -1))}><ChevronLeft /></Button>
            <h2 className="m-0 min-w-[150px] text-center text-[16px] font-semibold text-ui-heading">{MONTH_TITLE.format(new Date(`${month}-01T00:00:00Z`))}</h2>
            <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => goTo(shiftMonth(month, 1))}><ChevronRight /></Button>
            {today && !today.startsWith(month) && <Button variant="secondary" size="sm" onClick={() => goTo(today.slice(0, 7))}>Today</Button>}
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Legend">
            {[...CALENDAR_KINDS.map(k => ({ label: k.label, tone: KIND_TONE[k.value] })), { label: 'Social post', tone: POST_TONE }, { label: 'Campaign', tone: CAMPAIGN_TONE }].map(l => (
              <li key={l.label} className="rounded-tag px-2 py-0.5 text-[10px] font-medium" style={toneStyle(l.tone)}>{l.label}</li>
            ))}
          </ul>
        </div>

        {/* Month grid (tablet and up). */}
        <div className={cn('hidden md:block', loading && 'opacity-60')}>
          <div className="grid grid-cols-7 border-b border-ui-divider">
            {WEEKDAYS.map(d => <div key={d} className="px-2 py-1.5 text-[11px] font-medium text-ui-text-secondary">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 grid-rows-6">
            {days.map(day => {
              const items = itemsByDay.get(day) ?? [];
              const inMonth = day.startsWith(month);
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={cn('group relative flex min-h-[112px] flex-col gap-1 border-b border-r border-ui-divider p-1.5 [&:nth-child(7n+1)]:border-l', !inMonth && 'bg-ui-hover-bg/40')}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('grid size-6 place-items-center rounded-full text-[11px]', isToday ? 'bg-primary-950 font-semibold text-primary-50 dark:bg-primary-50 dark:text-primary-950' : inMonth ? 'text-ui-body' : 'text-ui-text-secondary opacity-60')}>
                      {Number(day.slice(8))}
                    </span>
                    {canEdit && (
                      <button type="button" aria-label={`Add an entry on ${fmtDay(day)}`} onClick={() => openNew(day)}
                        className="grid size-5 cursor-pointer place-items-center rounded-[4px] border-0 bg-transparent text-ui-text-secondary opacity-0 hover:bg-ui-hover-bg focus-visible:opacity-100 group-hover:opacity-100">
                        <Plus size={13} />
                      </button>
                    )}
                  </div>
                  {items.slice(0, MAX_PER_CELL).map(item => <ItemChip key={item.key} item={item} onOpen={openItem} />)}
                  {items.length > MAX_PER_CELL && (
                    <button type="button" onClick={() => setDayOpen(day)}
                      className="cursor-pointer border-0 bg-transparent p-0 text-left text-[11px] font-medium text-ui-link hover:underline">
                      +{items.length - MAX_PER_CELL} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Agenda (phones): only the days of this month that have something on them. */}
        <div className="md:hidden">
          {agenda.length === 0 ? (
            <EmptyState icon={<CalendarDays />} title="Nothing planned this month" description={canEdit ? 'Tap “New entry” to add an event, press date or deadline.' : undefined} />
          ) : (
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {agenda.map(day => (
                <li key={day}>
                  <div className={cn('mb-1.5 text-[12px] font-semibold', day === today ? 'text-ui-nav-active' : 'text-ui-heading')}>{fmtDay(day)}</div>
                  <div className="flex flex-col gap-1.5">{(itemsByDay.get(day) ?? []).map(item => <ItemChip key={item.key} item={item} onOpen={openItem} large />)}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Everything on one day (from "+N more"). */}
      <Modal open={!!dayOpen} onOpenChange={o => { if (!o) setDayOpen(null); }}>
        {dayOpen && (
          <ModalContent
            title={fmtDay(dayOpen)}
            footer={canEdit && <Button onClick={() => { const d = dayOpen; setDayOpen(null); openNew(d); }}><Plus /> Add entry</Button>}
          >
            <div className="flex flex-col gap-1.5">
              {(itemsByDay.get(dayOpen) ?? []).map(item => <ItemChip key={item.key} item={item} onOpen={i => { setDayOpen(null); openItem(i); }} large />)}
            </div>
          </ModalContent>
        )}
      </Modal>

      {/* Add / edit an entry. */}
      <Modal open={!!entryEdit} onOpenChange={o => { if (!o) setEntryEdit(null); }}>
        {entryEdit && (
          <ModalContent
            size="lg"
            title={entryEdit.id ? 'Edit entry' : 'New calendar entry'}
            footer={canEdit && (
              <>
                {entryEdit.id && canDeleteEntry(entryEdit.createdBy) && (
                  <Button variant="ghost" className="mr-auto text-error-normal"
                    onClick={() => { const e = data?.entries.find(x => x.id === entryEdit.id); if (e) setToDelete(e); }}>
                    <Trash2 /> Delete
                  </Button>
                )}
                <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
                <Button onClick={saveEntry}>{entryEdit.id ? 'Save entry' : 'Add entry'}</Button>
              </>
            )}
          >
            <EntryFields
              form={entryEdit.form} disabled={!canEdit} campaignOptions={campaignOptions}
              onChange={patch => setEntryEdit(x => (x ? { ...x, form: { ...x.form, ...patch } } : x))}
            />
          </ModalContent>
        )}
      </Modal>

      <ConfirmModal
        open={!!toDelete} onOpenChange={o => { if (!o) setToDelete(null); }}
        title="Delete this entry?" description={toDelete ? `${toDelete.title} · ${fmtDay(toDelete.starts_on)}` : undefined}
        tone="destructive" confirmLabel="Delete entry" onConfirm={confirmDelete}
      />
    </div>
  );
}

function ItemChip({ item, onOpen, large = false }: { item: DayItem; onOpen: (item: DayItem) => void; large?: boolean }) {
  const cls = cn(
    'flex w-full min-w-0 items-center gap-1 rounded-[4px] border-0 text-left font-medium no-underline hover:brightness-95',
    large ? 'px-2.5 py-2 text-[12px]' : 'px-1.5 py-0.5 text-[11px]',
  );
  const body = (
    <>
      {item.time && <span className="shrink-0 tabular-nums opacity-80">{item.time}</span>}
      <span className="truncate">{item.label}</span>
      {large && <span className="ml-auto shrink-0 text-[10px] opacity-80">{item.kindLabel}</span>}
    </>
  );
  const title = `${item.kindLabel}: ${item.label}`;
  if (item.href) return <Link href={item.href} className={cls} style={toneStyle(item.tone)} title={title}>{body}</Link>;
  return <button type="button" className={cn(cls, 'cursor-pointer')} style={toneStyle(item.tone)} title={title} onClick={() => onOpen(item)}>{body}</button>;
}

function EntryFields({ form, disabled, campaignOptions, onChange }: {
  form: EntryForm; disabled: boolean; campaignOptions: { value: string; label: string }[]; onChange: (patch: Partial<EntryForm>) => void;
}) {
  return (
    <fieldset disabled={disabled} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <Field label="Title" htmlFor="cal-title">
        <Input id="cal-title" placeholder="e.g. NACS Show 2026" value={form.title} onChange={e => onChange({ title: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type">
          <Select aria-label="Type" value={form.kind} options={CALENDAR_KINDS.map(k => ({ value: k.value, label: k.label }))} onValueChange={v => onChange({ kind: v ?? 'other' })} disabled={disabled} />
        </Field>
        <Field label="Campaign">
          <Select aria-label="Campaign" value={form.campaign_id} options={campaignOptions} onValueChange={v => onChange({ campaign_id: v ?? '' })} disabled={disabled} />
        </Field>
        <Field label="Start date" htmlFor="cal-start">
          <Input id="cal-start" type="date" value={form.starts_on} onChange={e => onChange({ starts_on: e.target.value })} />
        </Field>
        <Field label="End date" htmlFor="cal-end" hint="Only for entries that run over several days.">
          <Input id="cal-end" type="date" min={form.starts_on || undefined} value={form.ends_on} onChange={e => onChange({ ends_on: e.target.value })} />
        </Field>
        <Field label="Start time" htmlFor="cal-st" hint="Leave empty for an all-day entry.">
          <div className="relative">
            <Clock size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
            <Input id="cal-st" type="time" className="pl-7" value={form.start_time} onChange={e => onChange({ start_time: e.target.value })} />
          </div>
        </Field>
        <Field label="End time" htmlFor="cal-et">
          <Input id="cal-et" type="time" value={form.end_time} onChange={e => onChange({ end_time: e.target.value })} />
        </Field>
      </div>
      <Field label="Location" htmlFor="cal-loc">
        <div className="relative">
          <MapPin size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
          <Input id="cal-loc" className="pl-7" placeholder="e.g. Las Vegas Convention Center, booth 1234" value={form.location} onChange={e => onChange({ location: e.target.value })} />
        </div>
      </Field>
      <Field label="Notes" htmlFor="cal-notes">
        <Textarea id="cal-notes" rows={4} placeholder="Agenda, who attends, what to bring…" value={form.notes} onChange={e => onChange({ notes: e.target.value })} />
      </Field>
    </fieldset>
  );
}
