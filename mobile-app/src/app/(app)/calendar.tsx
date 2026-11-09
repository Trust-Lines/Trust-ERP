// 087 · Sevkiyat takvimi / 088 · Takvimim / 089 — delivery plans + installations, next 30 days.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { ymd } from '@/features/hr';
import { DELIVERY_METHOD_TR } from '@/features/projects';
import { Back, Chip, Empty, ErrorView, Header, Ico, Lbl, Li, List, Loading, Screen } from '@/ui/kit';

interface Delivery { project_id: string; project_code: string; project_name: string; delivery_method: string | null; installation_date: string | null; build_by: string | null; status: string | null; site_confirmed: boolean | null }
interface Install { id: string; project_no: string | null; project_name: string | null; city_state: string | null; planned_start: string | null; planned_finish: string | null; team: string | null; status: string | null }
type Ev = { key: string; date: string; title: string; sub: string; kind: 'delivery' | 'install'; projectId?: string; warn?: boolean };

export default function Calendar() {
  const [[from, to]] = useState(() => [ymd(new Date()), ymd(new Date(Date.now() + 30 * 864e5))]);
  const q = useApi<{ deliveries: Delivery[]; installations: Install[] }>(`/api/mobile/deliveries?from=${from}&to=${to}`);
  const evs: Ev[] = [
    ...(q.data?.deliveries ?? []).map(d => ({
      key: `d${d.project_id}`, date: d.installation_date ?? d.build_by ?? '', kind: 'delivery' as const, projectId: d.project_id,
      title: `${d.project_code} · ${d.project_name}`, sub: [d.delivery_method ? DELIVERY_METHOD_TR[d.delivery_method] : null, d.site_confirmed ? 'Saha hazır' : 'Saha onayı yok'].filter(Boolean).join(' · '), warn: !d.site_confirmed,
    })),
    ...(q.data?.installations ?? []).map(i => ({
      key: `i${i.id}`, date: i.planned_start ?? '', kind: 'install' as const,
      title: [i.project_no, i.project_name].filter(Boolean).join(' · ') || 'Kurulum', sub: [i.city_state, i.team].filter(Boolean).join(' · '),
    })),
  ].filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date));
  const byDay = new Map<string, Ev[]>();
  for (const e of evs) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Takvim" />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : evs.length === 0 ? (
        <Empty icon="cal" tone="i" title="Önümüzdeki 30 gün boş" />
      ) : [...byDay].map(([day, list]) => (
        <View key={day}>
          <Lbl>{new Date(`${day}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</Lbl>
          <List>{list.map(e => (
            <Li key={e.key} left={<Ico name={e.kind === 'delivery' ? 'truck' : 'cal'} tone={e.warn ? 'a' : 'i'} />} title={e.title} sub={e.sub || undefined}
              right={<Chip label={e.kind === 'delivery' ? 'Teslimat' : 'Kurulum'} tone={e.kind === 'delivery' ? 'o' : 'i'} />}
              chevron={!!e.projectId} onPress={e.projectId ? () => router.push({ pathname: '/projects/[id]', params: { id: e.projectId! } }) : undefined} />
          ))}</List>
        </View>
      ))}
    </Screen>
  );
}
