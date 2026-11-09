// 005 · QR tarayıcı / 006 · ürün kartı / 044 · Kod tanınmadı. Resolves platform links (→ native screen
// or web), production item PF codes (→ product card) and container / booking numbers (→ container).
// Anything else shows the "not recognized" sheet with the raw code.
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, API_URL } from '@/lib/api';
import { openHref } from '@/lib/nav';
import type { Container } from '@/features/containers';
import { Btn, Ico, Muted, Row, T } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { C, UI } from '@/ui/theme';

type Result = { kind: 'busy' } | { kind: 'link'; url: string } | { kind: 'unknown'; code: string };
const norm = (s: string | null | undefined) => (s ?? '').replace(/[\s-]/g, '').toUpperCase();

export default function Scan() {
  const [perm, requestPerm] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const handled = useRef(false);

  async function onScan({ data }: BarcodeScanningResult) {
    if (handled.current) return;
    handled.current = true;
    const code = data.trim();
    try {
      const base = new URL(API_URL);
      const url = new URL(code);
      if (url.host === base.host) { router.back(); openHref(url.pathname + url.search); return; }
      setResult({ kind: 'link', url: code });
      return;
    } catch { /* not a URL */ }

    setResult({ kind: 'busy' });
    try {
      // 006: a PF code opens the product card; a container / booking number opens the container.
      const hits = await api<{ items: { id: string; pf_code: string | null }[]; containers: Pick<Container, 'id' | 'container_no' | 'booking_no'>[] }>(
        `/api/mobile/search?q=${encodeURIComponent(code)}`);
      const item = hits.items.find(i => norm(i.pf_code) === norm(code));
      if (item) { router.replace({ pathname: '/items/[id]', params: { id: item.id } }); return; }
      const box = hits.containers.find(c => norm(c.container_no) === norm(code) || norm(c.booking_no) === norm(code));
      if (box) { router.replace({ pathname: '/containers/[id]', params: { id: box.id } }); return; }
    } catch { /* search failed — show the code as unrecognized */ }
    setResult({ kind: 'unknown', code });
  }

  function again() { setResult(null); handled.current = false; }

  if (!perm) return <View style={{ flex: 1, backgroundColor: '#0B0E12' }} />;
  if (!perm.granted) {
    return (
      <SafeAreaView style={[s.fill, { padding: 24, justifyContent: 'center' }]}>
        <Ico name="camera" tone="o" size={72} radius={24} style={{ alignSelf: 'center' }} />
        <T w={700} size={21} color={C.white} style={{ textAlign: 'center', marginTop: 14 }}>Kamera izni gerekiyor</T>
        <Muted size={14} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginTop: 6, marginBottom: 22 }}>
          QR ve barkod okumak için kameraya erişim ver.
        </Muted>
        <Btn label={perm.canAskAgain ? 'İzin ver' : 'Ayarları aç'} style={{ flex: 0 }}
          onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())} />
        <Btn kind="ghost" label="Kapat" style={{ flex: 0, marginTop: 10 }} onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <View style={s.fill}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'datamatrix'] }}
        onBarcodeScanned={result ? undefined : onScan} />
      <SafeAreaView style={{ flex: 1 }} pointerEvents="box-none">
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 }}>
          <Pressable style={s.round} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Kapat"><Icon name="x" color={C.white} /></Pressable>
          <T w={700} size={17} color={C.white}>Kod okut</T>
          <Pressable style={[s.round, torch && { backgroundColor: C.A300 }]} onPress={() => setTorch(t => !t)}
            accessibilityRole="switch" accessibilityState={{ checked: torch }} accessibilityLabel="Fener"><Icon name="zap" color={C.white} /></Pressable>
        </Row>
        <View style={s.frameWrap} pointerEvents="none">
          <View style={s.frame}>
            <View style={[s.corner, { left: 0, top: 0, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 18 }]} />
            <View style={[s.corner, { right: 0, top: 0, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 18 }]} />
            <View style={[s.corner, { left: 0, bottom: 0, borderLeftWidth: 5, borderBottomWidth: 5, borderBottomLeftRadius: 18 }]} />
            <View style={[s.corner, { right: 0, bottom: 0, borderRightWidth: 5, borderBottomWidth: 5, borderBottomRightRadius: 18 }]} />
          </View>
          <T w={600} color={C.white} style={{ marginTop: 22, textAlign: 'center' }}>Ürün (PF kodu), konteyner veya platform QR&apos;ı okut</T>
        </View>
      </SafeAreaView>

      {result && result.kind !== 'busy' ? (
        <View style={s.sheet}>
          <View style={s.grab} />
          <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 14 }}>
            <Ico name={result.kind === 'link' ? 'globe' : 'help'} tone="a" size={72} radius={24} />
            <T w={700} size={21} color={UI.ink} style={{ marginTop: 14, textAlign: 'center' }}>
              {result.kind === 'link' ? 'Dış bağlantı' : 'Bu kod tanınmadı'}
            </T>
            <Muted size={14} style={{ marginTop: 6, textAlign: 'center' }} numberOfLines={3}>
              Okutulan: <T w={700} size={14} color={UI.ink}>{result.kind === 'link' ? result.url : result.code}</T>
            </Muted>
          </View>
          <View style={{ gap: 10 }}>
            {result.kind === 'link' ? <Btn kind="d" label="Bağlantıyı aç" style={{ flex: 0 }} onPress={() => Linking.openURL(result.url)} /> : null}
            <Btn kind="s" label="Tekrar okut" icon="refresh" style={{ flex: 0 }} onPress={again} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0B0E12' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  frame: { width: 260, height: 260 },
  corner: { position: 'absolute', width: 46, height: 46, borderColor: C.A300 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: UI.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: 18, paddingBottom: 40 },
  grab: { width: 40, height: 5, borderRadius: 5, backgroundColor: C.P200, alignSelf: 'center', marginBottom: 14 },
});
