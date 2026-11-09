// 084 · Depo ana sayfa / 011 · Teslim alma / 038 · Raf görünümü — GET /api/mobile/warehouse.
// Arriving containers list their items; an item without a shelf opens the product card to put it away.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { dayShort } from '@/lib/format';
import { typeLabel } from '@/features/qc';
import { STATUS_TR } from '@/features/containers';
import { Back, Card, Chip, Empty, ErrorView, Header, Ico, Lbl, Li, List, Loading, Muted, Prog, Row, Screen, Seg, T } from '@/ui/kit';
import { C, UI } from '@/ui/theme';

interface WItem { id: string; type: string; status: string; project_code: string | null; location: string | null; quantity?: number | null }
interface WContainer { id: string; container_no: string | null; booking_no: string | null; status: string; estimated_arrival_date: string | null; items: WItem[] }

export default function Warehouse() {
  const q = useApi<{ containers: WContainer[]; located: WItem[] }>('/api/mobile/warehouse');
  const [tab, setTab] = useState<'in' | 'shelf'>('in');
  const located = q.data?.located ?? [];
  const shelves = new Map<string, WItem[]>();
  for (const i of located) shelves.set(i.location ?? '?', [...(shelves.get(i.location ?? '?') ?? []), i]);
  const open = (id: string) => router.push({ pathname: '/items/[id]', params: { id } });

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Depo" icon="qr" iconLabel="Kod okut" onIcon={() => router.push('/scan')} />
      <Seg value={tab} onChange={setTab} items={[{ key: 'in', label: 'Teslim alma', count: q.data?.containers.length }, { key: 'shelf', label: 'Raflar', count: shelves.size }]} />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : tab === 'in' ? (
        (q.data?.containers ?? []).length === 0 ? <Empty icon="anchor" tone="i" title="Gelen konteyner yok" /> :
          q.data!.containers.map(c => {
            const placed = c.items.filter(i => i.location).length;
            return (
              <Card key={c.id}>
                <Row>
                  <Ico name="anchor" tone="g" />
                  <View style={{ flex: 1 }}>
                    <T w={600} color={UI.heading}>{c.container_no ?? c.booking_no ?? 'Konteyner'}</T>
                    <Muted>{`${STATUS_TR[c.status] ?? c.status} · ETA ${dayShort(c.estimated_arrival_date)}`}</Muted>
                  </View>
                  <T w={700} size={13} color={UI.heading}>{`${placed}/${c.items.length}`}</T>
                </Row>
                <Prog pct={c.items.length ? (placed / c.items.length) * 100 : 0} color={C.success} style={{ marginTop: 10, marginBottom: 6 }} />
                {c.items.map(i => (
                  <Li key={i.id} title={`${i.project_code ?? '—'} · ${typeLabel(i.type)}`} sub={i.quantity ? `${i.quantity} adet` : undefined}
                    right={i.location ? <Chip label={i.location} tone="g" /> : <Chip label="Rafa yerleştir" tone="o" />} chevron onPress={() => open(i.id)} />
                ))}
              </Card>
            );
          })
      ) : shelves.size === 0 ? <Empty icon="warehouse" tone="i" title="Rafta kalem yok" /> : [...shelves].map(([loc, items]) => (
        <View key={loc}>
          <Lbl>{`${loc} · ${items.length}`}</Lbl>
          <List>{items.map(i => <Li key={i.id} left={<Ico name="box" />} title={`${i.project_code ?? '—'} · ${typeLabel(i.type)}`} chevron onPress={() => open(i.id)} />)}</List>
        </View>
      ))}
    </Screen>
  );
}
