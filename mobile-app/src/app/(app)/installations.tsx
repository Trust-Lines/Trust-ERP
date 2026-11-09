// 090 / 088 · Kurulum planı — GET /api/installations (T-Lines PM → Installation).
import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { dayShort } from '@/lib/format';
import { Back, Chip, Empty, ErrorView, Header, Ico, Li, List, Loading, Screen, Seg } from '@/ui/kit';
import type { Tone } from '@/ui/theme';

interface Install { id: string; project_no: string | null; project_name: string | null; branch: string | null; city_state: string | null; planned_start: string | null; planned_finish: string | null; team: string | null; status: string | null; blockers: string | null }
const ST: Record<string, { label: string; tone: Tone }> = {
  'Not Started': { label: 'Başlamadı', tone: 'n' }, 'In Progress': { label: 'Devam ediyor', tone: 'i' }, Completed: { label: 'Tamamlandı', tone: 'g' },
  Delayed: { label: 'Gecikmede', tone: 'r' }, 'On Hold': { label: 'Beklemede', tone: 'a' },
};

export default function Installations() {
  const q = useApi<{ rows: Install[] }>('/api/installations');
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const all = q.data?.rows ?? [];
  const rows = all.filter(r => (tab === 'done') === (r.status === 'Completed'));
  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Kurulumlar" />
      <Seg value={tab} onChange={setTab} items={[{ key: 'open', label: 'Aktif', count: all.filter(r => r.status !== 'Completed').length }, { key: 'done', label: 'Tamamlanan' }]} />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : rows.length === 0 ? (
        <Empty icon="cal" tone="i" title="Kurulum yok" />
      ) : (
        <List>
          {rows.map(r => {
            const st = ST[r.status ?? ''] ?? { label: r.status ?? '—', tone: 'n' as Tone };
            return <Li key={r.id} left={<Ico name={r.blockers ? 'alert' : 'cal'} tone={r.blockers ? 'r' : 'i'} />}
              title={[r.project_no, r.project_name].filter(Boolean).join(' · ') || 'Kurulum'}
              sub={[r.city_state, r.planned_start ? `${dayShort(r.planned_start)} – ${dayShort(r.planned_finish)}` : null, r.team].filter(Boolean).join(' · ') || undefined}
              right={<Chip label={st.label} tone={st.tone} />} />;
          })}
        </List>
      )}
    </Screen>
  );
}
