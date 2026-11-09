// 033 · Vardiya planım / 068 · Vardiya planla (yönetici) — next 14 days. Managers add or remove
// plans for their people; everyone sees their own.
import { useState } from 'react';
import { Alert as RNAlert, View } from 'react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { dayShort } from '@/lib/format';
import { ymd, type HrShift, type TeamPerson } from '@/features/hr';
import { Back, Btn, Card, Choice, Empty, ErrorView, Field, Header, Ico, Lbl, Li, List, Loading, Screen, Seg } from '@/ui/kit';

export default function Shifts() {
  const [[from, to]] = useState(() => [ymd(new Date()), ymd(new Date(Date.now() + 13 * 864e5))]);
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const q = useApi<{ shifts: HrShift[]; names: Record<string, string> }>(`/api/hr/shifts?scope=${scope}&from=${from}&to=${to}`);
  const team = useApi<{ people: TeamPerson[] }>('/api/hr/team');
  const people = team.data?.people ?? [];
  const [who, setWho] = useState('');
  const [date, setDate] = useState(from);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('17:30');
  const [site, setSite] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try { await api('/api/hr/shifts', { method: 'POST', body: { user_id: who, shift_date: date, start_time: start, end_time: end, site } }); await q.reload(); }
    catch (e) { RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : ''); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    try { await api(`/api/hr/shifts?id=${id}`, { method: 'DELETE' }); await q.reload(); }
    catch (e) { RNAlert.alert('Silinemedi', e instanceof Error ? e.message : ''); }
  }

  const rows = q.data?.shifts ?? [];
  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Vardiya planı" />
      {people.length ? <Seg value={scope} onChange={setScope} items={[{ key: 'mine', label: 'Benim' }, { key: 'team', label: 'Ekibim' }]} /> : null}
      {scope === 'team' && people.length ? (
        <Card>
          <Lbl>Vardiya ekle</Lbl>
          <Choice value={who} onChange={setWho} items={people.map(p => ({ key: p.id, label: p.full_name }))} />
          <Field label="Tarih (YYYY-AA-GG)" value={date} onChangeText={setDate} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Başlangıç" value={start} onChangeText={setStart} /></View>
            <View style={{ flex: 1 }}><Field label="Bitiş" value={end} onChangeText={setEnd} /></View>
          </View>
          <Field label="Yer (isteğe bağlı)" value={site} onChangeText={setSite} />
          <Btn kind="d" label="Ekle" icon="plus" style={{ flex: 0 }} disabled={!who} loading={busy} onPress={add} />
        </Card>
      ) : null}
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : rows.length === 0 ? (
        <Empty icon="cal" tone="i" title="Plan yok" sub="Önümüzdeki 14 gün için planlanmış vardiya bulunmuyor." />
      ) : (
        <List>
          {rows.map(s => (
            <Li key={s.id} left={<Ico name="cal" />} title={`${dayShort(s.shift_date)} · ${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`}
              sub={[scope === 'team' ? q.data!.names[s.user_id] : null, s.site, s.note].filter(Boolean).join(' · ') || undefined}
              right={scope === 'team' ? <Btn small kind="s" label="Kaldır" onPress={() => remove(s.id)} /> : undefined} />
          ))}
        </List>
      )}
    </Screen>
  );
}
