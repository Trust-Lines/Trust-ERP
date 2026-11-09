// 049 · Global arama — projects, items (PF code), containers, customers the role may open.
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { typeLabel } from '@/features/qc';
import { itemStatus, stageLabel } from '@/features/projects';
import { STATUS_TR } from '@/features/containers';
import { Back, Chip, Empty, Field, Ico, Lbl, Li, List, Loading, Screen } from '@/ui/kit';

interface Hits {
  projects: { id: string; code: string; name: string; current_stage: string | null }[];
  items: { id: string; pf_code: string | null; type: string; status: string }[];
  containers: { id: string; container_no: string | null; booking_no: string | null; status: string }[];
  customers: { id: string; name: string; code: string | null; industry: string | null }[];
}

export default function Search() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hits | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => {
      setBusy(true);
      api<Hits>(`/api/mobile/search?q=${encodeURIComponent(term)}`).then(setHits).catch(() => setHits(null)).finally(() => setBusy(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const h = q.trim().length >= 2 ? hits : null;
  const total = h ? h.projects.length + h.items.length + h.containers.length + h.customers.length : 0;

  return (
    <Screen>
      <Back label="Geri" />
      <Field icon="search" placeholder="Proje, PF kodu, konteyner, müşteri…" value={q} onChangeText={setQ} autoFocus autoCorrect={false} autoCapitalize="none" />
      {busy ? <Loading /> : !h ? null : total === 0 ? <Empty icon="search" tone="i" title="Sonuç yok" /> : (
        <>
          {h.projects.length ? <><Lbl>Proje</Lbl><List>{h.projects.map(p => (
            <Li key={p.id} left={<Ico name="folder" />} title={`${p.code} · ${p.name}`} right={p.current_stage ? <Chip label={stageLabel(p.current_stage)} /> : undefined}
              chevron onPress={() => router.push({ pathname: '/projects/[id]', params: { id: p.id } })} />))}</List></> : null}
          {h.items.length ? <><Lbl>Kalemler</Lbl><List>{h.items.map(i => (
            <Li key={i.id} left={<Ico name="box" />} title={`${i.pf_code ?? '—'} · ${typeLabel(i.type)}`} right={<Chip label={itemStatus(i.status).label} tone={itemStatus(i.status).tone} />}
              chevron onPress={() => router.push({ pathname: '/items/[id]', params: { id: i.id } })} />))}</List></> : null}
          {h.containers.length ? <><Lbl>Konteyner</Lbl><List>{h.containers.map(c => (
            <Li key={c.id} left={<Ico name="anchor" />} title={c.container_no ?? c.booking_no ?? 'Konteyner'} right={<Chip label={STATUS_TR[c.status] ?? c.status} />}
              chevron onPress={() => router.push({ pathname: '/containers/[id]', params: { id: c.id } })} />))}</List></> : null}
          {h.customers.length ? <><Lbl>Müşteri</Lbl><List>{h.customers.map(c => (
            <Li key={c.id} left={<Ico name="building" />} title={c.name} sub={[c.code, c.industry].filter(Boolean).join(' · ') || undefined}
              chevron onPress={() => router.push({ pathname: '/customers/[id]', params: { id: c.id } })} />))}</List></> : null}
        </>
      )}
    </Screen>
  );
}
