// 018 · İzin talebi / 034 · Mesai düzeltme — POST /api/hr/requests (own request).
import { useState } from 'react';
import { Alert as RNAlert } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { PUNCH_TR, REASON_TR, ymd } from '@/features/hr';
import type { PunchKind } from '@/lib/shift';
import { Back, Btn, Choice, Field, Lbl, Note, Screen, Seg, Title } from '@/ui/kit';

export default function NewRequest() {
  const today = ymd(new Date());
  const [kind, setKind] = useState<'leave' | 'correction'>('leave');
  const [reason, setReason] = useState('vacation');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [punch, setPunch] = useState<PunchKind>('in');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('08:00');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    const body = kind === 'leave'
      ? { kind, reason, start_date: start, end_date: end, description }
      : { kind, correction_kind: punch, correction_at: new Date(`${date}T${time}:00`).toISOString(), description };
    setBusy(true);
    try { await api('/api/hr/requests', { method: 'POST', body }); router.back(); }
    catch (e) { RNAlert.alert('Gönderilemedi', e instanceof Error ? e.message : 'Tekrar dene.'); }
    finally { setBusy(false); }
  }

  return (
    <Screen sticky={<Btn label="Talebi gönder" onPress={send} loading={busy} style={{ flex: 0 }} />}>
      <Back label="Taleplerim" />
      <Title title="Yeni talep" sub="Yöneticin onaylar; sonuç bildirimi gelir." />
      <Seg value={kind} onChange={setKind} items={[{ key: 'leave', label: 'İzin' }, { key: 'correction', label: 'Mesai düzeltme' }]} />
      {kind === 'leave' ? (
        <>
          <Lbl>Tür</Lbl>
          <Choice value={reason} onChange={setReason} items={Object.entries(REASON_TR).map(([key, label]) => ({ key, label }))} />
          <Field label="Başlangıç (YYYY-AA-GG)" value={start} onChangeText={setStart} autoCorrect={false} />
          <Field label="Bitiş (YYYY-AA-GG)" value={end} onChangeText={setEnd} autoCorrect={false} />
        </>
      ) : (
        <>
          <Lbl>Eksik / yanlış kayıt</Lbl>
          <Choice value={punch} onChange={setPunch} items={(Object.keys(PUNCH_TR) as PunchKind[]).map(k => ({ key: k, label: PUNCH_TR[k] }))} />
          <Field label="Tarih (YYYY-AA-GG)" value={date} onChangeText={setDate} autoCorrect={false} />
          <Field label="Saat (SS:DD)" value={time} onChangeText={setTime} autoCorrect={false} />
          <Note>Onaylanınca bu kayıt mesai geçmişine &quot;düzeltme&quot; olarak eklenir.</Note>
        </>
      )}
      <Field label={kind === 'leave' ? 'Açıklama (isteğe bağlı)' : 'Neden? (zorunlu)'} value={description} onChangeText={setDescription} multiline />
    </Screen>
  );
}
