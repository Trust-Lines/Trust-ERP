// 101 · Satış fırsatları — GET /api/sales/opportunities (SALES_HANDOFF_ROLES).
import { useApi } from '@/lib/useApi';
import { dayShort } from '@/lib/format';
import { stageLabel } from '@/features/projects';
import { Back, Chip, Empty, ErrorView, Header, Ico, Li, List, Loading, Screen } from '@/ui/kit';

interface Opp { id: string; title: string | null; stage: string | null; deadline: string | null; project_types: string[] | null; project_id: string | null; created_at: string }

export default function Sales() {
  const q = useApi<{ opportunities: Opp[] }>('/api/sales/opportunities');
  const rows = q.data?.opportunities ?? [];
  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Satış fırsatları" />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : rows.length === 0 ? (
        <Empty icon="spark" tone="o" title="Fırsat yok" />
      ) : (
        <List>
          {rows.map(o => (
            <Li key={o.id} left={<Ico name="spark" tone="o" />} title={o.title ?? 'Fırsat'}
              sub={[(o.project_types ?? []).join(', '), o.deadline ? `Termin ${dayShort(o.deadline)}` : null].filter(Boolean).join(' · ') || undefined}
              right={o.stage ? <Chip label={stageLabel(o.stage)} tone={o.project_id ? 'g' : 'i'} /> : undefined} />
          ))}
        </List>
      )}
    </Screen>
  );
}
