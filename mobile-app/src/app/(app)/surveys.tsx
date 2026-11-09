// 105 · Anket QR — marketing campaigns' public survey links as a QR to show at the store / fair.
import { useEffect, useState } from 'react';
import { Linking, Share, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import QRCode from 'qrcode';
import { useApi } from '@/lib/useApi';
import { Back, Btn, Card, Empty, ErrorView, Header, Ico, Li, List, Loading, Muted, Row, Screen, T } from '@/ui/kit';
import { UI } from '@/ui/theme';

interface Campaign { id: string; name: string; status: string | null; publicUrl: string }

function Qr({ url }: { url: string }) {
  const [xml, setXml] = useState<string | null>(null);
  useEffect(() => { QRCode.toString(url, { type: 'svg', margin: 1 }).then(setXml).catch(() => setXml(null)); }, [url]);
  return xml ? <SvgXml xml={xml} width={240} height={240} /> : <Loading />;
}

export default function Surveys() {
  const q = useApi<{ campaigns: Campaign[] }>('/api/marketing/campaigns?status=active');
  const [open, setOpen] = useState<Campaign | null>(null);
  const rows = q.data?.campaigns ?? [];
  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Anket QR" />
      {open ? (
        <Card style={{ alignItems: 'center' }}>
          <T w={700} size={18} color={UI.heading} style={{ marginBottom: 12, textAlign: 'center' }}>{open.name}</T>
          <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 16 }}><Qr url={open.publicUrl} /></View>
          <Muted style={{ marginTop: 10, textAlign: 'center' }} selectable>{open.publicUrl}</Muted>
          <Row style={{ gap: 10, marginTop: 14 }}>
            <Btn kind="s" small label="Paylaş" onPress={() => Share.share({ message: open.publicUrl })} />
            <Btn kind="s" small label="Aç" onPress={() => Linking.openURL(open.publicUrl)} />
            <Btn kind="d" small label="Kapat" onPress={() => setOpen(null)} />
          </Row>
        </Card>
      ) : null}
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : rows.length === 0 ? (
        <Empty icon="qr" tone="o" title="Aktif kampanya yok" />
      ) : (
        <List>{rows.map(c => <Li key={c.id} left={<Ico name="qr" tone="o" />} title={c.name} sub={c.status ?? undefined} chevron onPress={() => setOpen(c)} />)}</List>
      )}
    </Screen>
  );
}
