// Müşteri detayı + kişiler — GET /api/customers/[id]. Tapping a phone / e-mail opens the dialer / mail.
import { useState } from 'react';
import { Alert as RNAlert, Linking } from 'react-native';
import { api } from '@/lib/api';
import { useLocalSearchParams } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { Back, Btn, Card, Chip, Choice, ErrorView, Field, Ico, KV, Lbl, Li, List, Loading, Note, Screen, Title } from '@/ui/kit';

interface Contact { id: string; name: string; title: string | null; email: string | null; phone: string | null; is_primary: boolean; is_authorized_approver: boolean }
interface CustomerFull { id: string; name: string; code: string | null; industry: string | null; email: string | null; phone: string | null; website: string | null; status: string | null; notes: string | null }

export default function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<{ customer: CustomerFull; contacts: Contact[] }>(`/api/customers/${id}`);
  const [visit, setVisit] = useState({ type: 'site_visit', title: '', location: '', notes: '' });
  const [busy, setBusy] = useState(false);
  // 104 · Mağaza ziyareti — logged as a completed customer meeting (POST /api/customers/[id]/meetings).
  async function logVisit() {
    setBusy(true);
    try {
      await api(`/api/customers/${id}/meetings`, { method: 'POST', body: {
        title: visit.title.trim(), meeting_type: visit.type, location: visit.location.trim() || undefined,
        notes: visit.notes.trim() || undefined, meeting_at: new Date().toISOString(), status: 'completed',
      } });
      setVisit({ type: 'site_visit', title: '', location: '', notes: '' });
      RNAlert.alert('Ziyaret kaydedildi');
    } catch (e) { RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : ''); }
    finally { setBusy(false); }
  }
  if (q.loading) return <Screen><Back label="Müşteriler" /><Loading /></Screen>;
  if (q.error || !q.data) return <Screen><Back label="Müşteriler" /><ErrorView message={q.error ?? 'Bulunamadı'} onRetry={q.reload} /></Screen>;
  const { customer: c, contacts } = q.data;
  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Müşteriler" />
      <Title title={c.name} sub={[c.code, c.industry].filter(Boolean).join(' · ') || undefined}
        right={c.status ? <Chip label={c.status} tone={c.status === 'active' ? 'g' : 'n'} /> : undefined} />
      <Card><KV pairs={[['E-posta', c.email], ['Telefon', c.phone], ['Web', c.website], ['Durum', c.status]]} /></Card>
      {c.notes ? <Note>{c.notes}</Note> : null}
      <Lbl>{`Kişiler · ${contacts.length}`}</Lbl>
      {contacts.length === 0 ? <Note>Kayıtlı kişi yok.</Note> : (
        <List>
          {contacts.map(p => (
            <Li key={p.id} left={<Ico name="user" tone={p.is_primary ? 'o' : 'i'} />} title={p.name}
              sub={[p.title, p.phone ?? p.email].filter(Boolean).join(' · ') || undefined}
              right={p.is_authorized_approver ? <Chip label="Onaylayıcı" tone="g" /> : undefined}
              chevron={!!(p.phone || p.email)}
              onPress={p.phone ? () => Linking.openURL(`tel:${p.phone}`) : p.email ? () => Linking.openURL(`mailto:${p.email}`) : undefined} />
          ))}
        </List>
      )}
      <Lbl>Ziyaret / görüşme kaydet</Lbl>
      <Card>
        <Choice value={visit.type} onChange={t => setVisit(v => ({ ...v, type: t }))} items={[
          { key: 'site_visit', label: 'Mağaza ziyareti' }, { key: 'discovery', label: 'Keşif' }, { key: 'presentation', label: 'Sunum' }, { key: 'other', label: 'Diğer' },
        ]} />
        <Field placeholder="Başlık" value={visit.title} onChangeText={t => setVisit(v => ({ ...v, title: t }))} />
        <Field placeholder="Yer (mağaza / adres)" value={visit.location} onChangeText={t => setVisit(v => ({ ...v, location: t }))} />
        <Field placeholder="Notlar" value={visit.notes} onChangeText={t => setVisit(v => ({ ...v, notes: t }))} multiline />
        <Btn kind="d" label="Kaydet" style={{ flex: 0 }} disabled={!visit.title.trim()} loading={busy} onPress={logVisit} />
      </Card>
    </Screen>
  );
}
