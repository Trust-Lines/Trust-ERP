// 046 · Şifre sıfırlama — POST /api/auth/forgot-password (public, rate-limited). The emailed link
// opens the web's /auth/set-password page; afterwards the person signs in here as usual.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { API_URL } from '@/lib/api';
import { Alert, Back, Big, Btn, Field, Note, Screen } from '@/ui/kit';

const RESEND_SECONDS = 60;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      if (res.status === 429) throw new Error('Çok fazla deneme. Biraz sonra tekrar dene.');
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Gönderilemedi.');
      setSent(true); setWait(RESEND_SECONDS);
    } catch (e) {
      setError(e instanceof Error && e.message !== 'Network request failed' ? e.message : 'Sunucuya ulaşılamadı.');
    } finally {
      setBusy(false);
    }
  }

  const mmss = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`;
  return (
    <Screen sticky={
      <View style={{ gap: 10 }}>
        <Btn kind={sent ? 's' : 'p'} label={sent ? (wait > 0 ? `Tekrar gönder · ${mmss}` : 'Tekrar gönder') : 'Bağlantı gönder'}
          onPress={send} loading={busy} disabled={!email.trim() || wait > 0} style={{ flex: 0 }} />
        <Btn kind="d" label="Girişe dön" onPress={() => router.back()} style={{ flex: 0 }} />
      </View>
    }>
      <Back label="Giriş" />
      <Big title="Şifreni sıfırla" sub="Kurumsal e-posta adresini gir, sıfırlama bağlantısı gönderelim." />
      <Field label="E-posta" icon="user" value={email} onChangeText={setEmail} placeholder="ad.soyad@trust-lines.com"
        autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      {sent ? <Alert tone="g" icon="check" title="Bağlantı gönderildi" sub="Gelen kutunu kontrol et. Bağlantı web'de yeni şifre belirleme sayfasını açar." /> : null}
      {error ? <Alert tone="r" title="Gönderilemedi" sub={error} /> : null}
      <Note>Hesabın yoksa yöneticin web&apos;den davet gönderir.</Note>
    </Screen>
  );
}
