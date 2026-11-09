// 066 · İzin onayı (yönetici) — requests of the people I manage; approve / reject with a note.
import { useState } from 'react';
import { Alert as RNAlert, View } from 'react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ago, clock, dayShort } from '@/lib/format';
import { days, PUNCH_TR, REASON_TR, REQ_STATUS, type HrRequest } from '@/features/hr';
import { Back, Btn, Card, Chip, Empty, ErrorView, Field, Header, Loading, Muted, Row, Screen, Seg, T } from '@/ui/kit';
import { UI } from '@/ui/theme';

export default function HrApprovals() {
  const q = useApi<{ requests: HrRequest[]; names: Record<string, string> }>('/api/hr/requests?scope=team');
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const all = q.data?.requests ?? [];
  const rows = all.filter(r => (tab === 'pending') === (r.status === 'pending'));

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id + action);
    try { await api(`/api/hr/requests/${id}`, { method: 'PATCH', body: { action, note: notes[id] ?? '' } }); await q.reload(); }
    catch (e) { RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : ''); }
    finally { setBusy(null); }
  }

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Ekip talepleri" />
      <Seg value={tab} onChange={setTab} items={[{ key: 'pending', label: 'Bekleyen', count: all.filter(r => r.status === 'pending').length }, { key: 'done', label: 'Karar verilen' }]} />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : rows.length === 0 ? (
        <Empty title={tab === 'pending' ? 'Bekleyen talep yok' : 'Kayıt yok'} />
      ) : rows.map(r => {
        const st = REQ_STATUS[r.status]!;
        return (
          <Card key={r.id}>
            <Row>
              <View style={{ flex: 1 }}>
                <T w={600} color={UI.heading}>{q.data!.names[r.user_id] ?? 'Çalışan'}</T>
                <Muted>{r.kind === 'leave'
                  ? `${REASON_TR[r.reason ?? ''] ?? 'İzin'} · ${dayShort(r.start_date)} – ${dayShort(r.end_date)} · ${days(r.start_date!, r.end_date!)} gün`
                  : `Mesai düzeltme · ${PUNCH_TR[r.correction_kind!]} ${dayShort(r.correction_at)} ${clock(r.correction_at!)}`}</Muted>
              </View>
              <Chip label={st.label} tone={st.tone} />
            </Row>
            {r.description ? <Muted style={{ marginTop: 8 }}>{r.description}</Muted> : null}
            {r.status === 'pending' ? (
              <View style={{ marginTop: 10 }}>
                <Field placeholder="Not (red için zorunlu)" value={notes[r.id] ?? ''} onChangeText={t => setNotes(n => ({ ...n, [r.id]: t }))} />
                <Row style={{ gap: 10 }}>
                  <Btn kind="r" icon="x" label="Reddet" small style={{ flex: 1 }} loading={busy === r.id + 'reject'} onPress={() => decide(r.id, 'reject')} />
                  <Btn kind="g" icon="check" label="Onayla" small style={{ flex: 1 }} loading={busy === r.id + 'approve'} onPress={() => decide(r.id, 'approve')} />
                </Row>
              </View>
            ) : <Muted style={{ marginTop: 6 }}>{[r.decision_note, ago(r.decided_at)].filter(Boolean).join(' · ')}</Muted>}
          </Card>
        );
      })}
    </Screen>
  );
}
