// 018 / 035 · İzin & taleplerim — my leave and punch-correction requests + days used this year.
import { Alert as RNAlert, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ago, clock, dayShort } from '@/lib/format';
import { days, PUNCH_TR, REASON_TR, REQ_STATUS, type HrRequest } from '@/features/hr';
import { Back, Btn, Chip, Empty, ErrorView, Header, Ico, Lbl, Li, List, Loading, Note, Screen, Stat } from '@/ui/kit';
import { C } from '@/ui/theme';

export default function MyRequests() {
  const q = useApi<{ requests: HrRequest[] }>('/api/hr/requests');
  const rows = q.data?.requests ?? [];
  const year = String(new Date().getFullYear());
  const used = (reason: string) => rows.filter(r => r.kind === 'leave' && r.reason === reason && r.status === 'approved' && r.start_date?.startsWith(year))
    .reduce((s, r) => s + days(r.start_date!, r.end_date!), 0);

  async function cancel(id: string) {
    try { await api(`/api/hr/requests/${id}`, { method: 'PATCH', body: { action: 'cancel' } }); await q.reload(); }
    catch (e) { RNAlert.alert('İptal edilemedi', e instanceof Error ? e.message : ''); }
  }

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing} sticky={<Btn label="Yeni talep" icon="plus" style={{ flex: 0 }} onPress={() => router.push('/hr/new-request')} />}>
      <Back label="Geri" />
      <Header title="İzin & taleplerim" />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <Stat value={used('vacation')} label={`Yıllık izin · ${year} (gün)`} color={C.S600} />
            <Stat value={used('sick') + used('personal')} label="Hastalık + mazeret (gün)" color={C.warningD} />
          </View>
          <Note>İzin hakkı (bakiye) kuralları henüz tanımlı değil; burada onaylı günlerin görünür.</Note>
          <Lbl>Taleplerim</Lbl>
          {rows.length === 0 ? <Empty icon="cal" tone="i" title="Talep yok" sub="İzin ya da mesai düzeltme talebi oluşturabilirsin." /> : (
            <List>
              {rows.map(r => {
                const st = REQ_STATUS[r.status]!;
                const title = r.kind === 'leave' ? `${REASON_TR[r.reason ?? ''] ?? 'İzin'} · ${days(r.start_date!, r.end_date!)} gün` : `Mesai düzeltme · ${PUNCH_TR[r.correction_kind!]}`;
                const sub = r.kind === 'leave' ? `${dayShort(r.start_date)} – ${dayShort(r.end_date)}` : `${dayShort(r.correction_at)} ${clock(r.correction_at!)}`;
                return (
                  <Li key={r.id} left={<Ico name={r.kind === 'leave' ? 'cal' : 'clock'} tone={st.tone} />} title={title}
                    sub={[sub, r.decision_note ?? ago(r.created_at)].filter(Boolean).join(' · ')}
                    right={r.status === 'pending' ? <Btn small kind="s" label="İptal" onPress={() => cancel(r.id)} /> : <Chip label={st.label} tone={st.tone} />} />
                );
              })}
            </List>
          )}
        </>
      )}
    </Screen>
  );
}
