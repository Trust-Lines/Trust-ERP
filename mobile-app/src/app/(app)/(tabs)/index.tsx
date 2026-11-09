// 002 / 050–053 · Ana sayfa — greeting, shift card, role-based quick actions, today's to-dos
// (GET /api/my-day: the same role sections as the web "My Day").
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { openHref } from '@/lib/nav';
import { dayLong, greeting, initials } from '@/lib/format';
import { ShiftCard, useShift } from '@/features/shift';
import { SECTION_UI, toneOf, type MyDay } from '@/features/myDay';
import { MODULE_GROUPS, QUICK_ORDER, SHORT } from '@/features/modules';
import { Chip, ErrorView, Ico, IconButton, Lbl, Li, List, Loading, Muted, Row, Screen, T } from '@/ui/kit';
import { C, UI } from '@/ui/theme';

export default function Home() {
  const { me } = useAuth();
  const shift = useShift(1);
  const day = useApi<MyDay>('/api/my-day');
  const mods = me ? MODULE_GROUPS.flatMap(g => g.items).filter(m => m.show(me)) : [];
  const quick = [{ label: 'QR Tara', icon: 'qr' as const, tone: 'o' as const, href: '/scan' as const }, ...mods]
    .filter(m => QUICK_ORDER.includes(m.label)).sort((a, b) => QUICK_ORDER.indexOf(a.label) - QUICK_ORDER.indexOf(b.label)).slice(0, 8);
  const items = (day.data?.sections ?? []).flatMap(sec => sec.items.map(it => ({ sec, it }))).slice(0, 5);
  const unread = day.data?.sections.find(s => s.key === 'notifications')?.items.length ?? 0;
  const firstName = me?.fullName.split(' ')[0] ?? '';

  return (
    <Screen onRefresh={() => { void day.reload(); void shift.reload(); }} refreshing={day.refreshing}>
      <Row style={{ paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.S600, alignItems: 'center', justifyContent: 'center' }}>
          <T w={700} color={C.white}>{initials(me?.fullName)}</T>
        </View>
        <View style={{ flex: 1 }}>
          <Muted>{dayLong(new Date())}</Muted>
          <T w={700} size={20} color={UI.heading}>{greeting()}{firstName ? `, ${firstName}` : ''}</T>
        </View>
        <IconButton name="search" label="Ara" onPress={() => router.push('/search')} />
        <IconButton name="bell" label={unread ? `${unread} okunmamış bildirim` : 'Bildirimler'} dot={unread > 0}
          onPress={() => router.push('/notifications')} />
      </Row>

      {shift.error ? <Muted style={{ marginBottom: 12 }}>Mesai: {shift.error}</Muted> : <ShiftCard shift={shift} />}

      <Lbl>Hızlı işlemler</Lbl>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 10, marginBottom: 14 }}>
        {quick.map(q => (
          <Pressable key={q.label} onPress={() => router.push(q.href)} accessibilityRole="button" accessibilityLabel={q.label}
            style={({ pressed }) => [{ width: '22.5%', flexGrow: 1, alignItems: 'center' }, pressed && { opacity: 0.7 }]}>
            <Ico name={q.icon} tone={q.tone} size={62} radius={18} style={{ width: '100%' }} />
            <T w={600} size={13} color={UI.heading} style={{ marginTop: 6 }} numberOfLines={1}>{SHORT[q.label] ?? q.label}</T>
          </Pressable>
        ))}
      </View>

      <Lbl right={items.length ? (
        <Pressable onPress={() => router.push('/tasks')} accessibilityRole="link" hitSlop={8}>
          <T w={600} size={13} color={UI.navActive}>Tümü</T>
        </Pressable>
      ) : null}>Bugün yapılacaklar</Lbl>
      {day.loading ? <Loading /> : day.error ? <ErrorView message={day.error} onRetry={day.reload} /> : items.length === 0 ? (
        <List><Li left={<Ico name="check" tone="g" />} title="Bekleyen işin yok" sub="Yeni bir iş geldiğinde burada görünür." /></List>
      ) : (
        <List>
          {items.map(({ sec, it }, i) => {
            const ui = SECTION_UI[sec.key] ?? SECTION_UI.default!;
            return (
              <Li key={`${sec.key}-${i}`} left={<Ico name={ui.icon} tone={ui.tone} />} title={it.label} sub={it.sublabel}
                right={it.badge ? <Chip label={it.badge} tone={toneOf(it.tone)} /> : undefined}
                chevron={!it.badge} onPress={() => openHref(it.href)} />
            );
          })}
        </List>
      )}
    </Screen>
  );
}
