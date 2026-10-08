import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import { buildIndex, matchGroup, type ExistingContactRow, type ExistingProspectRow } from '@/lib/marketing/import/match';
import type { ImportGroup, ImportPerson } from '@/lib/marketing/import/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 60;

const MAX_GROUPS = 3000;
const PAGE = 1000;
const MAX_ROWS = 80_000; // safety valve for the "load everything to compare" scan

// Pages through a table by stable id order (a plain .select() stops at 1000 rows).
async function loadAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

function slimPerson(p: any): ImportPerson {
  return {
    sources: [], name: str(p?.name), title: null, company: str(p?.company),
    email: str(p?.email), email2: str(p?.email2), phone: str(p?.phone, 60), phone2: str(p?.phone2, 60),
    website: null, address: null, city: null, state: null, zip: null, businessTypes: [], notes: [], capturedBy: null, capturedAt: null,
  };
}

// Compares the import groups with what the CRM already holds. Read-only. Managers only: it scans
// every Contact's e-mail/phone, which a normal marketing user has no reason to do in bulk.
export async function POST(req: NextRequest) {
  const { admin, deny } = await requireRole(MARKETING_MANAGE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as { groups?: any[] } | null;
  const raw = Array.isArray(body?.groups) ? body!.groups! : [];
  if (!raw.length) return NextResponse.json({ error: 'No rows to check' }, { status: 400 });
  if (raw.length > MAX_GROUPS) return NextResponse.json({ error: `Too many rows (max ${MAX_GROUPS} per import)` }, { status: 413 });

  const groups: ImportGroup[] = raw.map((g, i) => ({
    id: str(g?.id, 40) ?? `g${i}`, company: str(g?.company), mergedRows: 0, warnings: [],
    people: (Array.isArray(g?.people) ? g.people : []).slice(0, 30).map(slimPerson),
  }));

  try {
    const [prospects, contacts] = await Promise.all([
      loadAll<ExistingProspectRow>((from, to) => admin.from('prospects')
        .select('id, display_name, organization_name, person_name, main_email, main_phone, business_types, source_label, website, created_at, external_created_at')
        .is('deleted_at', null).order('id').range(from, to)),
      loadAll<ExistingContactRow>((from, to) => admin.from('prospect_contacts')
        .select('id, prospect_id, name, title, email, phone, other_contact, is_primary').order('id').range(from, to)),
    ]);
    const idx = buildIndex(prospects, contacts);
    const matches: Record<string, ReturnType<typeof matchGroup>> = {};
    for (const g of groups) {
      const m = matchGroup(g, idx);
      if (m.length) matches[g.id] = m;
    }
    return NextResponse.json({ matches, scanned: { prospects: prospects.length, contacts: contacts.length } });
  } catch (e) {
    console.error('[import/match]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not compare with existing Contacts' }, { status: 500 });
  }
}
