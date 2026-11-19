'use client';

import { ContactSearchSelect } from '../ContactSearchSelect';
import { normalizeIndustry, INDUSTRY_COLOR } from '@/lib/marketing/industry';
import { OPPORTUNITY_STAGE_LABEL, TIMING_LABEL } from '@/lib/marketing/classification';
import { REGIONS } from '@/lib/regions';
import type { PotentialStatus } from '@/types/database';
import { Card, Field, Fields, Inp, ReadOnly, Sel, fieldBox, readableOn } from './parts';
import type { ContactOption, Deal, NeedInfo } from './types';
import type { DealKind } from './useDealRecord';

export const POTENTIAL_STATUS_LABEL: Record<PotentialStatus, string> = {
  identified: 'Identified', nurture: 'Nurture', waiting_timing: 'Waiting Timing',
  contact_due: 'Contact Due', converted: 'Converted', lost: 'Lost', cancelled: 'Cancelled',
};
const STAGE_OPTS: [string, string][] = Object.entries(OPPORTUNITY_STAGE_LABEL);
const POTENTIAL_STATUS_OPTS: [string, string][] = Object.entries(POTENTIAL_STATUS_LABEL);
const PRIORITY_OPTS: [string, string][] = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
const REGION_OPTS: [string, string][] = [['', '—'], ...REGIONS.map(r => [r.code, r.label] as [string, string])];

type Save = (name: string, value: unknown, extra?: Record<string, unknown>) => void;

/**
 * The four editable field cards: Status & Ownership, Value & Timeline, Location & Business, Clickup Reference.
 * Opportunities and Potentials store some of the same ideas in different columns (stage vs status,
 * owners vs assignee, description vs notes, dates), so each card switches on `kind`.
 */
export function DealFieldCards({ kind, opp, need, contacts, contactLabel, assignees, canEdit, focusFields, saveField, onStageChange, onContactChange }: {
  kind: DealKind;
  opp: Deal;
  need: NeedInfo | null;
  contacts: ContactOption[];
  contactLabel: string;
  assignees: { id: string; full_name: string }[];
  canEdit: boolean;
  focusFields: string[];
  saveField: Save;
  /** Opportunity stage changes go through a reason popup instead of saving straight away. */
  onStageChange: (next: string) => void;
  onContactChange: (id: string | null, name: string | undefined) => void;
}) {
  const v = (k: string) => (opp[k] as string | number | null) ?? '';
  const isOpp = kind === 'opportunity';
  const assigneeOpts: [string, string][] = [['', 'Unassigned'], ...assignees.map(a => [a.id, a.full_name] as [string, string])];
  const businessTypes = (opp.business_types as string[] | null) ?? [];
  const reasons = Array.isArray(opp.classification_reasons) ? (opp.classification_reasons as string[]) : [];
  const contactMissing = focusFields.includes('contact') && !v('primary_contact_id') && !v('direct_contact_raw');
  /** Empty input → null (dates, owner ids, region). */
  const orNull = (name: string) => (x: string) => saveField(name, x || null);
  const numOrNull = (name: string) => (x: string) => saveField(name, x === '' ? null : Number(x));
  const text = (name: string) => (x: string) => saveField(name, x);
  const industry = normalizeIndustry(v('industry_raw') as string);
  const industryBg = industry ? INDUSTRY_COLOR[industry] : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title="Status & Ownership">
        <Fields>
          {isOpp ? (
            <Field label="Stage" span={2}><Sel value={String(v('stage'))} onChange={onStageChange} opts={STAGE_OPTS} /></Field>
          ) : (
            <Field label="Status" span={2}>
              <Sel value={String(v('status') || 'identified')} onChange={text('status')} opts={POTENTIAL_STATUS_OPTS} />
            </Field>
          )}
          <Field label="Priority" span={2}>
            <Sel value={String(v('priority') || 'medium')} onChange={text('priority')} opts={PRIORITY_OPTS} />
          </Field>
          {isOpp ? (
            <>
              <Field label="Marketing Owner" span={2}>
                <Sel value={String(v('marketing_owner_id'))} onChange={orNull('marketing_owner_id')} opts={assigneeOpts} />
              </Field>
              <Field label="Sales Owner" span={2}>
                <Sel value={String(v('sales_owner_id'))} onChange={orNull('sales_owner_id')} opts={assigneeOpts} />
              </Field>
            </>
          ) : (
            <Field label="Assignee" span={2}>
              <Sel value={String(v('assigned_to'))} onChange={orNull('assigned_to')} opts={assigneeOpts} />
            </Field>
          )}
          <Field label="Contact" span={isOpp ? 4 : 6} focus={contactMissing}>
            <ContactSearchSelect
              value={String(v('primary_contact_id'))}
              valueLabel={contactLabel || contacts.find(c => c.id === v('primary_contact_id'))?.name || ''}
              disabled={!canEdit}
              placeholder="Search contacts…"
              buttonStyle={{ ...fieldBox, cursor: canEdit ? 'pointer' : 'default' }}
              placeholderStyle={{ color: 'var(--ui-text-disabled)', fontWeight: 500 }}
              onChange={onContactChange}
            />
          </Field>
          {need?.timing && (
            <Field label="Timing" span={3}><ReadOnly>{TIMING_LABEL[need.timing]}</ReadOnly></Field>
          )}
          {reasons.length > 0 && (
            <Field label="Why this stage" span={need?.timing ? 3 : 6}>
              <ReadOnly>{reasons.join(' · ')}</ReadOnly>
            </Field>
          )}
        </Fields>
      </Card>

      <Card title="Value & Timeline">
        <Fields>
          <Field label="Deal Size" span={3}><Inp type="number" value={v('estimated_value')} ph="e.g 250000" onSave={numOrNull('estimated_value')} /></Field>
          <Field label="Deposit" span={3}><Inp type="number" value={v('deposit')} ph="e.g 5000" onSave={numOrNull('deposit')} /></Field>
          <Field label="Payment" span={4}><Inp value={v('payment_raw')} ph="Payment terms.." onSave={text('payment_raw')} /></Field>
          <Field label="Targeted" span={2}>
            <Sel value={String(!!opp.targeted)} onChange={x => saveField('targeted', x === 'true')} opts={[['false', 'No'], ['true', 'Yes']]} />
          </Field>
          {isOpp ? (
            <>
              <Field label="Due Date" span={2}><Inp type="date" value={v('deadline')} onSave={orNull('deadline')} /></Field>
              <Field label="Expected Close" span={2}><Inp type="date" value={v('expected_close_date')} onSave={orNull('expected_close_date')} /></Field>
              <Field label="Date done" span={2}><Inp type="date" value={v('closed_at') ? String(v('closed_at')).slice(0, 10) : ''} onSave={orNull('closed_at')} /></Field>
              <Field label="Next Action" span={3}><Inp value={v('next_action')} ph="e.g Send estimate" onSave={text('next_action')} /></Field>
              <Field label="Next Action Date" span={3}><Inp type="date" value={v('next_action_date')} onSave={orNull('next_action_date')} /></Field>
            </>
          ) : (
            <>
              <Field label="Due Date" span={2}><Inp type="date" value={v('due_date')} onSave={orNull('due_date')} /></Field>
              <Field label="Targeted contact date" span={2}><Inp type="date" value={v('target_contact_date')} onSave={orNull('target_contact_date')} /></Field>
              <Field label="Date done" span={2}><Inp type="date" value={v('date_done')} onSave={orNull('date_done')} /></Field>
            </>
          )}
          <Field label="Source" span={3}><Inp value={v('source_raw_label') || v('source_label')} ph="type.." onSave={text('source_raw_label')} /></Field>
          <Field label="Notes" span={3}>
            <Inp value={v(isOpp ? 'description' : 'notes')} ph="type.." onSave={text(isOpp ? 'description' : 'notes')} />
          </Field>
        </Fields>
      </Card>

      <Card title="Location & Business" className="self-start">
        <Fields>
          <Field label="01-State" span={2} focus={focusFields.includes('state') && !v('state')}><Inp value={v('state')} ph="e.g TX" onSave={text('state')} /></Field>
          <Field label="11-Location" span={2}><Inp value={v('formatted_address')} ph="address.." onSave={text('formatted_address')} /></Field>
          <Field label="Brand" span={2}><Inp value={v('brand')} ph="brand.." onSave={text('brand')} /></Field>
          <Field label="Industry" span={2}>
            <div className="flex w-full items-center gap-1.5">
              {industryBg && (
                <span style={{ fontWeight: 500, fontSize: 12, lineHeight: '16px', padding: '3px 8px', borderRadius: 4, background: industryBg, color: readableOn(industryBg), flexShrink: 0 }}>
                  {industry}
                </span>
              )}
              <Inp value={v('industry_raw')} ph="industry.." onSave={text('industry_raw')} />
            </div>
          </Field>
          <Field label="Project Type" span={2}><Inp value={v('project_type_raw')} ph="project type.." onSave={text('project_type_raw')} /></Field>
          <Field label="Business Type" span={2}>
            <Inp value={businessTypes.join(', ')} ph="comma separated.." onSave={x => saveField('business_types', x.split(',').map(s => s.trim()).filter(Boolean))} />
          </Field>
          <Field label="Region" span={2} focus={focusFields.includes('region') && !v('region')}>
            <Sel value={String(v('region'))} onChange={orNull('region')} opts={REGION_OPTS} emphasize={!v('region')} />
            {!v('region') && <div className="text-[12px] text-[var(--status-warning-fg)]">Set a region so your team can see this</div>}
          </Field>
        </Fields>
      </Card>

      <Card title="Clickup Reference" muted className="self-start">
        <Fields>
          <Field label="Direct Contact" span={3} focus={contactMissing}><Inp muted value={v('direct_contact_raw')} ph="Name, phone, email.." onSave={text('direct_contact_raw')} /></Field>
          <Field label="Status OP" span={3}><Inp muted value={v('external_stage_label')} ph="status OP.." onSave={text('external_stage_label')} /></Field>
          <Field label="Requests" span={3}><Inp muted value={v('request_raw')} ph="Requests.." onSave={text('request_raw')} /></Field>
          <Field label="To do" span={3}><Inp muted value={v('to_do_raw')} ph="To do.." onSave={text('to_do_raw')} /></Field>
        </Fields>
      </Card>
    </div>
  );
}
