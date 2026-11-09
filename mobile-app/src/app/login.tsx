// 001 · Giriş — platform account (same Supabase users as the web). Brand: T Holding · T-ERP.
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useAuth } from '@/lib/auth';
import { CONFIGURED } from '@/lib/supabase';
import { Btn, Field, T } from '@/ui/kit';
import { C } from '@/ui/theme';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) { setError('E-posta ve şifreni gir.'); return; }
    setBusy(true); setError(null);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.P800 }}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="g" x1="0.4" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor="#1F252D" />
            <Stop offset="0.62" stopColor="#2B3D55" />
            <Stop offset="1" stopColor="#3C5577" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#g)" />
      </Svg>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.body}>
          <View style={s.brand}>
            <Image source={require('../../assets/brand/logo.png')} style={s.logo} resizeMode="contain"
              accessibilityLabel="T Holding" />
            <View style={s.divider} />
            <View>
              <T w={700} size={22} color={C.white}>T-ERP</T>
              <T size={14} color="rgba(255,255,255,0.6)">Operasyon Mobil</T>
            </View>
          </View>

          <T w={700} size={34} color={C.white} style={s.hero} accessibilityRole="header">Sahadaki işin,{'\n'}cebinde.</T>
          <T size={15} color="rgba(255,255,255,0.65)" style={{ marginTop: 12, lineHeight: 22 }}>
            Platform hesabınla giriş yap. Yetkilerin web ile aynıdır.
          </T>

          <View style={{ marginTop: 34 }}>
            <Field dark icon="user" placeholder="E-posta" value={email} onChangeText={setEmail}
              autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" />
            <Field dark icon="lock" placeholder="Şifre" value={password} onChangeText={setPassword}
              secureTextEntry autoComplete="password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
            {error ? <T w={600} size={13} color={C.A200} style={{ marginBottom: 6 }} accessibilityLiveRegion="polite">{error}</T> : null}
            {!CONFIGURED ? (
              <T size={13} color={C.A200} style={{ marginBottom: 6 }}>
                Uygulama yapılandırılmamış: .env.local içinde EXPO_PUBLIC_SUPABASE_URL / ANON_KEY / API_URL eksik.
              </T>
            ) : null}
            <Btn label="Giriş yap" onPress={submit} loading={busy} disabled={!CONFIGURED} style={{ marginTop: 8, flex: 0 }} />
          </View>

          <View style={{ flex: 1 }} />
          <View style={s.footer}>
            <T size={13} color="rgba(255,255,255,0.5)">v{Constants.expoConfig?.version ?? '1.0'}  •  </T>
            <Link href="/forgot-password" asChild>
              <Pressable accessibilityRole="link" hitSlop={8}><T w={600} size={13} color="rgba(255,255,255,0.75)">Şifremi unuttum</T></Pressable>
            </Link>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 28 },
  brand: { marginTop: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 104, height: 45, tintColor: C.white },
  divider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)' },
  hero: { marginTop: 56, lineHeight: 38, letterSpacing: -0.68 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
});
