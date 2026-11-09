// 014 · Onaylar — documents waiting for MY signature (GET /api/approvals/mine); a row opens 028.
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { ago } from '@/lib/format';
import { Back, Chip, Empty, ErrorView, Header, Ico, Lbl, Li, List, Loading, Screen } from '@/ui/kit';

interface MyApproval {
  approvalId: string; projectId: string; projectName: string; projectCode: string; documentId: string;
  fileName: string; docType: string; stageLabel: string; stage: number; totalStages: number; createdAt: string;
}

export default function Approvals() {
  const q = useApi<{ approvals: MyApproval[] }>('/api/approvals/mine');
  const rows = q.data?.approvals ?? [];

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Onaylar" />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : rows.length === 0 ? (
        <Empty title="İmza bekleyen yok" sub="Sana bir doküman onaya düştüğünde burada görünür." />
      ) : (
        <>
          <Lbl>{`İmzanı bekleyen · ${rows.length}`}</Lbl>
          <List>
            {rows.map(a => (
              <Li key={a.approvalId} left={<Ico name="pen" tone="a" />}
                title={`${a.docType.toUpperCase()} · ${a.fileName}`}
                sub={`${a.projectCode} · ${a.projectName} · ${ago(a.createdAt)}`}
                right={<Chip label={`${a.stage}/${a.totalStages}`} tone="a" />}
                chevron onPress={() => router.push({ pathname: '/approvals/[id]', params: {
                  id: a.approvalId, projectId: a.projectId, documentId: a.documentId, fileName: a.fileName, docType: a.docType,
                  stageLabel: a.stageLabel, stage: String(a.stage), totalStages: String(a.totalStages), project: `${a.projectCode} · ${a.projectName}`,
                } })} />
            ))}
          </List>
        </>
      )}
    </Screen>
  );
}
