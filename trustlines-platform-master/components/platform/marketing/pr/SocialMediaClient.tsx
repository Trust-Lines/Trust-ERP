'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AtSign, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback-states';
import { ConfirmModal } from '@/components/ui/modal';
import { platformLabel } from '@/lib/marketing/prWorkspace';
import type { CampaignOption, SocialAccountRow, SocialConnectionRow, SocialPostRow } from '@/lib/marketing/prWorkspaceServer';
import type { ProviderStatus } from '@/lib/social/providers';
import { PageHeading } from '@/components/platform/shared/PageHeading';
import { PANEL, localToday } from './shared';
import {
  emptyPost, newAccountEdit, toAccountEdit, toPostForm,
  type AccountEdit, type DeleteTarget, type PostEdit, type SocialData, type Tab,
} from './social/socialForms';
import { useSocialData } from './social/useSocialData';
import { SocialKpis } from './social/SocialKpis';
import { PostsPanel, usePostFilters } from './social/PostsPanel';
import { AccountsPanel } from './social/AccountsPanel';
import { AccountDialog, FollowersDialog, PostDialog } from './social/SocialDialogs';

interface Props {
  initial: SocialData | null;
  campaigns: CampaignOption[];
  providers: ProviderStatus[];
  canEdit: boolean;
  isManager: boolean;
  userId: string;
  /** Set when the page couldn't load (e.g. migrations 127–128 not applied). */
  loadError: string | null;
  /** ?post=<id> — opens that post (the Calendar links here). */
  openPostId?: string | null;
  /** Back from a "Connect" round trip: ?connected=… / ?connectError=…, and ?tab=accounts. */
  flash?: { connected?: string; accounts?: string; synced?: string; connectError?: string; tab?: string };
}

const TRAIL = [{ label: 'Marketing', href: '/marketing' }, { label: 'Social Media', href: '/marketing/social' }];

/** Marketing → Social Media: posts (plan, schedule, publish, results) and accounts (connections, followers). */
export function SocialMediaClient({ initial, campaigns, providers, canEdit, isManager, userId, loadError, openPostId, flash }: Props) {
  const [tab, setTab] = useState<Tab>(flash?.tab === 'accounts' ? 'accounts' : 'posts');
  const [today, setToday] = useState<string | null>(null);
  const [postEdit, setPostEdit] = useState<PostEdit | null>(null);
  const [accountEdit, setAccountEdit] = useState<AccountEdit | null>(null);
  const [followersFor, setFollowersFor] = useState<SocialAccountRow | null>(null);
  const [toDelete, setToDelete] = useState<DeleteTarget | null>(null);
  const [toDisconnect, setToDisconnect] = useState<SocialConnectionRow | null>(null);

  const s = useSocialData(initial, campaigns, today);
  const { data } = s;
  const filters = usePostFilters(data.posts);

  // "Today" is the viewer's own day, so it is read after mount (the server renders in UTC).
  useEffect(() => { setToday(localToday()); }, []);

  const openPost = (p: SocialPostRow) => setPostEdit({ id: p.id, form: toPostForm(p), row: p });
  const newPost = () => setPostEdit({ id: null, form: emptyPost(), row: null });

  useEffect(() => {
    if (!openPostId) return;
    const p = data.posts.find(x => x.id === openPostId);
    if (p) openPost(p);
    // Only on first load — the Calendar opens one post per visit.
  }, [openPostId]);

  // Result of a "Connect" round trip, shown once; then the query string is cleaned up.
  useEffect(() => {
    if (!flash?.connected && !flash?.connectError) return;
    if (flash.connectError) toast.error(flash.connectError, { duration: 10_000 });
    else toast.success(`${flash.connected} connected — ${flash.accounts ?? 0} account(s) linked, ${flash.synced ?? 0} synced`);
    window.history.replaceState(null, '', '/marketing/social');
    // Once per round trip — the values come from the URL the platform redirected back to.
  }, [flash?.connected, flash?.connectError]);

  const accountOptions = [{ value: '', label: 'No account' }, ...data.accounts.filter(a => a.is_active).map(a => ({ value: a.id, label: `${platformLabel(a.platform)} · ${a.handle}` }))];
  const campaignOptions = [{ value: '', label: 'No campaign' }, ...campaigns.map(c => ({ value: c.id, label: c.name }))];
  const mayDelete = (createdBy: string | null) => canEdit && (isManager || createdBy === userId);

  if (loadError) {
    return (
      <div className="flex flex-col gap-[30px]">
        <PageHeading trail={TRAIL} title="Social Media" subtitle="Accounts, follower growth and post results in one place." />
        <div className={cn(PANEL, 'p-6')}><ErrorState title="Social media tracking isn’t available" description={loadError} /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeading
        trail={TRAIL}
        title="Social Media"
        subtitle={s.connectedCount
          ? 'Plan and publish posts, and follow how they perform. Connected accounts sync every night — or press “Sync now”.'
          : 'Plan and publish posts, and follow how they perform. Connect your accounts on the Accounts tab to sync results automatically.'}
        actions={canEdit && (
          <>
            {s.connectedCount > 0 && (
              <Button variant="secondary" loading={s.syncing === 'all'} disabled={!!s.syncing} onClick={() => s.syncNow()}><RefreshCw /> Sync now</Button>
            )}
            <Button variant="secondary" onClick={() => { setTab('accounts'); setAccountEdit(newAccountEdit()); }}>
              <AtSign /> Add manual account
            </Button>
            <Button onClick={newPost}><Plus /> New post</Button>
          </>
        )}
      />

      <SocialKpis kpis={s.kpis} activeAccounts={data.accounts.filter(a => a.is_active).length} today={today} />

      <nav aria-label="Social media views" className="flex h-12 items-stretch gap-8 border-b border-ui-divider">
        {([['posts', 'Posts', data.posts.length], ['accounts', 'Accounts', data.accounts.length]] as const).map(([key, label, count]) => (
          <button
            key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 border-0 border-b-[3px] bg-transparent p-0 text-[13px] leading-[1.4]',
              tab === key
                ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                : 'cursor-pointer border-transparent text-ui-text-secondary hover:text-ui-body',
            )}
          >
            {label}<span className="text-[11px] opacity-75">({count})</span>
          </button>
        ))}
      </nav>

      {tab === 'posts' ? (
        <PostsPanel
          filters={filters}
          totalPosts={data.posts.length}
          accounts={data.accounts}
          accountById={s.accountById}
          campaignById={s.campaignById}
          today={today}
          canEdit={canEdit}
          mayDelete={mayDelete}
          onOpen={openPost}
          onDelete={p => setToDelete({ kind: 'post', id: p.id, label: p.title })}
          onNew={newPost}
        />
      ) : (
        <AccountsPanel
          data={data}
          providers={providers}
          statsByAccount={s.statsByAccount}
          today={today}
          canEdit={canEdit}
          isManager={isManager}
          mayDelete={mayDelete}
          syncing={s.syncing}
          onDisconnect={setToDisconnect}
          onAddAccount={() => setAccountEdit(newAccountEdit())}
          onSync={id => s.syncNow(id)}
          onRecordFollowers={setFollowersFor}
          onEditAccount={a => setAccountEdit(toAccountEdit(a))}
          onDeleteAccount={a => setToDelete({ kind: 'account', id: a.id, label: a.handle })}
        />
      )}

      <PostDialog
        edit={postEdit}
        setEdit={setPostEdit}
        accountById={s.accountById}
        accountOptions={accountOptions}
        campaignOptions={campaignOptions}
        today={today}
        canEdit={canEdit}
        publishing={s.publishing}
        onSave={edit => { void s.savePost(edit, () => setPostEdit(null)); }}
        onPublish={edit => { void s.publishNow(edit, () => setPostEdit(null)); }}
      />

      <AccountDialog edit={accountEdit} setEdit={setAccountEdit} onSave={edit => { void s.saveAccount(edit, () => setAccountEdit(null)); }} />

      {followersFor && (
        <FollowersDialog
          account={followersFor} history={s.statsByAccount.get(followersFor.id) ?? []} today={today}
          onClose={() => setFollowersFor(null)} onSaved={s.reload}
        />
      )}

      <ConfirmModal
        open={!!toDelete} onOpenChange={o => { if (!o) setToDelete(null); }}
        title={toDelete?.kind === 'post' ? 'Delete this post?' : 'Remove this account?'}
        description={toDelete?.label}
        tone="destructive" confirmLabel={toDelete?.kind === 'post' ? 'Delete post' : 'Remove account'}
        warning={toDelete?.kind === 'account' ? 'Its posts and follower history are kept, but the account no longer appears here.' : undefined}
        onConfirm={async () => { if (toDelete) await s.remove(toDelete, () => setToDelete(null)); }}
      />

      <ConfirmModal
        open={!!toDisconnect} onOpenChange={o => { if (!o) setToDisconnect(null); }}
        title="Disconnect this platform?"
        description={toDisconnect ? providers.find(p => p.id === toDisconnect.provider)?.label : undefined}
        tone="destructive" confirmLabel="Disconnect"
        warning="The ERP stops syncing and can no longer publish. Scheduled posts for these accounts will fail until you reconnect."
        onConfirm={async () => { if (toDisconnect) await s.disconnect(toDisconnect, () => setToDisconnect(null)); }}
      >
        <p className="m-0 text-[12px]">The accounts, their follower history and their posts stay here as manual accounts.</p>
      </ConfirmModal>
    </div>
  );
}
