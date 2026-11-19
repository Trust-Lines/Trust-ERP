'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { DealProgress } from '@/lib/sales/dealProgress';
import type { ContactOption, Deal, NeedFile, NeedInfo, NeedNote, ProjectInfo, ProspectInfo } from './types';

export type DealKind = 'opportunity' | 'potential';

export const dealApiBase = (kind: DealKind, id: string) => `/api/marketing/${kind === 'potential' ? 'potentials' : 'opportunities'}/${id}`;

/**
 * Everything the quick view loads in one request (deal row, lead, contacts, project, need, progress,
 * notes, files), plus field saves and Potential → Opportunity conversion.
 * Field saves are optimistic; a failed save reloads the record.
 */
export function useDealRecord({ apiBase, kind, opportunityId, onChanged }: {
  apiBase: string;
  kind: DealKind;
  opportunityId: string;
  onChanged?: (patch: Record<string, unknown>) => void;
}) {
  const [opp, setOpp] = useState<Deal | null>(null);
  const [prospect, setProspect] = useState<ProspectInfo | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  // Separate from `contacts` (that list is scoped to THIS record's own prospect) — once the
  // Contact field is re-linked via search to a contact belonging to a different Contact
  // entirely, its name has to be tracked independently to still render correctly.
  const [contactLabel, setContactLabel] = useState('');
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [need, setNeed] = useState<NeedInfo | null>(null);
  const [progress, setProgress] = useState<DealProgress | null>(null);
  const [notes, setNotes] = useState<NeedNote[]>([]);
  const [files, setFiles] = useState<NeedFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [tagOptions, setTagOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/marketing/opportunities/tag-options').then(r => r.json()).then(b => setTagOptions(b.options ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      const body = await res.json();
      const dealRow = (kind === 'potential' ? body.potential : body.opportunity) ?? null;
      setOpp(dealRow);
      setProspect(body.prospect ?? null);
      const contactList = body.contacts ?? [];
      setContacts(contactList);
      setContactLabel((contactList as ContactOption[]).find(c => c.id === dealRow?.primary_contact_id)?.name ?? '');
      setProject(body.project ?? null);
      setNeed(body.need ?? null);
      setProgress(body.progress ?? null);
      setNotes(body.notes ?? []);
      setFiles(body.files ?? []);
    } catch { }
    finally { setLoaded(true); }
  }, [apiBase, kind]);

  useEffect(() => { load(); }, [load]);

  async function saveField(name: string, value: unknown, extra?: Record<string, unknown>) {
    setOpp(prev => (prev ? { ...prev, [name]: value, ...extra } : prev));
    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [name]: value, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not save'); load(); return; }
      onChanged?.({ [name]: value, ...extra });
    } catch { toast.error('Could not save'); load(); }
    finally { setSaving(false); }
  }

  // Potential → Opportunity, handed to Sales (app/api/marketing/potentials/[id]/convert).
  // Called from the Convert popup; throwing keeps the popup open so the user can retry.
  async function convert() {
    setConverting(true);
    try {
      const res = await fetch(`/api/marketing/potentials/${opportunityId}/convert`, { method: 'POST' }).catch(() => null);
      const body = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) { toast.error(body.error ?? 'Could not convert'); throw new Error('convert failed'); }
      setOpp(prev => (prev ? { ...prev, status: 'converted', converted_opportunity_id: body.opportunity?.id } : prev));
      onChanged?.({ status: 'converted', converted_opportunity_id: body.opportunity?.id });
      toast.success(body.alreadyConverted ? 'Already converted' : 'Converted — it is now with Sales');
    } finally { setConverting(false); }
  }

  return {
    opp, prospect, contacts, contactLabel, setContactLabel, project, need, progress,
    notes, setNotes, files, setFiles, loaded, saving, converting, tagOptions,
    saveField, convert,
  };
}

export type DealRecord = ReturnType<typeof useDealRecord>;
