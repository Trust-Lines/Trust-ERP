// 016 · Görevler — everything waiting on me, per my-day section (GET /api/my-day). The items come
// from the live state of projects/approvals/QC, so they close themselves when the work is done.
import { View } from 'react-native';
import { useApi } from '@/lib/useApi';
import { openHref } from '@/lib/nav';
import { SECTION_UI, toneOf, type MyDay } from '@/features/myDay';
import { Chip, Empty, ErrorView, Header, Ico, Lbl, Li, List, Loading, Screen } from '@/ui/kit';

export default function Tasks() {
  const q = useApi<MyDay>('/api/my-day');
  const sections = (q.data?.sections ?? []).filter(s => s.items.length > 0);

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Header title="Görevler" />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : sections.length === 0 ? (
        <Empty title="Her şey yolunda" sub="Şu an seni bekleyen bir iş yok. Yeni bir iş geldiğinde burada görünür." />
      ) : sections.map(sec => {
        const ui = SECTION_UI[sec.key] ?? SECTION_UI.default!;
        return (
          <View key={sec.key}>
            <Lbl>{`${ui.title} · ${sec.items.length}`}</Lbl>
            <List>
              {sec.items.map((it, i) => (
                <Li key={i} left={<Ico name={ui.icon} tone={ui.tone} />} title={it.label} sub={it.sublabel}
                  right={it.badge ? <Chip label={it.badge} tone={toneOf(it.tone)} /> : undefined}
                  chevron={!it.badge} onPress={() => openHref(it.href)} />
              ))}
            </List>
          </View>
        );
      })}
    </Screen>
  );
}
