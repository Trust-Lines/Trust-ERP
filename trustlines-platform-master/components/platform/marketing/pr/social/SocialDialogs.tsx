'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { SOCIAL_PLATFORMS, platformLabel } from '@/lib/marketing/prWorkspace';
import type { FollowerStatRow, SocialAccountRow } from '@/lib/marketing/prWorkspaceServer';
import { fmtDay, fmtNumber, sendJson } from '@/components/platform/marketing/pr/shared';
import { PostFields } from './PostFields';
import { canPublishNow, type AccountEdit, type AccountForm, type Option, type PostEdit, type PostForm } from './socialForms';

const CancelButton = () => <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>;

/**
 * New / edit post. Read-only for viewers and while the post is being published.
 * Field changes go through a functional update, so a late one (e.g. an image upload finishing) can't overwrite newer typing.
 */
export function PostDialog({ edit, setEdit, accountById, accountOptions, campaignOptions, today, canEdit, publishing, onSave, onPublish }: {
  edit: PostEdit | null;
  setEdit: Dispatch<SetStateAction<PostEdit | null>>;
  accountById: Map<string, SocialAccountRow>;
  accountOptions: Option[];
  campaignOptions: Option[];
  today: string | null;
  canEdit: boolean;
  publishing: boolean;
  onSave: (edit: PostEdit) => void;
  onPublish: (edit: PostEdit) => void;
}) {
  const account = edit?.form.account_id ? accountById.get(edit.form.account_id) : undefined;
  const patch = (p: Partial<PostForm>) => setEdit(e => (e ? { ...e, form: { ...e.form, ...p } } : e));
  return (
    <Modal open={!!edit} onOpenChange={o => { if (!o) setEdit(null); }}>
      {edit && (
        <ModalContent
          size="lg"
          title={edit.id ? 'Edit post' : 'New post'}
          description="Results can be added later, once the post is live."
          footer={canEdit && (
            <>
              {canPublishNow(edit, account) && (
                <Button variant="secondary" className="mr-auto" loading={publishing} onClick={() => onPublish(edit)}><Rocket /> Publish now</Button>
              )}
              <CancelButton />
              <Button disabled={publishing} onClick={() => onSave(edit)}>{edit.id ? 'Save post' : 'Add post'}</Button>
            </>
          )}
        >
          <PostFields
            form={edit.form} row={edit.row} disabled={!canEdit || edit.row?.status === 'publishing'}
            account={account} accountOptions={accountOptions} campaignOptions={campaignOptions} today={today}
            onChange={patch}
          />
        </ModalContent>
      )}
    </Modal>
  );
}

/** Add / edit a manual account. "Active" only shows when editing. */
export function AccountDialog({ edit, setEdit, onSave }: {
  edit: AccountEdit | null;
  setEdit: Dispatch<SetStateAction<AccountEdit | null>>;
  onSave: (edit: AccountEdit) => void;
}) {
  const patch = (p: Partial<AccountForm>) => setEdit(e => (e ? { ...e, form: { ...e.form, ...p } } : e));
  return (
    <Modal open={!!edit} onOpenChange={o => { if (!o) setEdit(null); }}>
      {edit && (
        <ModalContent
          title={edit.id ? 'Edit account' : 'Add account'}
          footer={(
            <>
              <CancelButton />
              <Button onClick={() => onSave(edit)}>{edit.id ? 'Save account' : 'Add account'}</Button>
            </>
          )}
        >
          <div className="flex flex-col gap-4">
            <Field label="Platform">
              <Select aria-label="Platform" placeholder="Pick a platform" value={edit.form.platform}
                options={SOCIAL_PLATFORMS.map(p => ({ value: p.value, label: p.label }))}
                onValueChange={v => patch({ platform: v ?? '' })} />
            </Field>
            <Field label="Account name / handle" htmlFor="acc-handle">
              <Input id="acc-handle" placeholder="@tlines" value={edit.form.handle} onChange={e => patch({ handle: e.target.value })} />
            </Field>
            <Field label="Profile link" htmlFor="acc-url">
              <Input id="acc-url" type="url" placeholder="https://www.instagram.com/…" value={edit.form.profile_url} onChange={e => patch({ profile_url: e.target.value })} />
            </Field>
            <Field label="Notes" htmlFor="acc-notes">
              <Textarea id="acc-notes" rows={3} value={edit.form.notes} onChange={e => patch({ notes: e.target.value })} />
            </Field>
            {edit.id && (
              <label className="flex items-center gap-2 text-[12px] text-ui-body">
                <Checkbox checked={edit.form.is_active} onCheckedChange={v => patch({ is_active: !!v })} />
                Active — shown in totals and in the account list for new posts
              </label>
            )}
          </div>
        </ModalContent>
      )}
    </Modal>
  );
}

/** Manual follower count for an unconnected account. Saving a date that already has a count replaces it. */
export function FollowersDialog({ account, history, today, onClose, onSaved }: {
  account: SocialAccountRow; history: FollowerStatRow[]; today: string | null; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [date, setDate] = useState(today ?? '');
  const [followers, setFollowers] = useState('');
  const [saving, setSaving] = useState(false);
  const recent = [...history].sort((a, b) => b.recorded_on.localeCompare(a.recorded_on)).slice(0, 8);

  async function save() {
    if (!date || followers === '') { toast.error('Enter the date and the follower count'); return; }
    setSaving(true);
    try {
      await sendJson(`/api/marketing/social/accounts/${account.id}/stats`, 'POST', { recorded_on: date, followers: Number(followers) });
      toast.success('Follower count saved');
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent
        title="Record followers"
        description={`${platformLabel(account.platform)} · ${account.handle}`}
        footer={(
          <>
            <CancelButton />
            <Button loading={saving} onClick={save}>Save count</Button>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" htmlFor="fol-date">
              <Input id="fol-date" type="date" max={today ?? undefined} value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Followers" htmlFor="fol-count">
              <Input id="fol-count" type="number" min={0} step={1} inputMode="numeric" value={followers} onChange={e => setFollowers(e.target.value)} />
            </Field>
          </div>
          <p className="m-0 text-[11px] text-ui-text-secondary">Saving a date that already has a count replaces that day’s number.</p>
          {recent.length > 0 && (
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-ui-body">Recent counts</div>
              <ul className="m-0 flex list-none flex-col divide-y divide-ui-divider rounded-[8px] border border-ui-divider p-0">
                {recent.map((s, i) => {
                  const prev = recent[i + 1];
                  const diff = prev ? s.followers - prev.followers : null;
                  return (
                    <li key={s.id} className="flex items-center justify-between px-3 py-2 text-[12px]">
                      <span className="text-ui-text-secondary">{fmtDay(s.recorded_on)}</span>
                      <span className="tabular-nums text-ui-heading">
                        {fmtNumber(s.followers)}
                        {diff !== null && diff !== 0 && <span className={cn('ml-2 text-[11px]', diff > 0 ? 'text-success-dark' : 'text-error-dark')}>{diff > 0 ? '+' : ''}{fmtNumber(diff)}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
