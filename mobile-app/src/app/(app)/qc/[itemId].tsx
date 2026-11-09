// 008 · QC denetim / 023 red / 076 onaylandı / 077 rework — the same actions as the web QC page:
// open an inspection (POST), decide it pass/fail with a note (PATCH), reopen a failed one as rework.
import { useState } from 'react';
import { Alert as RNAlert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ago } from '@/lib/format';
import { findItem, typeLabel, type QcQueueData } from '@/features/qc';
import { Alert, Back, Btn, Card, Chip, Empty, ErrorView, Field, Loading, Muted, Note, Row, Screen, T, Title } from '@/ui/kit';
import { UI } from '@/ui/theme';

export default function QcInspection() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const q = useApi<QcQueueData>('/api/qc/queue');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const found = q.data ? findItem(q.data, itemId) : null;

  async function call(key: string, method: 'POST' | 'PATCH', body: object, done?: string) {
    setBusy(key);
    try {
      await api('/api/qc/inspections', { method, body });
      await q.reload();
      if (done) { RNAlert.alert(done); router.back(); }
    } catch (e) {
      RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : 'Tekrar dene.');
    } finally {
      setBusy(null);
    }
  }

  if (q.loading) return <Screen><Back label="QC Kuyruğu" /><Loading /></Screen>;
  if (q.error) return <Screen><Back label="QC Kuyruğu" /><ErrorView message={q.error} onRetry={q.reload} /></Screen>;
  if (!q.data || !found) {
    return (
      <Screen><Back label="QC Kuyruğu" />
        <Empty icon="search" tone="i" title="Kalem kuyrukta değil" sub="Başka biri denetliyor olabilir ya da kalem artık QC aşamasında değil." />
      </Screen>
    );
  }

  const { row, section } = found;
  const project = q.data.projects[row.projectId];
  const who = row.conductedBy ? q.data.names[row.conductedBy] : null;
  const can = q.data.canInspect;

  const state = section === 'myInspections' ? { label: 'Açık', tone: 'a' as const }
    : section === 'completed' ? { label: 'Onaylandı', tone: 'g' as const }
      : section === 'readyForQc' ? { label: 'Bekliyor', tone: 'i' as const }
        : { label: 'Red', tone: 'r' as const };

  let sticky: React.ReactNode = null;
  if (can && section === 'myInspections' && row.inspectionId) {
    sticky = (
      <Row style={{ gap: 10 }}>
        <Btn kind="r" icon="x" label="Reddet" loading={busy === 'fail'} disabled={!!busy}
          onPress={() => {
            if (!notes.trim()) { RNAlert.alert('Not gerekli', 'Reddetmeden önce hatayı not olarak yaz.'); return; }
            void call('fail', 'PATCH', { id: row.inspectionId, result: 'fail', notes: notes.trim() }, 'Kalem reddedildi');
          }} />
        <Btn kind="g" icon="check" label="Onayla" loading={busy === 'pass'} disabled={!!busy}
          onPress={() => call('pass', 'PATCH', { id: row.inspectionId, result: 'pass', notes: notes.trim() || null }, 'Kalem onaylandı')} />
      </Row>
    );
  } else if (can && section === 'readyForQc') {
    sticky = <Btn label="Denetimi başlat" icon="clip" loading={busy === 'open'} style={{ flex: 0 }}
      onPress={() => call('open', 'POST', { production_item_id: row.itemId })} />;
  } else if (can && section === 'rework') {
    sticky = <Btn kind="d" label="Rework denetimi aç" icon="refresh" loading={busy === 'rework'} style={{ flex: 0 }}
      onPress={() => call('rework', 'POST', { production_item_id: row.itemId, rework_of_id: row.latestInspectionId })} />;
  }

  return (
    <Screen sticky={sticky} onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="QC Kuyruğu" />
      <Title title={`QC · ${typeLabel(row.type)}`} sub={project ? `${project.code} · ${project.name}` : undefined}
        right={<Chip label={state.label} tone={state.tone} />} />

      <Card>
        <Row><T w={600} color={UI.heading} style={{ flex: 1 }}>Durum</T><Muted>{state.label}</Muted></Row>
        {who ? <Row style={{ marginTop: 8 }}><T w={600} color={UI.heading} style={{ flex: 1 }}>Denetleyen</T><Muted>{who}</Muted></Row> : null}
        {row.conductedAt ? <Row style={{ marginTop: 8 }}><T w={600} color={UI.heading} style={{ flex: 1 }}>Son işlem</T><Muted>{ago(row.conductedAt)}</Muted></Row> : null}
        {row.isRework ? <Row style={{ marginTop: 8 }}><T w={600} color={UI.heading} style={{ flex: 1 }}>Tür</T><Chip label="Rework" tone="r" /></Row> : null}
      </Card>

      {section === 'myInspections' && can ? (
        <View>
          <Field label="Not" placeholder="Bulduğun hata / açıklama… (red için zorunlu)" value={notes} onChangeText={setNotes} multiline />
          <Note>Kontrol listesi ve fotoğraf yükleme sonraki sürümde; karar web ile aynı kayda yazılır.</Note>
        </View>
      ) : null}
      {section === 'failed' && !can ? <Alert title="Reddedildi" sub="Rework denetimi açıldığında kuyrukta görünür." tone="r" /> : null}
      {section === 'completed' ? <Alert title="QC onaylandı" sub={who ? `${who} tarafından` : undefined} tone="g" icon="check" /> : null}
      {!can ? <Note>Denetim kararı verme yetkin yok — sadece görüntüleyebilirsin.</Note> : null}
    </Screen>
  );
}
