// 007 · QC kuyruğu — Hazır / Benim / Red / Rework, grouped by project (GET /api/qc/queue).
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { ago } from '@/lib/format';
import { typeLabel, type QcQueueData, type QcRow, type QcSection } from '@/features/qc';
import { Alert, Back, Chip, Empty, ErrorView, Header, Ico, Lbl, Li, List, Loading, Screen, Seg } from '@/ui/kit';

const TABS: { key: QcSection; label: string }[] = [
  { key: 'readyForQc', label: 'Hazır' },
  { key: 'myInspections', label: 'Benim' },
  { key: 'failed', label: 'Red' },
  { key: 'rework', label: 'Rework' },
];

export default function QcQueue() {
  const q = useApi<QcQueueData>('/api/qc/queue');
  const [tab, setTab] = useState<QcSection>('readyForQc');
  const rows = q.data?.queue[tab] ?? [];

  // Group by project, keeping the API's order.
  const groups = new Map<string, QcRow[]>();
  for (const r of rows) groups.set(r.projectId, [...(groups.get(r.projectId) ?? []), r]);

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Kalite Kontrol" />
      <Seg value={tab} onChange={setTab} items={TABS.map(t => ({ ...t, count: q.data?.queue[t.key].length ?? 0 }))} />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : (
        <>
          {q.data && !q.data.migrationReady ? <Alert title="QC henüz kurulmamış" sub="068_qc_workspace.sql migration'ı uygulanmamış." /> : null}
          {rows.length === 0 ? (
            <Empty title="Kuyruk boş" sub={tab === 'readyForQc'
              ? 'Yeni bir kalem RECEIVED olduğunda burada görünür.'
              : 'Bu bölümde kalem yok.'} />
          ) : [...groups].map(([projectId, list]) => {
            const p = q.data!.projects[projectId];
            return (
              <View key={projectId}>
                <Lbl>{p ? `${p.code} · ${p.name}` : 'Proje'}</Lbl>
                <List>
                  {list.map(r => (
                    <Li key={r.itemId} left={<Ico name="clip" tone={r.result === 'fail' ? 'r' : 'g'} />}
                      title={typeLabel(r.type)}
                      sub={r.conductedAt ? `${q.data!.names[r.conductedBy ?? ''] ?? ''} · ${ago(r.conductedAt)}` : 'Denetim bekliyor'}
                      right={r.isRework ? <Chip label="Rework" tone="r" /> : r.result === 'fail' ? <Chip label="Red" tone="r" /> : undefined}
                      chevron onPress={() => router.push({ pathname: '/qc/[itemId]', params: { itemId: r.itemId } })} />
                  ))}
                </List>
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}
