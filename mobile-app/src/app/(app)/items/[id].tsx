// 006 · Ürün kartı / 021 · Durum güncelle / 039 · Rafa yerleştir / 072 · Ürün geçmişi.
// Status changes go through the web's own PATCH /api/production/items/[id] (edit.production);
// the shelf through PUT /api/mobile/items/[id]/location (warehouse roles). No prices on this screen.
import { useState } from 'react';
import { Alert as RNAlert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ago, dayShort } from '@/lib/format';
import { typeLabel } from '@/features/qc';
import { itemStatus, ITEM_STATUS } from '@/features/projects';
import { Back, Btn, Card, Choice, ErrorView, Field, KV, Lbl, Loading, Note, Row, Screen, Timeline, Title, Chip } from '@/ui/kit';

interface ItemData {
  item: { id: string; project_id: string; type: string; order_type: string | null; status: string; pf_code?: string | null;
    std: string | null; etd: string | null; rdy: string | null; snd: string | null; container_no: string | null };
  project: { id: string; code: string; name: string } | null;
  location: { location: string; received_at: string | null; updated_at: string } | null;
  history: { action: string; status: string | null; at: string; by: string | null }[];
}
const CHAIN = ['NOT_ORDERED', 'ORDERED', 'WAITING_PAYMENT', 'READY_TO_RECEIVE', 'RECEIVED', 'READY', 'SENT_TO_TLINES', 'PARTIAL_SENT', 'SENT'];

export default function ItemCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<ItemData>(`/api/mobile/items/${id}`);
  const [status, setStatus] = useState<string | null>(null);
  const [shelf, setShelf] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, path: string, method: 'PATCH' | 'PUT', body: object) {
    setBusy(key);
    try { await api(path, { method, body }); await q.reload(); setStatus(null); setShelf(''); }
    catch (e) { RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : ''); }
    finally { setBusy(null); }
  }

  if (q.loading) return <Screen><Back label="Geri" /><Loading /></Screen>;
  if (q.error || !q.data) return <Screen><Back label="Geri" /><ErrorView message={q.error ?? 'Bulunamadı'} onRetry={q.reload} /></Screen>;
  const { item: it, project, location, history } = q.data;
  const st = itemStatus(it.status);
  const at = CHAIN.indexOf(it.status);
  const options = [...CHAIN.slice(Math.max(0, at - 1), at + 3), 'HOLD_T', 'HOLD_PM'].filter((s, i, a) => s !== it.status && a.indexOf(s) === i);
  const chosen = status ?? '';

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Title title={`${typeLabel(it.type)}${it.pf_code ? ` · ${it.pf_code}` : ''}`} sub={project ? `${project.code} · ${project.name}` : undefined}
        right={<Chip label={st.label} tone={st.tone} />} />
      <Card>
        <KV pairs={[
          ['Sipariş tipi', it.order_type], ['Konteyner', it.container_no],
          ['ETD', dayShort(it.etd)], ['Hazır', dayShort(it.rdy)], ['Gönderim', dayShort(it.snd)],
          ['Raf', location?.location ?? null],
        ]} />
      </Card>
      {project ? <Btn kind="s" small icon="folder" label="Projeyi aç" style={{ alignSelf: 'flex-start', marginBottom: 12 }}
        onPress={() => router.push({ pathname: '/projects/[id]', params: { id: project.id } })} /> : null}

      <Lbl>Durumu güncelle</Lbl>
      <Choice value={chosen} onChange={setStatus} items={options.map(s => ({ key: s, label: ITEM_STATUS[s]?.label ?? s }))} />
      <Btn kind="d" label={chosen ? `“${ITEM_STATUS[chosen]?.label ?? chosen}” yap` : 'Bir durum seç'} disabled={!chosen} loading={busy === 'status'} style={{ flex: 0, marginBottom: 14 }}
        onPress={() => run('status', `/api/production/items/${it.id}`, 'PATCH', { status: chosen })} />

      <Lbl>Raf / konum</Lbl>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Field placeholder={location?.location ?? 'Örn. B-3-12'} value={shelf} onChangeText={setShelf} autoCapitalize="characters" /></View>
        <Btn small label={location ? 'Taşı' : 'Yerleştir'} disabled={!shelf.trim()} loading={busy === 'shelf'}
          onPress={() => run('shelf', `/api/mobile/items/${it.id}/location`, 'PUT', { location: shelf, received: true })} />
      </Row>
      {location?.received_at ? <Note>{`Teslim alındı ${ago(location.received_at)} · son konum güncellemesi ${ago(location.updated_at)}`}</Note> : null}

      <Lbl>Geçmiş</Lbl>
      {history.length === 0 ? <Note>Kayıtlı değişiklik yok.</Note> : (
        <Card><Timeline steps={history.map(h => ({
          title: h.status ? `→ ${ITEM_STATUS[h.status]?.label ?? h.status}` : h.action === 'production.item_deleted' ? 'Silindi' : 'Güncellendi',
          sub: [h.by, ago(h.at)].filter(Boolean).join(' · '), state: 'done' as const,
        }))} /></Card>
      )}
    </Screen>
  );
}
