'use client';

import { Pencil, ClipboardList } from 'lucide-react';
import { SOURCE_LABEL } from '@/lib/marketing/classification';
import { Field, NeedClassificationPill } from './shared';
import { ProfileForm } from './ProfileForm';
import type { Contact, Need, Prospect, ProspectLocation } from './types';
import { EmptyState } from '@/components/ui/empty-state';

export function OverviewTab({
  prospect, primaryContact, primaryLocation, showsAttended, needs, canEdit,
  editingProfile, setEditingProfile, onPatch, onUpdateContact, onViewNeeds,
}: {
  prospect: Prospect;
  primaryContact: Contact | null;
  primaryLocation: ProspectLocation | null;
  showsAttended: string[];
  needs: Need[];
  canEdit?: boolean;
  editingProfile: boolean;
  setEditingProfile: (editing: boolean) => void;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onUpdateContact: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  onViewNeeds: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card">
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Profile</div>
          {canEdit && !editingProfile && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingProfile(true)}><Pencil size={12} /> Edit</button>
          )}
        </div>
        <div className="card-body">
          {editingProfile ? (
            <ProfileForm
              prospect={prospect}
              primaryContact={primaryContact}
              onSave={payload => onPatch(payload).then(() => setEditingProfile(false))}
              onSaveContact={payload => (primaryContact ? onUpdateContact(primaryContact.id, payload) : Promise.resolve(false))}
              onCancel={() => setEditingProfile(false)}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
              <Field label="01 - State" value={primaryLocation?.state ?? null} />
              <Field label="02 - Phone" value={prospect.main_phone} />
              <Field label="03 - Email" value={prospect.main_email} />
              <Field label="04 - Role/Position" value={primaryContact?.title ?? null} />
              <Field label="05 - LinkedIn" value={primaryContact?.linkedin_url ?? null} />
              <Field label="06 - Company" value={prospect.organization_name || prospect.person_name} />
              <Field label="07 - Other contact" value={primaryContact?.other_contact ?? null} />
              <Field label="08 - Business type" value={(prospect.business_types ?? []).join(', ') || null} />
              <Field label="09 - Website" value={prospect.website} />
              <Field label="10 - Shows attended" value={showsAttended.join(', ') || null} />
              <Field label="11 - Location" value={primaryLocation?.address_line_1 || null} />
              <Field label="12 - Mailing address" value={primaryLocation?.mailing_address || null} />
              <Field label="13 - Source" value={prospect.source_raw_label || (prospect.source_label ? (SOURCE_LABEL[prospect.source_label as keyof typeof SOURCE_LABEL] ?? prospect.source_label) : null)} />
              <Field label="14 - Source info" value={prospect.source_detail ?? null} />
              <Field label="Created by" value={prospect.created_by_label ?? null} />
              <Field label="Company 2 Phone Number" value={primaryContact?.company2_phone ?? null} />
              <Field label="WhatsApp" value={primaryContact?.whatsapp ? 'Yes' : 'No'} />
              <Field label="x-Note" value={prospect.x_note ?? null} />
            </div>
          )}
        </div>
        {!editingProfile && (
          <div style={{ display: 'flex', gap: 16, padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, color: 'var(--fg-faint)' }}>
            <span>Created {new Date(prospect.external_created_at ?? prospect.created_at).toLocaleDateString('en-US')}</span>
            <span>Last updated {new Date(prospect.updated_at).toLocaleDateString('en-US')}</span>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Project needs</div>
          <button className="btn btn-ghost btn-sm" onClick={onViewNeeds}>View all →</button>
        </div>
        <div className="card-body" style={{ fontSize: 12.5, color: 'var(--fg-subtle)' }}>
          {needs.length === 0 ? (
            <EmptyState size="sm" className="py-0" icon={<ClipboardList />} title="No project needs captured yet." description="A Lead may have zero, one, or many — each classified independently." />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {needs.map(n => (
                <span key={n.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--fg-default)' }}>{n.title}</span> <NeedClassificationPill c={n.classification} />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
