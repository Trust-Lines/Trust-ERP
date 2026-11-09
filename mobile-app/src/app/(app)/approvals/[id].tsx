// 028 · İmzala / 096 · İmza zinciri / 097 · Revize iste — the web's POST /api/projects/[id]/doc-approvals
// (approve | reject + note). Approving stamps the saved signature, so it needs one on the profile.
import { useState } from 'react';
import { Alert as RNAlert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, API_URL } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ago } from '@/lib/format';
import { openDoc } from '@/features/docs';
import { Alert, Back, Btn, Card, Field, KV, Lbl, Loading, Note, Row, Screen, Timeline, Title } from '@/ui/kit';

interface Stage { id: string; stage: number; status: string; approved_by: string | null; notes: string | null; resolved_at: string | null; created_at: string }

export default function Sign() {
  const p = useLocalSearchParams<{ id: string; projectId: string; documentId: string; fileName: string; docType: string; stageLabel: string; stage: string; totalStages: string; project: string }>();
  const chain = useApi<{ approvals: Stage[] }>(`/api/projects/${p.projectId}/doc-approvals?documentId=${p.documentId}`);
  const sig = useApi<{ base64: string | null }>('/api/user/signature');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: 'approve' | 'reject') {
    if (action === 'reject' && !note.trim()) { RNAlert.alert('Not gerekli', 'Neyin değişmesi gerektiğini yaz.'); return; }
    setBusy(action);
    try {
      await api(`/api/projects/${p.projectId}/doc-approvals`, { method: 'POST', body: { action, approvalId: p.id, notes: action === 'reject' ? note.trim() : undefined } });
      RNAlert.alert(action === 'approve' ? 'İmzalandı' : 'Revize istendi');
      router.back();
    } catch (e) {
      RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : '');
    } finally { setBusy(null); }
  }

  const stages = (chain.data?.approvals ?? []).slice().sort((a, b) => a.stage - b.stage);
  const noSig = sig.data && !sig.data.base64;
  return (
    <Screen sticky={
      <Row style={{ gap: 10 }}>
        <Btn kind="s" label="Revize iste" loading={busy === 'reject'} disabled={!!busy} onPress={() => act('reject')} />
        <Btn kind="p" icon="pen" label="İmzala" loading={busy === 'approve'} disabled={!!busy || !!noSig || sig.loading} onPress={() => act('approve')} />
      </Row>
    }>
      <Back label="Onaylar" />
      <Title title={p.fileName} sub={p.project} />
      <Card><KV pairs={[['Doküman', p.docType?.toUpperCase()], ['Aşama', `${p.stage}/${p.totalStages} · ${p.stageLabel}`]]} /></Card>
      <Btn kind="d" icon="file" label="Dokümanı aç" style={{ flex: 0, marginBottom: 12 }} onPress={() => openDoc(p.documentId)} />
      {noSig ? (
        <>
          <Alert title="Kayıtlı imzan yok" sub="İmza, onaylanan PDF'e basılır. Web'de Ayarlar → İmza bölümünden bir kez kaydet." tone="a" icon="pen" />
          <Btn kind="s" small label="Web'de imza kaydet" style={{ alignSelf: 'flex-start', marginBottom: 12 }} onPress={() => Linking.openURL(`${API_URL}/settings`)} />
        </>
      ) : null}
      <Lbl>İmza zinciri</Lbl>
      {chain.loading ? <Loading /> : !stages.length ? <Note>Zincir bilgisi yok.</Note> : (
        <Card><Timeline steps={stages.map(s => ({
          title: `Aşama ${s.stage}`,
          sub: s.status === 'approved' ? `Onaylandı ${ago(s.resolved_at)}` : s.status === 'rejected' ? `Revize istendi${s.notes ? ` · ${s.notes}` : ''}` : 'Bekliyor',
          state: s.status === 'approved' ? 'done' as const : s.status === 'rejected' ? 'red' as const : String(s.stage) === p.stage ? 'cur' as const : 'nx' as const,
        }))} /></Card>
      )}
      <Field label="Revize notu" placeholder="Revize isteyeceksen neyin değişmesi gerektiğini yaz…" value={note} onChangeText={setNote} multiline />
    </Screen>
  );
}
