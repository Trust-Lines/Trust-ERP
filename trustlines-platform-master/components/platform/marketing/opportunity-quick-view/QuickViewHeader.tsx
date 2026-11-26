'use client';

import { useState } from 'react';
import { CircleCheck, CircleDashed, Hash, Loader2, SendHorizontal, SquareArrowOutUpRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToneChip } from '@/components/ui/tone-chip';
import { Button } from '@/components/ui/button';
import { ProspectQuickView } from '../ProspectQuickView';
import { HEADING } from '@/components/platform/shared/panelStyles';
import { hashColor } from '@/lib/marketing/pillColor';
import { TagMultiSelect } from '../TagMultiSelect';
import { readableOn } from './parts';
import type { Deal, ProjectInfo, Tag } from './types';
import type { DealKind } from './useDealRecord';

/** Title ("Deal" over it), project code / status / tag chips, saving spinner, Convert, Contact Profile and Close. */
export function QuickViewHeader({ title, kind, opp, project, statusLabel, tags, tagOptions, canEdit, saving, converting, onTagsChange, onConvert, onClose }: {
  title: string;
  kind: DealKind;
  opp: Deal | null;
  project: ProjectInfo | null;
  statusLabel: string | undefined;
  tags: Tag[];
  tagOptions: string[];
  canEdit: boolean;
  saving: boolean;
  converting: boolean;
  onTagsChange: (tags: Tag[]) => void;
  onConvert: () => void;
  onClose: () => void;
}) {
  const canConvert = kind === 'potential' && canEdit && opp && !opp.converted_opportunity_id && !['lost', 'cancelled'].includes(String(opp.status));
  // The Contact (company / person) this deal belongs to, opened over this pop-up.
  const [profileOpen, setProfileOpen] = useState(false);
  const prospectId = typeof opp?.prospect_id === 'string' ? opp.prospect_id : null;
  return (
    <div className="flex shrink-0 items-center justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-[5px]">
        {/* One job for one customer — Opportunity or Potential underneath, a deal to the user. */}
        <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-ui-text-secondary">Deal</span>
        <h2 className={cn('m-0 truncate text-[28px] font-semibold leading-[1.35]', HEADING)}>{title}</h2>
        <div className="flex flex-wrap items-center gap-[5px]">
          {project?.code && <ToneChip tone="t0" icon={Hash}>{project.code}</ToneChip>}
          {opp && statusLabel && <ToneChip tone="t0" icon={CircleDashed}>{statusLabel}</ToneChip>}
          {canEdit ? (
            <TagMultiSelect
              variant="chip"
              values={tags.map(t => t.name)}
              options={tagOptions}
              placeholder="Add tag"
              onChange={next => onTagsChange(next.map(name => tags.find(t => t.name === name) ?? { name, color: hashColor(name) }))}
            />
          ) : tags.map(t => (
            <span key={t.name} style={{ fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 4, background: t.color || 'var(--status-t0-bg)', color: readableOn(t.color) }}>
              {t.name}
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {saving && <Loader2 size={16} className="qv-spin text-ui-text-secondary" aria-label="Saving" />}
        {/* Marketing → Sales: the Potential becomes an Opportunity on Sales → Handoffs. */}
        {canConvert && (
          <Button variant="accent" size="md" onClick={onConvert} loading={converting}>
            <SendHorizontal className="size-4" aria-hidden />
            Convert to Opportunity
          </Button>
        )}
        {kind === 'potential' && !!opp?.converted_opportunity_id && <ToneChip tone="t9" icon={CircleCheck}>Converted — with Sales</ToneChip>}
        {prospectId ? (
          <Button variant="outline" size="md" onClick={() => setProfileOpen(true)} title="The company / person: contacts, locations and all their deals">
            <SquareArrowOutUpRight className="size-4" aria-hidden />
            Contact Profile
          </Button>
        ) : null}
        {profileOpen && prospectId && (
          <ProspectQuickView prospectId={prospectId} canEdit={canEdit} onClose={() => setProfileOpen(false)} />
        )}
        <Button variant="outline" size="icon-md" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>
    </div>
  );
}
