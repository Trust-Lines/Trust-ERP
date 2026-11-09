// .tab — Bugün · Görevler · [QR] · Mesai · Menü (the mockup's bottom bar, raised orange scan key).
import { router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '@/ui/Icon';
import { T } from '@/ui/kit';
import { C, UI } from '@/ui/theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Bugün', icon: 'home' },
  tasks: { label: 'Görevler', icon: 'list' },
  shift: { label: 'Mesai', icon: 'clock' },
  menu: { label: 'Menü', icon: 'grid' },
};

function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const items = state.routes.map((route, i) => {
    const meta = TABS[route.name];
    if (!meta) return null;
    const on = state.index === i;
    const color = on ? UI.navActive : UI.secondary;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={meta.label}
        onPress={() => { if (!on) navigateToTab(route.key); }}
        style={s.item}
      >
        <Icon name={meta.icon} color={color} />
        <T w={600} size={11} color={color}>{meta.label}</T>
      </Pressable>
    );
  });
  // The scan key sits between Görevler and Mesai.
  items.splice(2, 0, (
    <Pressable key="scan" accessibilityRole="button" accessibilityLabel="QR tara" onPress={() => router.push('/scan')} style={s.scanWrap}>
      <View style={s.scan}><Icon name="qr" size={26} color={C.white} /></View>
    </Pressable>
  ));
  return <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>{items}</View>;
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="shift" />
      <Tabs.Screen name="menu" />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: UI.border, paddingTop: 10, paddingHorizontal: 10 },
  item: { alignItems: 'center', gap: 4, width: 64, minHeight: 44 },
  scanWrap: { marginTop: -30, width: 64, alignItems: 'center' },
  scan: {
    width: 62, height: 62, borderRadius: 22, backgroundColor: UI.cta, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: UI.surface,
    shadowColor: C.A400, shadowOpacity: 0.5, shadowRadius: 11, shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
});
