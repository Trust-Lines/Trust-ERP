'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Paperclip, X } from 'lucide-react';
import { Modal, ModalContent } from '@/components/ui/modal';
import {
  IT_FILE_MAX_BYTES,
  IT_TICKET_MAX_FILES,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from '@/lib/it/constants';
import { LABEL, PRIMARY_BTN, SECONDARY_BTN } from './ItItemFormDialog';
import { PRIORITY_LABEL } from './ticketStyles';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';

// The API takes "YYYY-MM-DD"; read and write it in local time so the picked day never shifts.
const toDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return iso ? new Date(y, m - 1, d) : null; };
const toIso = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';

const CATEGORY_OPTIONS = TICKET_CATEGORIES.map(c => ({ value: c, label: TICKET_CATEGORY_LABEL[c] }));
const PRIORITY_OPTIONS = TICKET_PRIORITIES.map(p => ({ value: p, label: PRIORITY_LABEL[p] }));

// IT → Tickets → New request: subject, category, priority, needed-by date, message and up to six
// files (screenshots, error logs). The ticket is created first, then each file goes up on its own.

async function errorOf(res: Response) {
  const j = await res.json().catch(() => null) as { error?: string } | null;
  return j?.error ?? `Request failed (${res.status})`;
}

export function ItNewTicketDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('hardware');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [neededBy, setNeededBy] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const tooBig = picked.filter(f => f.size > IT_FILE_MAX_BYTES);
    if (tooBig.length) toast.error(`Too large (max 4 MB): ${tooBig.map(f => f.name).join(', ')}`);
    setFiles(prev => [...prev, ...picked.filter(f => f.size <= IT_FILE_MAX_BYTES)].slice(0, IT_TICKET_MAX_FILES));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/it/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, category, priority, neededBy: neededBy || null, description }),
      });
      if (!res.ok) throw new Error(await errorOf(res));
      const { ticket } = await res.json() as { ticket: { id: string } };
      let failed = 0;
      for (const file of files) {
        const body = new FormData();
        body.append('file', file);
        const up = await fetch(`/api/it/tickets/${ticket.id}/files`, { method: 'POST', body });
        if (!up.ok) failed += 1;
      }
      if (failed) toast.error(`Request sent, but ${failed} file${failed > 1 ? 's' : ''} could not be uploaded`);
      else toast.success('Request sent to IT');
      onClose();
      router.push(`/it/tickets/${ticket.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the request');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <ModalContent size="lg" title="New IT request" description="IT sees it right away and gets a notification.">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div>
            <label htmlFor="itt-subject" className={LABEL}>Subject<span className="text-error-normal" aria-hidden>*</span></label>
            <Input id="itt-subject" required maxLength={160} autoFocus className="h-10 w-full" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Outlook does not open" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="itt-cat" className={LABEL}>Category</label>
              <Select id="itt-cat" className="h-10 w-full" value={category} options={CATEGORY_OPTIONS}
                onValueChange={v => { if (v) setCategory(v as TicketCategory); }} />
            </div>
            <div>
              <label htmlFor="itt-prio" className={LABEL}>Priority</label>
              <Select id="itt-prio" className="h-10 w-full" value={priority} options={PRIORITY_OPTIONS}
                onValueChange={v => { if (v) setPriority(v as TicketPriority); }} />
            </div>
            <div>
              <label htmlFor="itt-needed" className={LABEL}>Needed by</label>
              <DatePicker id="itt-needed" className="h-10 w-full" value={toDate(neededBy)} onValueChange={d => setNeededBy(toIso(d))} />
            </div>
          </div>
          <div>
            <label htmlFor="itt-desc" className={LABEL}>What happened?</label>
            <Textarea id="itt-desc" maxLength={4000} rows={5} className="w-full" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What you were doing, what you see, any error code…" />
          </div>
          <div className="flex flex-col gap-2">
            <span className={LABEL}>Files</span>
            {files.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-primary-50 px-3 py-1.5 text-[12px] text-ui-heading dark:bg-primary-700">
                    <span className="truncate">{f.name}</span>
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                      className="grid size-6 shrink-0 place-items-center rounded hover:bg-ui-hover-bg">
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {files.length < IT_TICKET_MAX_FILES && (
              <label className={`${SECONDARY_BTN} w-fit cursor-pointer gap-2`}>
                <Paperclip className="size-4" aria-hidden="true" />
                Attach files
                <input type="file" multiple className="sr-only" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              </label>
            )}
            <span className="text-[11px] text-ui-text-secondary">Up to {IT_TICKET_MAX_FILES} files, 4 MB each.</span>
          </div>
          <div className="flex justify-end gap-2 border-t border-ui-divider pt-4">
            <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BTN}>Cancel</button>
            <button type="submit" disabled={saving || !subject.trim()} className={PRIMARY_BTN}>{saving ? 'Sending…' : 'Send request'}</button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
