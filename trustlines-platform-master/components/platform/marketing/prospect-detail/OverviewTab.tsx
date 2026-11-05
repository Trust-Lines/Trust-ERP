'use client';

import { Pencil, ClipboardList, CircleDashed, SquareArrowOutUpRight } from 'lucide-react';
import { SOURCE_LABEL, OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import type { NeedClassification } from '@/types/database';
import { ProfileForm } from './ProfileForm';
import { NEED_CLASSIFICATION_LABEL, type Contact, type Need, type OpportunityRow, type Prospect, type ProspectLocation } from './types';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

// Figma "Lead Profile" overview (336:22028): Profile card (4-column fields, pencil to edit) and
// Project Needs card (needs list with stage chips, "View All" opens the Needs tab).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CARD = 'flex flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-page-bg p-3.5';
const CARD_TITLE = cn('m-0 text-[16px] font-semibold leading-[1.45]', HEADING);
// Primary navy button (near-white in dark), as the frame's pencil and "View All".
const PRIMARY = 'inline-flex cursor-pointer items-center justify-center gap-2 rounded-[6px] border-0 bg-[var(--color-secondary-700)] text-[13px] font-semibold text-white transition-opacity hover:opacity-90 dark:bg-primary-50 dark:text-primary-950';
const NEED_TONE: Record<NeedClassification, string> = { unclassified: 't0', potential: 't7', opportunity: 't7', disqualified: 't10' };
const STAGE_TONE: Partial<Record<OpportunityRow['stage'], string>> = { closed_won: 't9', closed_lost: 't10', on_hold: 't0' };

function ProfileField({ label, value, className }: { label: string; value: string | null; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[12px] font-medium leading-4 text-ui-body">{label}</span>
      <span className={cn('whitespace-pre-wrap break-words text-[13px] font-semibold leading-[1.5] tracking-[-0.286px]', HEADING)}>{value || '-'}</span>
    </div>
  );
}

export function OverviewTab({
  prospect, primaryContact, primaryLocation, showsAttended, needs, opportunities, onOpenNeed, canEdit,
  editingProfile, setEditingProfile, onPatch, onUpdateContact, onViewNeeds,
}: {
  prospect: Prospect;
  primaryContact: Contact | null;
  primaryLocation: ProspectLocation | null;
  showsAttended: string[];
  needs: Need[];
  opportunities: OpportunityRow[];
  onOpenNeed: (id: string) => void;
  canEdit?: boolean;
  editingProfile: boolean;
  setEditingProfile: (editing: boolean) => void;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onUpdateContact: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  onViewNeeds: () => void;
}) {
  const source = prospect.source_raw_label || (prospect.source_label ? (SOURCE_LABEL[prospect.source_label as keyof typeof SOURCE_LABEL] ?? prospect.source_label) : null);

  return (
    <div className="flex flex-col gap-4">
      <section className={CARD}>
        <div className="flex min-h-9 items-center justify-between gap-3 border-b border-ui-divider pb-3.5">
          <h2 className={CARD_TITLE}>Profile</h2>
          {canEdit && !editingProfile && (
            <button type="button" className={cn(PRIMARY, 'size-9')} onClick={() => setEditingProfile(true)} aria-label="Edit profile" title="Edit profile">
              <Pencil size={16} aria-hidden />
            </button>
          )}
        </div>
        {editingProfile ? (
          <ProfileForm
            prospect={prospect}
            primaryContact={primaryContact}
            onSave={payload => onPatch(payload).then(() => setEditingProfile(false))}
            onSaveContact={payload => (primaryContact ? onUpdateContact(primaryContact.id, payload) : Promise.resolve(false))}
            onCancel={() => setEditingProfile(false)}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-2 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
              <ProfileField label="01 - State" value={primaryLocation?.state ?? null} />
              <ProfileField label="02 - Phone" value={prospect.main_phone} />
              <ProfileField label="03 - Email" value={prospect.main_email} />
              <ProfileField label="04 - Role/Position" value={primaryContact?.title ?? null} />
              <ProfileField label="05 - LinkedIn" value={primaryContact?.linkedin_url ?? null} />
              <ProfileField label="06 - Company" value={prospect.organization_name || prospect.person_name} />
              <ProfileField label="07 - Other contact" value={primaryContact?.other_contact ?? null} />
              <ProfileField label="08 - Business type" value={(prospect.business_types ?? []).join(', ') || null} />
              <ProfileField label="09 - Website" value={prospect.website} />
              <ProfileField label="10 - Shows attended" value={showsAttended.join(', ') || null} />
              <ProfileField label="11 - Location" value={primaryLocation?.address_line_1 || null} />
              <ProfileField label="12 - Mailing address" value={primaryLocation?.mailing_address || null} />
              <ProfileField label="13 - Source" value={source} />
              <ProfileField label="14 - Source info" value={prospect.source_detail ?? null} />
              <ProfileField label="WhatsApp" value={primaryContact?.whatsapp ? 'Yes' : 'No'} />
              <ProfileField label="Company 2 Phone Number" value={primaryContact?.company2_phone ?? null} />
              <ProfileField label="Created by" value={prospect.created_by_label ?? null} />
              <ProfileField label="x-Note" value={prospect.x_note ?? null} className="sm:col-span-1 xl:col-span-3" />
            </div>
            <div className="flex flex-wrap gap-4 border-t border-ui-divider pt-3 text-[11.5px] text-ui-text-secondary">
              <span>Created {new Date(prospect.external_created_at ?? prospect.created_at).toLocaleDateString('en-US')}</span>
              <span>Last updated {new Date(prospect.updated_at).toLocaleDateString('en-US')}</span>
            </div>
          </>
        )}
      </section>

      <section className={CARD}>
        <div className="flex min-h-9 items-center justify-between gap-3 border-b border-ui-divider pb-3.5">
          <h2 className={CARD_TITLE}>Project Needs</h2>
          <button type="button" className={cn(PRIMARY, 'h-9 px-5')} onClick={onViewNeeds}>
            View All <SquareArrowOutUpRight size={16} aria-hidden />
          </button>
        </div>
        {needs.length === 0 ? (
          <EmptyState size="sm" className="py-0" icon={<ClipboardList />} title="No project needs captured yet." description="A Lead may have zero, one, or many — each classified independently." />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 rounded-[10px] bg-ui-surface p-2">
            {needs.map(n => {
              const stage = opportunities.find(o => o.need_id === n.id)?.stage;
              const tone = stage ? STAGE_TONE[stage] ?? 't7' : NEED_TONE[n.classification];
              return (
                <li key={n.id}>
                  <button
                    type="button" onClick={() => onOpenNeed(n.id)}
                    className="flex w-full cursor-pointer flex-col items-start gap-2 rounded-[6px] border-0 bg-ui-page-bg px-5 py-3 text-left transition-colors hover:bg-ui-hover-bg"
                  >
                    <span className="flex w-full flex-col gap-[3px] leading-[1.4]">
                      <span className="truncate text-[13px] font-semibold text-ui-body">{n.title}</span>
                      {(n.description || n.source) && <span className="truncate text-[11px] text-ui-text-secondary">{n.description || n.source}</span>}
                    </span>
                    <span className="inline-flex max-w-full items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4" style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>
                      <CircleDashed size={14} aria-hidden className="shrink-0" />
                      <span className="truncate">{stage ? OPPORTUNITY_STAGE_LABEL[stage] : NEED_CLASSIFICATION_LABEL[n.classification]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
