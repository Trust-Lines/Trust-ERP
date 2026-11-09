// 032 · Bildirim merkezi — my notifications; opening one marks it read and follows its link.
import { useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { openHref } from '@/lib/nav';
import { ago } from '@/lib/format';
import { Back, Btn, Empty, ErrorView, Header, Ico, Li, List, Loading, Screen, Seg } from '@/ui/kit';

interface Notif { id: string; type: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string }

export default function Notifications() {
  const q = useApi<{ notifications: Notif[] }>('/api/mobile/notifications');
  const [tab, setTab] = useState<'unread' | 'all'>('unread');
  const all = q.data?.notifications ?? [];
  const rows = tab === 'all' ? all : all.filter(n => !n.is_read);
  const unread = all.filter(n => !n.is_read).length;

  async function open(n: Notif) {
    if (!n.is_read) void api('/api/mobile/notifications', { method: 'PATCH', body: { ids: [n.id] } }).then(() => q.reload()).catch(() => {});
    if (n.link) openHref(n.link);
  }

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Bildirimler" />
      <Seg value={tab} onChange={setTab} items={[{ key: 'unread', label: 'Okunmamış', count: unread }, { key: 'all', label: 'Tümü' }]} />
      {unread > 0 ? <Btn kind="s" small icon="check" label="Tümünü okundu yap" style={{ alignSelf: 'flex-start', marginBottom: 12 }}
        onPress={() => api('/api/mobile/notifications', { method: 'PATCH', body: { all: true } }).then(() => q.reload()).catch(() => {})} /> : null}
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : rows.length === 0 ? (
        <Empty icon="bell" tone="i" title={tab === 'unread' ? 'Okunmamış bildirim yok' : 'Bildirim yok'} />
      ) : (
        <List>
          {rows.map(n => (
            <Li key={n.id} left={<Ico name="bell" tone={n.is_read ? 'n' : 'o'} />} title={n.title}
              sub={[n.body, ago(n.created_at)].filter(Boolean).join(' · ')} chevron={!!n.link} onPress={() => open(n)} />
          ))}
        </List>
      )}
    </Screen>
  );
}
