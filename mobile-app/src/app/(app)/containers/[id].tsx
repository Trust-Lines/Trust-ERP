// 024 · Konteyner detay / 081 belgeler — GET /api/containers/[id] (+ /documents). Read-only on
// mobile for now; status changes stay on the web Logistics page.
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { dayShort } from '@/lib/format';
import { DOC_TR, STATUS_ORDER, STATUS_TR, statusUi, voyagePct, type Container, type ContainerDoc, type ContainerItem } from '@/features/containers';
import { typeLabel } from '@/features/qc';
import { Back, Btn, Card, Chip, ErrorView, KV, Lbl, Li, List, Loading, Note, Row, Screen, Timeline, Title } from '@/ui/kit';

const at = (s: string) => STATUS_ORDER.indexOf(s as (typeof STATUS_ORDER)[number]);

export default function ContainerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<{ container: Container; items: ContainerItem[] }>(`/api/containers/${id}`);
  const docs = useApi<{ documents: ContainerDoc[] }>(`/api/containers/${id}/documents`);
  const [showItems, setShowItems] = useState(false);

  if (q.loading) return <Screen><Back label="Konteynerler" /><Loading /></Screen>;
  if (q.error || !q.data) return <Screen><Back label="Konteynerler" /><ErrorView message={q.error ?? 'Bulunamadı'} onRetry={q.reload} /></Screen>;

  const { container: c, items } = q.data;
  const ui = statusUi(c.status);
  const projects = new Set(items.map(i => i.production_item?.project_code).filter(Boolean)).size;
  const now = at(c.status);
  const pct = voyagePct(c);
  const step = (from: number, to: number): 'done' | 'cur' | 'nx' => (now > to ? 'done' : now >= from ? 'cur' : 'nx');
  const steps = c.status === 'CANCELLED' ? [{ title: 'İptal edildi', state: 'red' as const }] : [
    { title: 'Yükleme & mühür', sub: c.seal_no ? `Mühür ${c.seal_no}` : null, state: step(0, at('LOADING')) },
    { title: 'Yola çıktı', sub: c.departure_date ? `${dayShort(c.departure_date)} · ${c.origin_port ?? ''}` : null, state: step(at('DEPARTED'), at('DEPARTED')) },
    { title: 'Yolda', sub: pct !== null && now === at('IN_TRANSIT') ? `Tahmini %${pct}` : null, state: step(at('IN_TRANSIT'), at('IN_TRANSIT')) },
    { title: 'Limana varış · Gümrük', sub: c.actual_arrival_date ? dayShort(c.actual_arrival_date) : c.estimated_arrival_date ? `${dayShort(c.estimated_arrival_date)} (tahmini)` : null, state: step(at('ARRIVED_PORT'), at('RELEASED')) },
    { title: 'Depo teslim alma', sub: c.warehouse_arrival_date ? dayShort(c.warehouse_arrival_date) : null, state: step(at('WAREHOUSE'), at('WAREHOUSE')) },
  ];

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing} sticky={
      <Row style={{ gap: 10 }}>
        <Btn kind="s" label={showItems ? 'Kalemleri gizle' : `Kalemler (${items.length})`} onPress={() => setShowItems(v => !v)} />
        {c.tracking_url ? <Btn kind="d" label="Takip linki" onPress={() => Linking.openURL(c.tracking_url!)} /> : null}
      </Row>
    }>
      <Back label="Konteynerler" />
      <Title title={c.container_no ?? c.booking_no ?? 'Konteyner'} sub={`${items.length} kalem · ${projects} proje`}
        right={<Chip label={STATUS_TR[c.status] ?? c.status} tone={ui.tone} />} />

      <Card>
        <KV pairs={[
          ['Taşıyıcı', c.carrier], ['Gemi / Sefer', [c.vessel_name, c.voyage_no].filter(Boolean).join(' · ')],
          ['Yükleme', [c.origin_port, dayShort(c.departure_date)].filter(x => x && x !== '—').join(' · ')],
          ['Varış (ETA)', [c.destination_port, dayShort(c.estimated_arrival_date)].filter(x => x && x !== '—').join(' · ')],
          ['Mühür', c.seal_no], ['Booking', c.booking_no],
        ]} />
      </Card>
      <Card style={{ paddingBottom: 6 }}><Timeline steps={steps} /></Card>

      {docs.data?.documents.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {docs.data.documents.map(d => (
            <Pressable key={d.id} disabled={!d.url} onPress={() => d.url && Linking.openURL(d.url)} accessibilityRole="link" accessibilityLabel={d.name}>
              <Chip icon="file" label={`${DOC_TR[d.doc_type] ?? 'Belge'} · ${d.name}`} style={{ paddingVertical: 8, paddingHorizontal: 11 }} />
            </Pressable>
          ))}
        </View>
      ) : docs.data ? <Note>Bu konteynere henüz belge eklenmemiş.</Note> : null}

      {showItems ? (
        <>
          <Lbl>Kalemler · {items.length}</Lbl>
          {items.length === 0 ? <Note>Konteynere kalem eklenmemiş.</Note> : (
            <List>
              {items.map(it => (
                <Li key={it.id} title={`${it.production_item?.project_code ?? '—'} · ${typeLabel(it.production_item?.type ?? null)}`}
                  sub={[it.quantity ? `${it.quantity} adet` : null, it.package_count ? `${it.package_count} koli` : null].filter(Boolean).join(' · ') || undefined}
                  right={it.unloaded_at ? <Chip label="İndirildi" tone="g" /> : it.loaded_at ? <Chip label="Yüklendi" tone="o" /> : <Chip label="Bekliyor" tone="n" />} />
              ))}
            </List>
          )}
        </>
      ) : null}
    </Screen>
  );
}
