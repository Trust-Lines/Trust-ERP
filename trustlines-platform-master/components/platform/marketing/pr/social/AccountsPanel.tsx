'use client';

import { AtSign, CircleAlert, ExternalLink, LineChart, Link2, Pencil, Plus, RefreshCw, Trash2, Unplug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { EmptyState } from '@/components/ui/empty-state';
import { followerGrowth, platformLabel } from '@/lib/marketing/prWorkspace';
import type { FollowerStatRow, SocialAccountRow, SocialConnectionRow } from '@/lib/marketing/prWorkspaceServer';
import type { ProviderStatus } from '@/lib/social/providers';
import { PANEL, PlatformMark, fmtDay, fmtNumber } from '@/components/platform/marketing/pr/shared';
import { PROVIDER_PLATFORMS, SUB_BOX, fmtWhen, type SocialData } from './socialForms';

/** Connected platforms (Meta / Google / LinkedIn). Only a Marketing manager may connect or disconnect. */
function ConnectionsSection({ providers, data, isManager, onDisconnect }: {
  providers: ProviderStatus[];
  data: SocialData;
  isManager: boolean;
  onDisconnect: (conn: SocialConnectionRow) => void;
}) {
  return (
    <section className={cn(PANEL, 'flex flex-col gap-4 p-6')} aria-labelledby="connections-heading">
      <div>
        <h2 id="connections-heading" className="m-0 text-[15px] font-semibold text-ui-heading">Connected platforms</h2>
        <p className="m-0 text-[12px] text-ui-text-secondary">
          A Marketing manager signs in once; the ERP then reads followers and post results every night and publishes scheduled posts.
          Access can be removed here at any time.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {providers.map(p => {
          const conn = data.connections.find(c => c.provider === p.id);
          const linked = data.accounts.filter(a => a.connection_id && a.connection_id === conn?.id);
          return (
            <div key={p.id} className={SUB_BOX}>
              <div className="flex items-center gap-2">
                {PROVIDER_PLATFORMS[p.id].map(pl => <PlatformMark key={pl} platform={pl} size={22} />)}
                <span className="text-[13px] font-semibold text-ui-heading">{p.label}</span>
              </div>
              {conn ? (
                <div className="text-[12px] text-ui-body">
                  Connected{conn.external_user_name ? ` as ${conn.external_user_name}` : ''} · {linked.length} account{linked.length === 1 ? '' : 's'}
                  {conn.token_expires_at && p.id === 'linkedin' && (
                    <span className="block text-[11px] text-ui-text-secondary">Login valid until {fmtDay(conn.token_expires_at.slice(0, 10))}</span>
                  )}
                </div>
              ) : p.configured ? (
                <div className="text-[12px] text-ui-text-secondary">Not connected</div>
              ) : (
                <div className="text-[12px] text-ui-text-secondary">
                  Not set up on the server yet{isManager && p.missing.length ? ` — missing ${p.missing.join(', ')}` : ''}.
                </div>
              )}
              {isManager && p.configured && (
                <div className="flex flex-wrap gap-2">
                  {/* A full page navigation: the platform's consent screen can't open in a fetch. */}
                  <a href={`/api/marketing/social/connect/${p.id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                    <Link2 className="size-4" /> {conn ? 'Reconnect' : 'Connect'}
                  </a>
                  {conn && (
                    <Button size="sm" variant="ghost" onClick={() => onDisconnect(conn)}><Unplug /> Disconnect</Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!isManager && <p className="m-0 text-[11px] text-ui-text-secondary">Only a Marketing manager can connect or disconnect platforms.</p>}
    </section>
  );
}

function AccountCard({ account: a, history, publishedPosts, today, canEdit, canDelete, syncing, onSync, onRecordFollowers, onEdit, onDelete }: {
  account: SocialAccountRow;
  history: FollowerStatRow[];
  publishedPosts: number;
  today: string | null;
  canEdit: boolean;
  canDelete: boolean;
  syncing: string | null;
  onSync: () => void;
  onRecordFollowers: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const g = followerGrowth(history);
  return (
    <div className={cn(PANEL, 'flex flex-col gap-4 p-5', !a.is_active && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <PlatformMark platform={a.platform} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ui-heading">{a.handle}</div>
          <div className="text-[12px] text-ui-text-secondary">{platformLabel(a.platform)}{a.is_active ? '' : ' · inactive'}</div>
        </div>
        {a.profile_url && (
          <a href={a.profile_url} target="_blank" rel="noreferrer" aria-label={`Open ${a.handle}`}
            className="inline-grid size-7 place-items-center rounded-[4px] text-ui-body hover:bg-ui-hover-bg"><ExternalLink size={14} /></a>
        )}
      </div>
      <dl className="m-0 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[11px] text-ui-text-secondary">Followers</dt>
          <dd className="m-0 flex items-baseline gap-2 text-[22px] font-semibold tabular-nums text-ui-heading">
            {fmtNumber(g.latest)}
            {g.changePct !== null && (
              <span className={cn('rounded-tag px-1.5 text-[11px] font-medium', g.changePct >= 0 ? 'bg-success-light text-success-dark' : 'bg-error-light text-error-dark')}>
                {g.changePct >= 0 ? '+' : ''}{g.changePct}%
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-ui-text-secondary">Published posts</dt>
          <dd className="m-0 text-[22px] font-semibold tabular-nums text-ui-heading">{publishedPosts}</dd>
        </div>
      </dl>
      <div className="text-[11px] text-ui-text-secondary">
        {a.connection_id
          ? (a.last_synced_at && today ? `Connected · synced ${fmtWhen(a.last_synced_at)}` : 'Connected · not synced yet')
          : history.length
            ? `Manual · last counted ${fmtDay(history.reduce((d, s) => (s.recorded_on > d ? s.recorded_on : d), ''))}`
            : 'Manual · no follower count recorded yet'}
      </div>
      {a.connection_id && a.sync_error && (
        <InlineNotice tone="error" role="alert" className="gap-1.5 px-2.5 text-[11px]" icon={<CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />}>
          <span className="min-w-0 break-words">{a.sync_error}</span>
        </InlineNotice>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {a.connection_id ? (
            <Button size="sm" variant="secondary" loading={syncing === a.id} disabled={!!syncing} onClick={onSync}><RefreshCw /> Sync</Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onRecordFollowers}><LineChart /> Record followers</Button>
          )}
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${a.handle}`} onClick={onEdit}>
            <Pencil />
          </Button>
          {canDelete && (
            <Button size="icon-sm" variant="ghost" aria-label={`Remove ${a.handle}`} onClick={onDelete}>
              <Trash2 className="text-error-normal" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Accounts tab: platform connections, then one card per account (connected or manual). */
export function AccountsPanel({
  data, providers, statsByAccount, today, canEdit, isManager, mayDelete, syncing,
  onDisconnect, onAddAccount, onSync, onRecordFollowers, onEditAccount, onDeleteAccount,
}: {
  data: SocialData;
  providers: ProviderStatus[];
  statsByAccount: Map<string, FollowerStatRow[]>;
  today: string | null;
  canEdit: boolean;
  isManager: boolean;
  mayDelete: (createdBy: string | null) => boolean;
  syncing: string | null;
  onDisconnect: (conn: SocialConnectionRow) => void;
  onAddAccount: () => void;
  onSync: (accountId: string) => void;
  onRecordFollowers: (a: SocialAccountRow) => void;
  onEditAccount: (a: SocialAccountRow) => void;
  onDeleteAccount: (a: SocialAccountRow) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ConnectionsSection providers={providers} data={data} isManager={isManager} onDisconnect={onDisconnect} />

      {data.accounts.length === 0 ? (
        <div className={cn(PANEL, 'p-6')}>
          <EmptyState
            icon={<AtSign />} title="No accounts yet"
            description="Connect a platform above, or add an account by hand to track it manually."
            action={canEdit ? <Button variant="secondary" onClick={onAddAccount}><Plus /> Add manual account</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.accounts.map(a => (
            <AccountCard
              key={a.id}
              account={a}
              history={statsByAccount.get(a.id) ?? []}
              publishedPosts={data.posts.filter(p => p.account_id === a.id && p.status === 'published').length}
              today={today}
              canEdit={canEdit}
              canDelete={mayDelete(a.created_by)}
              syncing={syncing}
              onSync={() => onSync(a.id)}
              onRecordFollowers={() => onRecordFollowers(a)}
              onEdit={() => onEditAccount(a)}
              onDelete={() => onDeleteAccount(a)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
