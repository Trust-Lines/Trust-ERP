// 019 / 067 · Ekibim — who is on shift right now, on break or off, and pending requests.
import { router } from 'expo-router';
import { View } from 'react-native';
import { useApi } from '@/lib/useApi';
import { clock } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import type { TeamPerson } from '@/features/hr';
import { Back, Btn, Chip, Empty, ErrorView, Header, Ico, Li, List, Loading, Row, Screen, Stat } from '@/ui/kit';
import { C } from '@/ui/theme';

export default function Team() {
  const q = useApi<{ people: TeamPerson[] }>('/api/hr/team');
  const people = q.data?.people ?? [];
  const on = people.filter(p => p.status === 'on').length, brk = people.filter(p => p.status === 'break').length;
  const pending = people.reduce((s, p) => s + p.pending, 0);
  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Ekibim" />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : people.length === 0 ? (
        <Empty icon="users" tone="i" title="Yönettiğin kimse yok" sub="Ekip, profillerdeki yönetici alanından gelir." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <Stat value={`${on} / ${people.length}`} label="Mesaide" color={C.successD} />
            <Stat value={brk} label="Molada" color={C.warningD} />
            <Stat value={pending} label="Bekleyen talep" color={C.A600} />
          </View>
          <Row style={{ gap: 10, marginBottom: 12 }}>
            <Btn kind="s" small icon="pen" label="Talepler" style={{ flex: 1 }} onPress={() => router.push('/hr/approvals')} />
            <Btn kind="s" small icon="cal" label="Vardiya planı" style={{ flex: 1 }} onPress={() => router.push('/hr/shifts')} />
          </Row>
          <List>
            {people.map(p => (
              <Li key={p.id} left={<Ico name="user" tone={p.status === 'on' ? 'g' : p.status === 'break' ? 'a' : 'n'} />}
                title={p.full_name} sub={[roleLabel(p.role), p.since && p.status !== 'off' ? `${clock(p.since)}'den beri` : null, p.site].filter(Boolean).join(' · ')}
                right={p.pending ? <Chip label={`${p.pending} talep`} tone="o" /> : <Chip label={p.status === 'on' ? 'Mesaide' : p.status === 'break' ? 'Molada' : 'Dışarıda'} tone={p.status === 'on' ? 'g' : p.status === 'break' ? 'a' : 'n'} />} />
            ))}
          </List>
        </>
      )}
    </Screen>
  );
}
