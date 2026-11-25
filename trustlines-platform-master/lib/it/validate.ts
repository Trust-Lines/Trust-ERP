// Input checks for the IT API routes (pure, unit-tested in tests/itValidate.test.ts).
import {
  COMPUTER_CATEGORIES,
  ITEM_CATEGORIES,
  ITEM_STATUSES,
  IT_LOCATIONS,
  SPEC_KEYS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type ItemCategory,
  type ItemStatus,
  type TicketCategory,
  type TicketPriority,
} from './constants';

type Result<T> = { value: T; error: null } | { value: null; error: string };
const ok = <T>(value: T): Result<T> => ({ value, error: null });
const fail = <T>(error: string): Result<T> => ({ value: null, error });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Trimmed text, null when empty; error when longer than `max`. */
function text(v: unknown, max: number, label: string): Result<string | null> {
  if (v == null) return ok(null);
  if (typeof v !== 'string') return fail(`${label} must be text`);
  const t = v.trim();
  if (!t) return ok(null);
  if (t.length > max) return fail(`${label} is too long (max ${max} characters)`);
  return ok(t);
}

export interface TicketInput {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string | null;
  needed_by: string | null;
}

export function cleanTicketInput(body: unknown): Result<TicketInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const subject = text(b.subject, 160, 'Subject');
  if (subject.error) return fail(subject.error);
  if (!subject.value) return fail('Subject is required');
  if (!TICKET_CATEGORIES.includes(b.category as TicketCategory)) return fail('Choose a category');
  const priority = (b.priority ?? 'medium') as TicketPriority;
  if (!TICKET_PRIORITIES.includes(priority)) return fail('Choose a priority');
  const description = text(b.description, 4000, 'Description');
  if (description.error) return fail(description.error);
  let neededBy: string | null = null;
  if (b.neededBy != null && b.neededBy !== '') {
    if (typeof b.neededBy !== 'string' || !isDate(b.neededBy)) return fail('Needed by must be a date (yyyy-mm-dd)');
    neededBy = b.neededBy;
  }
  return ok({ subject: subject.value, category: b.category as TicketCategory, priority, description: description.value, needed_by: neededBy });
}

export interface ResolutionInput {
  status: 'solved' | 'not_solved';
  note: string | null;
}

/** Closing a ticket: solved, or not solved with a note saying why. */
export function cleanResolution(body: unknown): Result<ResolutionInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.status !== 'solved' && b.status !== 'not_solved') return fail('Mark the ticket solved or not solved');
  const note = text(b.note, 4000, 'Notes');
  if (note.error) return fail(note.error);
  if (b.status === 'not_solved' && !note.value) return fail('Write a note saying why it was not solved');
  return ok({ status: b.status, note: note.value });
}

/** A host Remote Desktop can reach: a LAN / Tailscale MagicDNS name or an IPv4 / IPv6 address. */
export function isRemoteAddress(v: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9.\-:]{0,251}[A-Za-z0-9])?$/.test(v) && !v.includes('..');
}

export interface ItemInput {
  name: string;
  model: string | null;
  category: ItemCategory;
  location: string | null;
  status: ItemStatus;
  assignee_id: string | null;
  /** Held by someone with no account yet (assignee_id null) — migration 164. */
  holder_name: string | null;
  set_label: string | null;
  notes: string | null;
  specs: Record<string, string>;
  remote_address: string | null;
}

/** A whole item from the Add / Edit form. Specs and remote address only stay on computers. */
export function cleanItemInput(body: unknown): Result<ItemInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = text(b.name, 120, 'Name');
  if (name.error) return fail(name.error);
  if (!name.value) return fail('Name is required');
  if (!ITEM_CATEGORIES.includes(b.category as ItemCategory)) return fail('Choose a category');
  const category = b.category as ItemCategory;
  const model = text(b.model, 120, 'Type');
  if (model.error) return fail(model.error);
  const location = text(b.location, 60, 'Location');
  if (location.error) return fail(location.error);
  if (location.value && !(IT_LOCATIONS as readonly string[]).includes(location.value)) return fail('Choose an office');
  const status = (b.status ?? 'available') as ItemStatus;
  if (!ITEM_STATUSES.includes(status)) return fail('Choose a status');
  let assignee: string | null = null;
  let holderName: string | null = null;
  if (status === 'assigned') {
    if (isUuid(b.assigneeId)) assignee = b.assigneeId;
    else {
      const typed = text(b.holderName, 120, 'Holder name');
      if (typed.error) return fail(typed.error);
      if (!typed.value) return fail('Choose who holds the item, or type their name');
      holderName = typed.value;
    }
  }
  const setLabel = text(b.setLabel, 40, 'Set');
  if (setLabel.error) return fail(setLabel.error);
  const notes = text(b.notes, 2000, 'Notes');
  if (notes.error) return fail(notes.error);

  const computer = COMPUTER_CATEGORIES.includes(category);
  const specs: Record<string, string> = {};
  if (computer && b.specs && typeof b.specs === 'object') {
    for (const k of SPEC_KEYS) {
      const v = text((b.specs as Record<string, unknown>)[k], 120, k.toUpperCase());
      if (v.error) return fail(v.error);
      if (v.value) specs[k] = v.value;
    }
  }
  let remote: string | null = null;
  if (computer) {
    const r = text(b.remoteAddress, 253, 'Remote address');
    if (r.error) return fail(r.error);
    if (r.value && !isRemoteAddress(r.value)) return fail('Remote address must be a computer name or IP (e.g. pc-ahmet or 100.64.0.12)');
    remote = r.value;
  }
  return ok({
    name: name.value, model: model.value, category, location: location.value, status,
    assignee_id: assignee, holder_name: holderName, set_label: setLabel.value, notes: notes.value, specs, remote_address: remote,
  });
}

/** A .rdp file that opens Windows Remote Desktop on `host` and asks for the password. */
export function rdpFile(host: string): string {
  return [
    `full address:s:${host}`,
    'prompt for credentials:i:1',
    'screen mode id:i:2',
    'use multimon:i:0',
    'redirectclipboard:i:1',
    'audiomode:i:0',
    'authentication level:i:2',
    '',
  ].join('\r\n');
}

/** File name safe for a Dropbox path and a download header. */
export function safeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(-120);
  return base && base !== '.' && base !== '..' ? base : 'file';
}
