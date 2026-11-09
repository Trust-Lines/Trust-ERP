// 058 · Kişi profili — from the directory list; e-mail opens the mail app.
import { Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { roleLabel } from '@/lib/roles';
import { Avatar, type Person } from '@/features/team';
import { Back, Btn, Card, ErrorView, KV, Loading, Muted, Screen, T } from '@/ui/kit';
import { UI } from '@/ui/theme';

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useApi<{ people: Person[] }>('/api/mobile/team');
  const p = res.data?.people.find(x => x.id === id);
  if (res.loading) return <Screen><Back label="Ekip" /><Loading /></Screen>;
  if (res.error || !p) return <Screen><Back label="Ekip" /><ErrorView message={res.error ?? 'Kişi bulunamadı'} /></Screen>;
  return (
    <Screen>
      <Back label="Ekip" />
      <View style={{ alignItems: 'center', marginVertical: 18 }}>
        <Avatar name={p.full_name} size={84} />
        <T w={700} size={22} color={UI.heading} style={{ marginTop: 12 }}>{p.full_name}</T>
        <Muted>{roleLabel(p.role)}</Muted>
      </View>
      <Card><KV pairs={[['E-posta', p.email], ['Ofis', p.office], ['Departman', p.department], ['Durum', p.is_active ? 'Aktif' : 'Pasif']]} /></Card>
      <Btn kind="d" icon="mail" label="E-posta gönder" style={{ flex: 0 }} onPress={() => Linking.openURL(`mailto:${p.email}`)} />
    </Screen>
  );
}
