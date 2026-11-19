import { POST_METRICS, SOCIAL_POST_STATUSES, platformLabel, type PostMetric } from '@/lib/marketing/prWorkspace';
import type { FollowerStatRow, SocialAccountRow, SocialConnectionRow, SocialPostRow } from '@/lib/marketing/prWorkspaceServer';

export interface SocialData { accounts: SocialAccountRow[]; posts: SocialPostRow[]; stats: FollowerStatRow[]; connections: SocialConnectionRow[] }
export const EMPTY_DATA: SocialData = { accounts: [], posts: [], stats: [], connections: [] };

export type Tab = 'posts' | 'accounts';
export type PostForm = Record<'account_id' | 'title' | 'caption' | 'status' | 'planned_on' | 'published_on' | 'post_url' | 'campaign_id' | 'notes'
  | 'media_url' | 'media_type' | 'scheduled_at' | PostMetric, string>;
export type AccountForm = { platform: string; handle: string; profile_url: string; notes: string; is_active: boolean };
export type PostEdit = { id: string | null; form: PostForm; row: SocialPostRow | null };
export type AccountEdit = { id: string | null; form: AccountForm };
export type DeleteTarget = { kind: 'post' | 'account'; id: string; label: string };
export type Option = { value: string; label: string };

export const STATUS_OPTIONS: Option[] = SOCIAL_POST_STATUSES.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));
// Read-only states set by the publisher — shown in filters, never offered in the editor.
export const FILTER_STATUS_OPTIONS: Option[] = [...STATUS_OPTIONS, { value: 'publishing', label: 'Publishing' }, { value: 'failed', label: 'Failed' }];
export const MEDIA_OPTIONS: Option[] = [{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }, { value: 'text', label: 'Text only' }];
export const PROVIDER_PLATFORMS: Record<string, string[]> = { meta: ['instagram', 'facebook'], google: ['youtube'], linkedin: ['linkedin'] };
export const METRIC_LABEL: Record<PostMetric, string> = {
  impressions: 'Impressions', reach: 'Reach', likes: 'Likes', comments: 'Comments', shares: 'Shares', saves: 'Saves', clicks: 'Link clicks',
};

// Bordered sub-section inside a dialog (Media, schedule, Results, platform connections).
export const SUB_BOX = 'flex flex-col gap-3 rounded-[8px] border border-ui-divider p-4';

const DATE_TIME = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const fmtWhen = (iso: string | null) => (iso ? DATE_TIME.format(new Date(iso)) : '—');

/** ISO timestamp → value for <input type="datetime-local"> in the viewer's time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Mirrors the server's publish rules so the editor can say up front what will happen. */
export function publishHint(account: SocialAccountRow | undefined, form: PostForm): { ok: boolean; text: string } | null {
  if (!account) return null;
  if (!account.connection_id) return { ok: false, text: 'This account isn’t connected, so the post won’t be published automatically. Connect it on the Accounts tab.' };
  if (account.platform === 'youtube') return { ok: false, text: 'YouTube videos are uploaded in YouTube Studio; their results sync here.' };
  if (account.platform === 'instagram' && (form.media_type === 'text' || !form.media_url)) return { ok: false, text: 'Instagram needs an image or a video before it can be published.' };
  if (account.platform === 'linkedin' && form.media_type === 'video') return { ok: false, text: 'Video posts to LinkedIn aren’t supported yet.' };
  if (!form.caption.trim() && !form.media_url) return { ok: false, text: 'Add a caption or media to publish.' };
  return { ok: true, text: `Ready to publish to ${platformLabel(account.platform)} · ${account.handle}.` };
}

export const emptyPost = (date = ''): PostForm => ({
  account_id: '', title: '', caption: '', status: date ? 'scheduled' : 'idea', planned_on: date, published_on: '', post_url: '',
  campaign_id: '', notes: '', media_url: '', media_type: 'image', scheduled_at: '',
  impressions: '', reach: '', likes: '', comments: '', shares: '', saves: '', clicks: '',
});

export const toPostForm = (p: SocialPostRow): PostForm => ({
  account_id: p.account_id ?? '', title: p.title, caption: p.caption ?? '',
  // A failed publish reopens as "scheduled" so saving it retries at the chosen time.
  status: p.status === 'failed' || p.status === 'publishing' ? 'scheduled' : p.status,
  planned_on: p.planned_on ?? '', published_on: p.published_on ?? '', post_url: p.post_url ?? '', campaign_id: p.campaign_id ?? '', notes: p.notes ?? '',
  media_url: p.media_url ?? '', media_type: p.media_type ?? (p.media_url ? 'image' : 'text'), scheduled_at: toLocalInput(p.scheduled_at),
  ...Object.fromEntries(POST_METRICS.map(m => [m, p[m] === null ? '' : String(p[m])])) as Record<PostMetric, string>,
});

/** The JSON the posts API expects: the local publish time becomes an ISO timestamp. */
export function postBody(form: PostForm) {
  const scheduled = form.status === 'scheduled' && form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null;
  return {
    ...form,
    scheduled_at: scheduled,
    // Keep the calendar day in step with the publish time.
    planned_on: form.planned_on || (form.scheduled_at ? form.scheduled_at.slice(0, 10) : ''),
    media_url: form.media_type === 'text' ? '' : form.media_url,
  };
}

export const newAccountEdit = (): AccountEdit => ({ id: null, form: { platform: '', handle: '', profile_url: '', notes: '', is_active: true } });
export const toAccountEdit = (a: SocialAccountRow): AccountEdit => ({
  id: a.id, form: { platform: a.platform, handle: a.handle, profile_url: a.profile_url ?? '', notes: a.notes ?? '', is_active: a.is_active },
});

/** Can publish from the editor right now: not live yet, not done/cancelled, and the publish rules pass. */
export function canPublishNow(edit: PostEdit, account: SocialAccountRow | undefined): boolean {
  const live = !!edit.row?.external_id;
  return !live && edit.form.status !== 'published' && edit.form.status !== 'cancelled' && !!publishHint(account, edit.form)?.ok;
}
