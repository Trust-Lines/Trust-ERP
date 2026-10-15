'use client';

import { useState, useEffect } from 'react';
import { Building2, Users, Globe, Tag } from 'lucide-react';
import { SourceSelect } from '../SourceSelect';
import { TagMultiSelect } from '../TagMultiSelect';
import { hashColor } from '@/lib/marketing/pillColor';
import { type Contact, type Prospect } from './types';
import { FieldSection, FormShell } from './shared';

export function ProfileForm({ prospect, primaryContact, onSave, onSaveContact, onCancel }: {
  prospect: Prospect; primaryContact: Contact | null;
  onSave: (p: Record<string, unknown>) => Promise<void>;
  onSaveContact: (c: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [organizationName, setOrganizationName] = useState(prospect.organization_name ?? '');
  const [personName, setPersonName] = useState(prospect.person_name ?? '');
  const [businessTypes, setBusinessTypes] = useState<string[]>(prospect.business_types ?? []);
  const [businessTypeOptions, setBusinessTypeOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/marketing/prospects/business-type-options').then(r => r.json()).then(b => setBusinessTypeOptions(b.options ?? [])).catch(() => {});
  }, []);
  const [tags, setTags] = useState<string[]>((prospect.tags ?? []).map(t => t.name));
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/marketing/prospects/tag-options').then(r => r.json()).then(b => setTagOptions(b.options ?? [])).catch(() => {});
  }, []);
  const [industry, setIndustry] = useState(prospect.industry ?? '');
  const [website, setWebsite] = useState(prospect.website ?? '');
  const [mainEmail, setMainEmail] = useState(prospect.main_email ?? '');
  const [mainPhone, setMainPhone] = useState(prospect.main_phone ?? '');
  const [companySize, setCompanySize] = useState(prospect.company_size ?? '');
  const [xNote, setXNote] = useState(prospect.x_note ?? '');
  const [sourceRawLabel, setSourceRawLabel] = useState(prospect.source_raw_label ?? '');
  const [sourceDetail, setSourceDetail] = useState(prospect.source_detail ?? '');
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/marketing/prospects/source-options').then(r => r.json()).then(b => setSourceOptions(b.options ?? [])).catch(() => {});
  }, []);
  const [role, setRole] = useState(primaryContact?.title ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(primaryContact?.linkedin_url ?? '');
  const [otherContact, setOtherContact] = useState(primaryContact?.other_contact ?? '');
  const [company2Phone, setCompany2Phone] = useState(primaryContact?.company2_phone ?? '');
  const [whatsapp, setWhatsapp] = useState(primaryContact?.whatsapp ?? false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onSave({
      organization_name: organizationName.trim() || null, person_name: personName.trim() || null,
      business_types: businessTypes,
      tags: tags.map(name => {
        const existing = (prospect.tags ?? []).find(t => t.name === name);
        return { name, color: existing?.color ?? hashColor(name) };
      }),
      industry: industry.trim() || null, website: website.trim() || null,
      main_email: mainEmail.trim() || null, main_phone: mainPhone.trim() || null,
      company_size: companySize.trim() || null, x_note: xNote.trim() || null,
      source_raw_label: sourceRawLabel.trim() || null, source_detail: sourceDetail.trim() || null,
    });
    if (primaryContact) {
      await onSaveContact({
        title: role.trim() || null, linkedin_url: linkedinUrl.trim() || null,
        other_contact: otherContact.trim() || null, company2_phone: company2Phone.trim() || null,
        whatsapp,
      });
    }
    setSaving(false);
  }

  return (
    <FormShell
      title="Edit profile"
      onCancel={onCancel}
      footer={<>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </>}
    >
      <FieldSection icon={Building2} title="Identity">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label className="form-label" style={{ fontSize: 12 }}>Organization name</label>
            <input className="form-input" value={organizationName} onChange={e => setOrganizationName(e.target.value)} autoFocus /></div>
          <div><label className="form-label" style={{ fontSize: 12 }}>Person name</label>
            <input className="form-input" value={personName} onChange={e => setPersonName(e.target.value)} /></div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label" style={{ fontSize: 12 }}>Business type</label>
          <div><TagMultiSelect values={businessTypes} options={businessTypeOptions} onChange={setBusinessTypes} placeholder="Add business type…" /></div>
        </div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Tags</label>
          <div><TagMultiSelect values={tags} options={tagOptions} onChange={setTags} placeholder="Add tag…" /></div>
        </div>
      </FieldSection>

      <FieldSection icon={Globe} title="Details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label className="form-label" style={{ fontSize: 12 }}>Industry</label>
            <input className="form-input" value={industry} onChange={e => setIndustry(e.target.value)} /></div>
          <div><label className="form-label" style={{ fontSize: 12 }}>Website</label>
            <input className="form-input" value={website} onChange={e => setWebsite(e.target.value)} /></div>
        </div>
      </FieldSection>

      <FieldSection icon={Users} title="Contact">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label className="form-label" style={{ fontSize: 12 }}>Email</label>
            <input className="form-input" type="email" value={mainEmail} onChange={e => setMainEmail(e.target.value)} /></div>
          <div><label className="form-label" style={{ fontSize: 12 }}>Phone</label>
            <input className="form-input" value={mainPhone} onChange={e => setMainPhone(e.target.value)} /></div>
        </div>
        {primaryContact && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label className="form-label" style={{ fontSize: 12 }}>04 - Role/Position</label>
                <input className="form-input" value={role} onChange={e => setRole(e.target.value)} /></div>
              <div><label className="form-label" style={{ fontSize: 12 }}>05 - LinkedIn</label>
                <input className="form-input" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label className="form-label" style={{ fontSize: 12 }}>07 - Other contact</label>
                <input className="form-input" value={otherContact} onChange={e => setOtherContact(e.target.value)} /></div>
              <div><label className="form-label" style={{ fontSize: 12 }}>Company 2 Phone Number</label>
                <input className="form-input" value={company2Phone} onChange={e => setCompany2Phone(e.target.value)} /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
              <input type="checkbox" checked={whatsapp} onChange={e => setWhatsapp(e.target.checked)} /> WhatsApp available
            </label>
          </>
        )}
      </FieldSection>

      <FieldSection icon={Tag} title="Source & notes">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label className="form-label" style={{ fontSize: 12 }}>13 - Source</label>
            <div><SourceSelect value={sourceRawLabel || null} options={sourceOptions} onChange={setSourceRawLabel} placeholder="Select or type a source…" /></div>
          </div>
          <div><label className="form-label" style={{ fontSize: 12 }}>14 - Source info</label>
            <input className="form-input" value={sourceDetail} onChange={e => setSourceDetail(e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label className="form-label" style={{ fontSize: 12 }}>Company size</label>
            <input className="form-input" value={companySize} onChange={e => setCompanySize(e.target.value)} /></div>
          <div><label className="form-label" style={{ fontSize: 12 }}>x-Note</label>
            <input className="form-input" value={xNote} onChange={e => setXNote(e.target.value)} /></div>
        </div>
      </FieldSection>
    </FormShell>
  );
}
