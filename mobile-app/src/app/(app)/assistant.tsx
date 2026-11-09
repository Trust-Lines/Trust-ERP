// 056 · AI asistan — POST /api/ai/assistant (same assistant and role limits as the web).
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { Back, Card, Chip, Ico, Muted, Row, T } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { C, F, UI } from '@/ui/theme';

type Msg = { role: 'user' | 'assistant'; content: string };
const SUGGEST = ['Bugün QC\'de ne var?', 'Geciken konteynerler', 'Bu hafta teslim edilecek projeler'];

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  async function send(content: string) {
    const body = content.trim();
    if (!body || busy) return;
    const next = [...msgs, { role: 'user' as const, content: body }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const { reply } = await api<{ reply: string }>('/api/ai/assistant', { method: 'POST', body: { messages: next, lang: 'tr' } });
      setMsgs(m => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Yanıt alınamadı'}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: UI.surface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Row style={{ paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: UI.border }}>
          <Back label="" />
          <Ico name="spark" tone="o" size={38} radius={12} />
          <View style={{ flex: 1 }}>
            <T w={600} color={UI.heading}>T-ERP Asistan</T>
            <Muted size={12}>Yalnızca yetkin olan veriyi görür</Muted>
          </View>
        </Row>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: 18, gap: 10 }}>
          {msgs.length === 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SUGGEST.map(s => <Pressable key={s} onPress={() => send(s)}><Chip label={s} /></Pressable>)}
            </View>
          ) : msgs.map((m, i) => m.role === 'user' ? (
            <View key={i} style={{ alignSelf: 'flex-end', backgroundColor: UI.ink, borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 13, maxWidth: '80%' }}>
              <T size={14} color={C.white}>{m.content}</T>
            </View>
          ) : (
            <Card key={i} style={{ borderBottomLeftRadius: 6, maxWidth: '90%', marginBottom: 0 }}>
              <T size={14} color={UI.heading} selectable>{m.content}</T>
            </Card>
          ))}
          {busy ? <Muted>Düşünüyor…</Muted> : null}
        </ScrollView>
        <Row style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 10, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: UI.border }}>
          <TextInput value={text} onChangeText={setText} placeholder="Bir şey sor…" placeholderTextColor={UI.disabled} onSubmitEditing={() => send(text)}
            returnKeyType="send" accessibilityLabel="Mesaj"
            style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: UI.surface, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 14, color: UI.heading }} />
          <Pressable onPress={() => send(text)} accessibilityRole="button" accessibilityLabel="Gönder" disabled={busy}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: UI.cta, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
            <Icon name="send" size={16} color={C.white} />
          </Pressable>
        </Row>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
