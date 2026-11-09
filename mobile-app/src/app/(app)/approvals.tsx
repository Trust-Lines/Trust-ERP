// 014 · Onaylar — documents waiting for MY signature (GET /api/approvals/mine). Signing needs the
// document in view and the saved signature, so it opens on the web for now (mobile viewer + 028
// signing come next).
import { Linking } from 'react-native';
import { useApi } from '@/lib/useApi';
import { API_URL } from '@/lib/api';
import { ago } from '@/lib/format';
import { Back, Chip, Empty, ErrorView, Header, Ico, Lbl, Li, List, Loading, Note, Screen } from '@/ui/kit';

interface MyApproval {
  approvalId: string; projectId: string; projectName: string; projectCode: string;
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
                label={`${a.fileName}, web'de aç`}
                onPress={() => Linking.openURL(`${API_URL}/projects/${a.projectId}`)} />
            ))}
          </List>
          <Note>Dokümanı görüp imzalamak için web&apos;de açılır.</Note>
        </>
      )}
    </Screen>
  );
}
