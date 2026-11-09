// 027 · Proje detay — Genel (089 teslimat planı) · Kalemler (071) · Dokümanlar (042) · Punch (091) ·
// Değişiklik (092). Each tab reads the platform API that the web project pages use; a tab whose API
// the role may not read shows that instead of failing the whole screen.
import { useState } from 'react';
import { Alert as RNAlert, Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ago, dayShort } from '@/lib/format';
import { typeLabel } from '@/features/qc';
import { openDoc } from '@/features/docs';
import {
  CR_STATUS, DELIVERY_METHOD_TR, DELIVERY_STATUS_TR, itemStatus, stageLabel,
  type ChangeRequest, type DeliveryPlan, type ItemRow, type ProjectDetail, type ProjectDoc, type PunchItem,
} from '@/features/projects';
import {
  Back, Btn, Card, Chip, Choice, Empty, ErrorView, Field, Ico, KV, Lbl, Li, List, Loading, Note, Screen, Seg, Title,
} from '@/ui/kit';

type Tab = 'info' | 'items' | 'notes' | 'docs' | 'punch' | 'cr';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('info');
  const q = useApi<{ project: ProjectDetail; items: ItemRow[] }>(`/api/mobile/projects/${id}`);

  if (q.loading) return <Screen><Back label="Projeler" /><Loading /></Screen>;
  if (q.error || !q.data) return <Screen><Back label="Projeler" /><ErrorView message={q.error ?? 'Bulunamadı'} onRetry={q.reload} /></Screen>;
  const { project: p, items } = q.data;

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Projeler" />
      <Title title={`${p.code ?? '—'} · ${p.name}`} sub={[p.site_location, p.region].filter(Boolean).join(' · ') || undefined}
        right={p.current_stage ? <Chip label={stageLabel(p.current_stage)} /> : undefined} />
      <Seg value={tab} onChange={setTab} items={[
        { key: 'info', label: 'Genel' }, { key: 'items', label: 'Kalem', count: items.length }, { key: 'notes', label: 'Not' },
      ]} />
      <Seg value={tab} onChange={setTab} items={[{ key: 'docs', label: 'Doküman' }, { key: 'punch', label: 'Punch' }, { key: 'cr', label: 'Değişiklik' }]} />
      {tab === 'info' ? <Info p={p} items={items} /> : tab === 'items' ? <Items items={items} /> : tab === 'notes' ? <Notes id={id} />
        : tab === 'docs' ? <Docs id={id} /> : tab === 'punch' ? <Punch id={id} /> : <Changes id={id} />}
    </Screen>
  );
}

function Info({ p, items }: { p: ProjectDetail; items: ItemRow[] }) {
  const plan = useApi<{ deliveryPlan: DeliveryPlan | null }>(`/api/projects/${p.id}/delivery-plan`);
  const contacts = useApi<{
    links: { id: string; customer_contact_id: string; role_on_project: string | null }[];
    contacts: { id: string; name: string; title: string | null; email: string | null; phone: string | null }[];
  }>(`/api/projects/${p.id}/customer-contacts`);
  const people = (contacts.data?.links ?? []).map(l => ({ ...l, contact: contacts.data!.contacts.find(c => c.id === l.customer_contact_id) ?? null }));
  const [accepter, setAccepter] = useState('');
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    try { await api(`/api/projects/${p.id}/delivery-plan`, { method: 'PATCH', body: { accept: true, acceptedBy: accepter } }); await plan.reload(); }
    catch (e) { RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : ''); }
    finally { setBusy(false); }
  }
  const sent = items.filter(i => i.status === 'SENT').length;
  const d = plan.data?.deliveryPlan;
  return (
    <>
      <Card>
        <KV pairs={[
          ['Aşama', stageLabel(p.current_stage)], ['Tahmini teslim', dayShort(p.est_delivery_date)],
          ['Kapanış', dayShort(p.closed_deal_date)], ['Kategoriler', (p.categories ?? []).map(typeLabel).join(', ')],
          ['Kalemler', `${items.length} · ${sent} gönderildi`], ['Bölge', p.region],
        ]} />
      </Card>
      <Lbl>Teslimat planı</Lbl>
      {plan.loading ? <Loading /> : plan.error ? <Note>{plan.error}</Note> : !d ? <Note>Teslimat planı henüz girilmemiş.</Note> : (
        <Card>
          <KV pairs={[
            ['Yöntem', d.delivery_method ? DELIVERY_METHOD_TR[d.delivery_method] ?? d.delivery_method : null],
            ['Durum', d.status ? DELIVERY_STATUS_TR[d.status] ?? d.status : null],
            ['Kurulum', dayShort(d.installation_date)], ['Bitiş', dayShort(d.build_by)],
            ['Saha hazır', d.site_confirmed ? 'Evet' : 'Hayır'], ['Müşteri kabulü', d.customer_accepted ? 'Evet' : 'Hayır'],
          ]} />
          {d.notes ? <Note>{d.notes}</Note> : null}
          {!d.customer_accepted ? (
            <View style={{ marginTop: 12 }}>
              <Field placeholder="Teslim alan müşteri yetkilisi" value={accepter} onChangeText={setAccepter} />
              <Btn kind="g" icon="check" label="Müşteri kabulünü kaydet" small style={{ alignSelf: 'flex-start' }} disabled={!accepter.trim()} loading={busy} onPress={accept} />
            </View>
          ) : null}
        </Card>
      )}
      <Lbl>Proje kişileri</Lbl>
      {contacts.loading ? <Loading /> : contacts.error ? <Note>{contacts.error}</Note> : !people.length ? <Note>Bağlı müşteri kişisi yok.</Note> : (
        <List>
          {people.map(c => (
            <Li key={c.id} left={<Ico name="user" />} title={c.contact?.name ?? 'Kişi'} sub={[c.role_on_project, c.contact?.title, c.contact?.phone ?? c.contact?.email].filter(Boolean).join(' · ') || undefined}
              chevron={!!(c.contact?.phone || c.contact?.email)}
              onPress={c.contact?.phone ? () => Linking.openURL(`tel:${c.contact!.phone}`) : c.contact?.email ? () => Linking.openURL(`mailto:${c.contact!.email}`) : undefined} />
          ))}
        </List>
      )}
    </>
  );
}

function Notes({ id }: { id: string }) {
  const q = useApi<{ notes: { id: string; content: string; is_internal: boolean; created_at: string; author: { full_name: string } | null }[] }>(`/api/mobile/projects/${id}/notes`);
  const [text, setText] = useState('');
  const [internal, setInternal] = useState<'yes' | 'no'>('yes');
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    try { await api(`/api/mobile/projects/${id}/notes`, { method: 'POST', body: { content: text, is_internal: internal === 'yes' } }); setText(''); await q.reload(); }
    catch (e) { RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : ''); }
    finally { setBusy(false); }
  }
  return (
    <>
      <Field placeholder="Saha raporu / not…" value={text} onChangeText={setText} multiline />
      <Choice value={internal} onChange={setInternal} items={[{ key: 'yes', label: 'İç not (Trust Lines)' }, { key: 'no', label: 'T-Lines ile paylaş' }]} />
      <Btn kind="d" icon="plus" label="Notu kaydet" small style={{ alignSelf: 'flex-start', marginBottom: 14 }} disabled={!text.trim()} loading={busy} onPress={add} />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : !(q.data?.notes ?? []).length ? <Empty icon="clip" tone="i" title="Not yok" /> : (
        <List>
          {q.data!.notes.map(n => (
            <Li key={n.id} left={<Ico name="clip" tone={n.is_internal ? 'n' : 'i'} />} title={n.content}
              sub={[n.author?.full_name, ago(n.created_at), n.is_internal ? 'iç not' : 'paylaşılan'].filter(Boolean).join(' · ')} />
          ))}
        </List>
      )}
    </>
  );
}

function Items({ items }: { items: ItemRow[] }) {
  if (!items.length) return <Empty icon="box" tone="i" title="Kalem yok" sub="Bu projede üretim kalemi açılmamış." />;
  return (
    <List>
      {items.map(it => {
        const st = itemStatus(it.status);
        const dates = [it.etd ? `ETD ${dayShort(it.etd)}` : null, it.rdy ? `Hazır ${dayShort(it.rdy)}` : null, it.container_no].filter(Boolean).join(' · ');
        return <Li key={it.id} left={<Ico name="box" tone={st.tone} />} title={`${typeLabel(it.type)}${it.order_type ? ` · ${it.order_type}` : ''}`}
          sub={dates || undefined} right={<Chip label={st.label} tone={st.tone} />} chevron
          onPress={() => router.push({ pathname: '/items/[id]', params: { id: it.id } })} />;
      })}
    </List>
  );
}

function Docs({ id }: { id: string }) {
  const q = useApi<{ documents: ProjectDoc[] }>(`/api/projects/${id}/documents`);
  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.reload} />;
  const docs = q.data?.documents ?? [];
  if (!docs.length) return <Empty icon="file" tone="i" title="Doküman yok" />;
  return (
    <>
      <List>
        {docs.map(d => (
          <Li key={d.id} left={<Ico name="file" />} title={d.file_name ?? d.doc_type} chevron onPress={() => openDoc(d.id)}
            sub={[d.doc_type.toUpperCase(), d.version ? `v${d.version}` : null, d.uploader?.full_name, ago(d.uploaded_at)].filter(Boolean).join(' · ')}
            right={d.status ? <Chip label={d.status} tone={d.status === 'approved' ? 'g' : 'i'} /> : undefined} />
        ))}
      </List>
      <Note>Doküman, Dropbox&apos;tan geçici bir bağlantıyla açılır.</Note>
    </>
  );
}

function Punch({ id }: { id: string }) {
  const q = useApi<{ items: PunchItem[] }>(`/api/projects/${id}/punch-list`);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, path: string, method: 'POST' | 'PATCH', body: object) {
    setBusy(key);
    try { await api(path, { method, body }); await q.reload(); if (key === 'add') setTitle(''); }
    catch (e) { RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : 'Tekrar dene.'); }
    finally { setBusy(null); }
  }

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.reload} />;
  const items = q.data?.items ?? [];
  const open = items.filter(i => i.status === 'open');
  return (
    <>
      <Field placeholder="Yeni punch maddesi…" value={title} onChangeText={setTitle} />
      <Btn kind="d" icon="plus" label="Punch ekle" small style={{ alignSelf: 'flex-start', marginBottom: 14 }}
        disabled={!title.trim()} loading={busy === 'add'}
        onPress={() => run('add', `/api/projects/${id}/punch-list`, 'POST', { title: title.trim() })} />
      {!items.length ? <Empty title="Punch listesi boş" sub="Sahada bulunan eksikleri buraya ekle." /> : (
        <>
          <Lbl>{`Açık · ${open.length} / ${items.length}`}</Lbl>
          <List>
            {items.map(i => (
              <Li key={i.id} left={<Ico name={i.status === 'done' ? 'check' : 'alert'} tone={i.status === 'done' ? 'g' : 'r'} />}
                title={i.title} sub={i.status === 'done' ? `Kapandı ${ago(i.resolved_at)}` : `Açıldı ${ago(i.created_at)}`}
                right={<Btn small kind={i.status === 'done' ? 's' : 'g'} label={i.status === 'done' ? 'Aç' : 'Kapat'} loading={busy === i.id}
                  onPress={() => run(i.id, `/api/projects/${id}/punch-list/${i.id}`, 'PATCH', { status: i.status === 'done' ? 'open' : 'done' })} />} />
            ))}
          </List>
        </>
      )}
    </>
  );
}

function Changes({ id }: { id: string }) {
  const q = useApi<{ changeRequests: ChangeRequest[] }>(`/api/projects/${id}/change-requests`);
  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.reload} />;
  const rows = q.data?.changeRequests ?? [];
  if (!rows.length) return <Empty icon="swap" tone="a" title="Değişiklik talebi yok" />;
  return (
    <View>
      <List>
        {rows.map(c => {
          const st = CR_STATUS[c.status] ?? { label: c.status, tone: 'i' as const };
          return <Li key={c.id} left={<Ico name="swap" tone="a" />} title={c.title}
            sub={[c.category, c.timeline_impact_days ? `+${c.timeline_impact_days} gün` : null, ago(c.created_at)].filter(Boolean).join(' · ')}
            right={<Chip label={st.label} tone={st.tone} />} />;
        })}
      </List>
    </View>
  );
}
