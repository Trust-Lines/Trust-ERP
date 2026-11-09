// 015 · Menü / 030 · Profil — who I am, every module my role can open (grouped), account settings.
import { useEffect, useState } from 'react';
import { Alert as RNAlert, Linking, Switch, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/api';
import { initials } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import { biometricsAvailable, LOCK_KEY } from '@/lib/lock';
import { MODULE_GROUPS } from '@/features/modules';
import { Btn, Card, ErrorView, Header, Ico, Lbl, Li, List, Loading, Muted, Row, Screen, T } from '@/ui/kit';
import { C, UI } from '@/ui/theme';

export default function Menu() {
  const { me, meError, signOut, reloadMe } = useAuth();
  const [lock, setLock] = useState(false);
  const [bio, setBio] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(LOCK_KEY).then(v => setLock(v === '1')).catch(() => {});
    biometricsAvailable().then(setBio).catch(() => setBio(false));
  }, []);
  const toggleLock = (v: boolean) => { setLock(v); void AsyncStorage.setItem(LOCK_KEY, v ? '1' : '0').catch(() => {}); };

  return (
    <Screen>
      <Header title="Menü" icon="search" iconLabel="Ara" onIcon={() => router.push('/search')} />
      {meError && !me ? <ErrorView message={meError} onRetry={reloadMe} /> : null}
      {!me && !meError ? <Loading /> : null}
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

      {me ? MODULE_GROUPS.map(g => {
        const items = g.items.filter(m => m.show(me));
        if (!items.length) return null;
        return (
          <View key={g.title}>
            <Lbl>{g.title}</Lbl>
            <List>
              {items.map(m => <Li key={m.label} left={<Ico name={m.icon} tone={m.tone} />} title={m.label} chevron onPress={() => router.push(m.href)} />)}
            </List>
          </View>
        );
      }) : null}

      <Lbl>Hesap</Lbl>
      <List>
        {bio ? (
          <Li left={<Ico name="face" />} title="Face ID ile kilitle" sub="1 dakikadan uzun ayrılınca sorar"
            right={<Switch value={lock} onValueChange={toggleLock} trackColor={{ true: C.success, false: C.P100 }} accessibilityLabel="Face ID kilidi" />} />
        ) : null}
        <Li left={<Ico name="globe" />} title="Web platformunu aç" sub="Mobilde olmayan sayfalar için" chevron onPress={() => Linking.openURL(API_URL)} />
        <Li left={<Ico name="lock" />} title="Şifremi değiştir" sub="Sıfırlama bağlantısı e-postana gelir" chevron onPress={() => Linking.openURL(`${API_URL}/auth/forgot-password`)} />
        <Li left={<Ico name="help" />} title="Yardım & geri bildirim" sub="Sorun bildir, öneri gönder" chevron
          onPress={() => Linking.openURL(`mailto:hamzag@trust-lines.com?subject=${encodeURIComponent('T-ERP mobil geri bildirim')}`)} />
      </List>

      <Btn kind="s" icon="logout" label="Çıkış yap" style={{ flex: 0, marginTop: 4 }}
        onPress={() => RNAlert.alert('Çıkış yap', 'Bu cihazdaki oturumun kapanacak.', [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Çıkış yap', style: 'destructive', onPress: () => void signOut() },
        ])} />
      <Muted style={{ textAlign: 'center', marginTop: 16 }}>T-ERP · T Holding · v{Constants.expoConfig?.version ?? '1.0'}</Muted>
    </Screen>
  );
}
