// 047 · Hızlı giriş — optional Face ID / Touch ID lock when the app comes back to the foreground.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Btn, T } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { C } from '@/ui/theme';

export const LOCK_KEY = 'tl.biometricLock';
const AWAY_MS = 60_000; // locking after a minute away, not on every glance at another app

export async function biometricsAvailable() {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export function AppLock({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  const away = useRef<number | null>(null);

  async function unlock() {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'T-ERP kilidini aç', cancelLabel: 'Vazgeç' });
    if (r.success) setLocked(false);
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      if (state === 'background') away.current = Date.now();
      if (state === 'active' && away.current && Date.now() - away.current > AWAY_MS) {
        away.current = null;
        if ((await AsyncStorage.getItem(LOCK_KEY).catch(() => null)) === '1') { setLocked(true); void unlock(); }
      }
    });
    return () => sub.remove();
  }, []);

  if (!locked) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: C.P800, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }}>
      <Icon name="face" size={56} color={C.white} />
      <T w={700} size={22} color={C.white}>T-ERP kilitli</T>
      <Btn label="Face ID ile aç" icon="face" onPress={unlock} style={{ flex: 0, alignSelf: 'stretch' }} />
    </View>
  );
}
