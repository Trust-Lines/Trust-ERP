// 009 · Konteynerler — Yükleniyor / Yolda / Varış / Tümü (GET /api/containers).
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { dayShort } from '@/lib/format';
import { groupOf, STATUS_TR, statusUi, voyagePct, type Container, type ContainerGroup } from '@/features/containers';
import { Back, Card, Chip, Empty, ErrorView, Header, Ico, Loading, Muted, Prog, Row, Screen, Seg, T } from '@/ui/kit';
import { C, UI } from '@/ui/theme';

export default function Containers() {
  const q = useApi<{ containers: Container[] }>('/api/containers');
  const [tab, setTab] = useState<ContainerGroup>('loading');
  const all = q.data?.containers ?? [];
  const rows = tab === 'all' ? all : all.filter(c => groupOf(c.status) === tab);
  const count = (g: ContainerGroup) => all.filter(c => groupOf(c.status) === g).length;

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Konteynerler" />
      <Seg value={tab} onChange={setTab} items={[
        { key: 'loading', label: 'Yükleniyor', count: count('loading') },
        { key: 'transit', label: 'Yolda', count: count('transit') },
        { key: 'arrived', label: 'Varış', count: count('arrived') },
        { key: 'all', label: 'Tümü' },
      ]} />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : rows.length === 0 ? (
        <Empty icon="box" tone="i" title="Konteyner yok" sub="Bu durumda açık konteyner bulunmuyor." />
      ) : rows.map(c => {
        const ui = statusUi(c.status);
        const pct = groupOf(c.status) === 'transit' ? voyagePct(c) : null;
        return (
          <Card key={c.id} label={c.container_no ?? 'Konteyner'}
            onPress={() => router.push({ pathname: '/containers/[id]', params: { id: c.id } })}>
            <Row>
              <Ico name={ui.icon} tone={ui.tone} />
              <View style={{ flex: 1 }}>
                <T w={600} color={UI.heading}>{c.container_no ?? c.booking_no ?? 'Numara yok'}</T>
                <Muted numberOfLines={1}>{[c.origin_port, c.destination_port].filter(Boolean).join(' → ') || c.carrier || '—'}</Muted>
              </View>
              <Chip label={STATUS_TR[c.status] ?? c.status} tone={ui.tone} />
            </Row>
            {pct !== null ? (
              <>
                <Row style={{ marginTop: 14, marginBottom: 6 }}>
                  <Muted style={{ flex: 1 }}>{c.origin_port ?? 'Çıkış'}</Muted><Muted>{c.destination_port ?? 'Varış'}</Muted>
                </Row>
                <Prog pct={pct} color={C.success} />
              </>
            ) : null}
            <Row style={{ marginTop: 10, gap: 14 }}>
              <Muted>{c.item_count ?? 0} kalem</Muted>
              {c.estimated_arrival_date ? <Muted>ETA {dayShort(c.estimated_arrival_date)}</Muted> : c.departure_date ? <Muted>Kalkış {dayShort(c.departure_date)}</Muted> : null}
              <Muted>Mühür: {c.seal_no ?? '—'}</Muted>
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
