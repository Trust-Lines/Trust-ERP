// 079 · Yeni konteyner — POST /api/containers (CONTAINER_WRITE_ROLES).
import { useState } from 'react';
import { Alert as RNAlert } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import type { Container } from '@/features/containers';
import { Back, Btn, Field, Screen, Title } from '@/ui/kit';

const FIELDS: [keyof Container, string, string?][] = [
  ['container_no', 'Konteyner no', 'TLNU 480012-7'], ['booking_no', 'Booking no'], ['carrier', 'Taşıyıcı', 'MSC'],
  ['vessel_name', 'Gemi'], ['voyage_no', 'Sefer'], ['origin_port', 'Yükleme limanı', 'İzmit'], ['destination_port', 'Varış limanı', 'Newark'],
  ['departure_date', 'Kalkış (YYYY-AA-GG)'], ['estimated_arrival_date', 'Tahmini varış (YYYY-AA-GG)'], ['seal_no', 'Mühür no'], ['tracking_url', 'Takip linki'],
];

export default function NewContainer() {
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const { container } = await api<{ container: Container }>('/api/containers', { method: 'POST', body: { ...v, status: 'PLANNING' } });
      router.replace({ pathname: '/containers/[id]', params: { id: container.id } });
    } catch (e) { RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : ''); }
    finally { setBusy(false); }
  }
  return (
    <Screen sticky={<Btn label="Konteyneri aç" onPress={save} loading={busy} disabled={!v.container_no?.trim() && !v.booking_no?.trim()} style={{ flex: 0 }} />}>
      <Back label="Konteynerler" />
      <Title title="Yeni konteyner" sub="Konteyner ya da booking numarası yeterli; gerisini sonra doldurabilirsin." />
      {FIELDS.map(([k, label, ph]) => (
        <Field key={k} label={label} placeholder={ph} value={v[k] ?? ''} autoCapitalize={k === 'tracking_url' ? 'none' : 'characters'}
          onChangeText={t => setV(o => ({ ...o, [k]: t }))} />
      ))}
    </Screen>
  );
}
