// 057 · Ekip rehberi — GET /api/mobile/team (page.team, like the web Team page).
import { useState } from 'react';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { roleLabel } from '@/lib/roles';
import { Back, Empty, ErrorView, Field, Header, Li, List, Loading, Screen } from '@/ui/kit';
import { Avatar, type Person } from '@/features/team';

export default function Directory() {
  const [q, setQ] = useState('');
  const res = useApi<{ people: Person[] }>('/api/mobile/team');
  const needle = q.trim().toLocaleLowerCase('tr-TR');
  const rows = (res.data?.people ?? []).filter(p => p.is_active && (!needle || `${p.full_name} ${roleLabel(p.role)}`.toLocaleLowerCase('tr-TR').includes(needle)));
  return (
    <Screen onRefresh={res.reload} refreshing={res.refreshing}>
      <Back label="Menü" />
      <Header title="Ekip rehberi" />
      <Field icon="search" placeholder="İsim veya rol ara…" value={q} onChangeText={setQ} />
      {res.loading ? <Loading /> : res.error ? <ErrorView message={res.error} onRetry={res.reload} /> : rows.length === 0 ? (
        <Empty icon="users" tone="i" title="Kimse bulunamadı" />
      ) : (
        <List>
          {rows.map(p => (
            <Li key={p.id} left={<Avatar name={p.full_name} />} title={p.full_name} sub={[roleLabel(p.role), p.office].filter(Boolean).join(' · ')}
              chevron onPress={() => router.push({ pathname: '/team/[id]', params: { id: p.id } })} />
          ))}
        </List>
      )}
    </Screen>
  );
}
