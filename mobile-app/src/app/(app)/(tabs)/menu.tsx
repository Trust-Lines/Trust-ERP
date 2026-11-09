// 015 · Menü / 030 · Profil — who I am + the modules my role can open (pages from /api/mobile/me).
import { Alert as RNAlert, Linking, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/api';
import { initials } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import { Btn, Card, ErrorView, Header, Ico, Lbl, Li, List, Muted, Row, Screen, T } from '@/ui/kit';
import type { IconName } from '@/ui/Icon';
import { C, UI, type Tone } from '@/ui/theme';

const MODULES: { label: string; icon: IconName; tone: Tone; page: string; href: Href }[] = [
  { label: 'Kalite Kontrol', icon: 'clip', tone: 'g', page: 'page.qc', href: '/qc' },
  { label: 'Konteynerler', icon: 'box', tone: 'i', page: 'page.logistics', href: '/containers' },
  { label: 'Onaylar', icon: 'pen', tone: 'a', page: 'page.approvals', href: '/approvals' },
];

export default function Menu() {
  const { me, meError, can, signOut, reloadMe } = useAuth();
  const modules = MODULES.filter(m => can(m.page));

  return (
    <Screen>
      <Header title="Menü" />
      {meError && !me ? <ErrorView message={meError} onRetry={reloadMe} /> : null}
      {me ? (
        <Card>
          <Row>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.S600, alignItems: 'center', justifyContent: 'center' }}>
              <T w={700} size={18} color={C.white}>{initials(me.fullName)}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T w={600} size={17} color={UI.heading}>{me.fullName}</T>
              <Muted>{roleLabel(me.role)}</Muted>
              <Muted numberOfLines={1}>{me.email}</Muted>
            </View>
          </Row>
        </Card>
      ) : null}

      {modules.length ? (
        <List>
          {modules.map(m => (
            <Li key={m.page} left={<Ico name={m.icon} tone={m.tone} />} title={m.label} chevron onPress={() => router.push(m.href)} />
          ))}
        </List>
      ) : null}

      <Lbl>Hesap</Lbl>
      <List>
        <Li left={<Ico name="globe" />} title="Web platformunu aç" sub="Mobilde olmayan sayfalar için" chevron
          onPress={() => Linking.openURL(API_URL)} />
        <Li left={<Ico name="help" />} title="Şifremi değiştir" sub="Sıfırlama bağlantısı e-postana gelir" chevron
          onPress={() => Linking.openURL(`${API_URL}/auth/forgot-password`)} />
      </List>

      <Btn kind="s" icon="logout" label="Çıkış yap" style={{ flex: 0, marginTop: 4 }}
        onPress={() => RNAlert.alert('Çıkış yap', 'Bu cihazdaki oturumun kapanacak.', [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Çıkış yap', style: 'destructive', onPress: () => void signOut() },
        ])} />
      <Muted style={{ textAlign: 'center', marginTop: 16 }}>T-ERP · v{Constants.expoConfig?.version ?? '1.0'}</Muted>
    </Screen>
  );
}
