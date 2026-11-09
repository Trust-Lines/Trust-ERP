// 043 · Projeler — GET /api/mobile/projects (same visibility as the web list, light columns).
import { useState } from 'react';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { dayShort } from '@/lib/format';
import { stageLabel, type ProjectRow } from '@/features/projects';
import { Back, Chip, Empty, ErrorView, Field, Header, Ico, Li, List, Loading, Screen } from '@/ui/kit';

export default function Projects() {
  const [q, setQ] = useState('');
  const res = useApi<{ projects: ProjectRow[] }>('/api/mobile/projects');
  const needle = q.trim().toLocaleLowerCase('tr-TR');
  const rows = (res.data?.projects ?? []).filter(p =>
    !needle || `${p.code ?? ''} ${p.name}`.toLocaleLowerCase('tr-TR').includes(needle));

  return (
    <Screen onRefresh={res.reload} refreshing={res.refreshing}>
      <Back label="Geri" />
      <Header title="Projeler" />
      <Field icon="search" placeholder="Kod veya proje adı ara…" value={q} onChangeText={setQ} autoCorrect={false} />
      {res.loading ? <Loading /> : res.error ? <ErrorView message={res.error} onRetry={res.reload} /> : rows.length === 0 ? (
        <Empty icon="folder" tone="i" title={needle ? 'Eşleşen proje yok' : 'Proje yok'} sub={needle ? 'Başka bir kod veya isim dene.' : 'Görebileceğin aktif proje bulunmuyor.'} />
      ) : (
        <List>
          {rows.map(p => (
            <Li key={p.id} left={<Ico name="folder" />} title={`${p.code ?? '—'} · ${p.name}`}
              sub={[p.site_location ?? p.region, p.est_delivery_date ? `Teslim ${dayShort(p.est_delivery_date)}` : null].filter(Boolean).join(' · ') || undefined}
              right={p.current_stage ? <Chip label={stageLabel(p.current_stage)} /> : undefined}
              chevron onPress={() => router.push({ pathname: '/projects/[id]', params: { id: p.id } })} />
          ))}
        </List>
      )}
    </Screen>
  );
}
