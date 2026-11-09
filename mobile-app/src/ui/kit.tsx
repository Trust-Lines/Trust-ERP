// The mockup's building blocks (mobile-mockups.html helpers: hdr, back, ttl, lbl, card, li, list,
// chip, ico, btn, seg, inp, fl, note, alertc, prog, stat, big) as React Native components.
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, ICO_TONE, TONE, UI, shadowCard, type Tone } from './theme';
import { Icon, type IconName } from './Icon';

const W = { 400: F.regular, 500: F.medium, 600: F.semibold, 700: F.bold } as const;

export function T({ w = 400, size = 15, color = UI.body, style, ...p }: TextProps & {
  w?: keyof typeof W; size?: number; color?: string; style?: StyleProp<TextStyle>;
}) {
  return <Text {...p} style={[{ fontFamily: W[w], fontSize: size, color }, style]} />;
}
export const Muted = ({ children, size = 13, style, ...p }: TextProps & { size?: number }) =>
  <T size={size} color={UI.secondary} style={style} {...p}>{children}</T>;

/** .scr + .body (+ .sticky footer). Pull-to-refresh when `onRefresh` is given. */
export function Screen({ children, sticky, onRefresh, refreshing = false, scroll = true, dark, style }: {
  children: ReactNode; sticky?: ReactNode; onRefresh?: () => void; refreshing?: boolean;
  scroll?: boolean; dark?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const bg = dark ? UI.ink : UI.surface;
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[s.body, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >{children}</ScrollView>
  ) : <View style={[s.body, { flex: 1 }, style]}>{children}</View>;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: bg }}>
      {body}
      {sticky ? <View style={[s.sticky, { paddingBottom: Math.max(insets.bottom, 12) + 8, backgroundColor: bg }]}>{sticky}</View> : null}
    </SafeAreaView>
  );
}

/** .hdr — 24/700 title with an optional round icon button. */
export function Header({ title, icon, onIcon, iconLabel, dot }: {
  title: string; icon?: IconName; onIcon?: () => void; iconLabel?: string; dot?: boolean;
}) {
  return (
    <View style={s.hdr}>
      <T w={700} size={24} color={UI.heading} style={{ flex: 1, letterSpacing: -0.36 }} accessibilityRole="header">{title}</T>
      {icon ? <IconButton name={icon} onPress={onIcon} label={iconLabel ?? title} dot={dot} /> : null}
    </View>
  );
}

export function IconButton({ name, onPress, label, dot }: { name: IconName; onPress?: () => void; label: string; dot?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s.ib} hitSlop={6}>
      <Icon name={name} color={UI.heading} />
      {dot ? <View style={s.dot} /> : null}
    </Pressable>
  );
}

/** .back — "‹ Önceki ekran" link. */
export function Back({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress ?? (() => router.back())} accessibilityRole="button" accessibilityLabel={`Geri: ${label}`} style={s.back} hitSlop={8}>
      <Icon name="chevl" color={UI.link} />
      <T w={600} color={UI.link}>{label}</T>
    </Pressable>
  );
}

/** ttl — 21/700 page title + muted subtitle + optional right slot. */
export function Title({ title, sub, right }: { title: string; sub?: string | null; right?: ReactNode }) {
  return (
    <View style={[s.row, { marginTop: 8, marginBottom: 12 }]}>
      <View style={{ flex: 1 }}>
        <T w={700} size={21} color={UI.heading} accessibilityRole="header">{title}</T>
        {sub ? <Muted>{sub}</Muted> : null}
      </View>
      {right}
    </View>
  );
}

/** big — 26/700 hero title for flows (password reset, workplace…). */
export function Big({ title, sub, color = UI.heading }: { title: string; sub?: string; color?: string }) {
  return (
    <View>
      <T w={700} size={26} color={color} style={{ marginTop: 18, letterSpacing: -0.4 }} accessibilityRole="header">{title}</T>
      {sub ? <Muted size={15} style={{ lineHeight: 22, marginTop: 6, marginBottom: 18 }}>{sub}</Muted> : null}
    </View>
  );
}

/** .lbl — small uppercase section label. */
export function Lbl({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={[s.row, { marginTop: 6, marginBottom: 9, marginHorizontal: 2 }]}>
      <T w={600} size={12} color={UI.secondary} style={{ flex: 1, letterSpacing: 0.72, textTransform: 'uppercase' }}>{children}</T>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
        style={({ pressed }) => [s.card, style, pressed && { opacity: 0.85 }]}>{children}</Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

/** list — a card of .li rows with hairline dividers between them. */
export function List({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <Card style={[{ paddingVertical: 4 }, style]}>
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {i > 0 ? <View style={s.divider} /> : null}
          {row}
        </Fragment>
      ))}
    </Card>
  );
}

/** .li — leading icon/thumb, 15/600 title, muted subtitle, trailing slot (chip, chevron…). */
export function Li({ left, title, sub, right, onPress, chevron, label }: {
  left?: ReactNode; title: string; sub?: ReactNode; right?: ReactNode; onPress?: () => void; chevron?: boolean; label?: string;
}) {
  const content = (
    <>
      {left}
      <View style={{ flex: 1 }}>
        <T w={600} color={UI.heading} numberOfLines={2}>{title}</T>
        {typeof sub === 'string' ? <Muted numberOfLines={2}>{sub}</Muted> : sub}
      </View>
      {right}
      {chevron ? <Icon name="chev" color={UI.secondary} /> : null}
    </>
  );
  if (!onPress) return <View style={s.li}>{content}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label ?? title}
      style={({ pressed }) => [s.li, pressed && { opacity: 0.6 }]}>{content}</Pressable>
  );
}

export function Chip({ label, tone = 'i', icon, style }: { label: string; tone?: Tone; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const t = TONE[tone];
  return (
    <View style={[s.chip, { backgroundColor: t.bg }, style]}>
      {icon ? <Icon name={icon} size={14} color={t.fg} /> : null}
      <T w={600} size={12} color={t.fg} numberOfLines={1}>{label}</T>
    </View>
  );
}

/** .ico — rounded tinted icon tile. */
export function Ico({ name, tone = 'i', size = 42, iconSize, radius = 14, style }: {
  name: IconName; tone?: Tone; size?: number; iconSize?: number; radius?: number; style?: StyleProp<ViewStyle>;
}) {
  const t = ICO_TONE[tone];
  return (
    <View style={[{ width: size, height: size, borderRadius: radius, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name={name} color={t.fg} size={iconSize ?? (size >= 60 ? 26 : 20)} />
    </View>
  );
}

const BTN = {
  p: { bg: UI.cta, fg: C.white },          // Accent / CTA
  d: { bg: UI.btnPrimary, fg: C.white },   // Primary (dark)
  s: { bg: UI.card, fg: UI.heading },      // Secondary (outlined)
  g: { bg: C.success, fg: C.white },
  r: { bg: C.error, fg: C.white },
  ghost: { bg: 'rgba(255,255,255,0.12)', fg: C.white }, // on dark cards
} as const;

export function Btn({ label, kind = 'p', icon, onPress, disabled, loading, style, small }: {
  label: string; kind?: keyof typeof BTN; icon?: IconName; onPress?: () => void;
  disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const b = BTN[kind];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress} disabled={off} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        s.btn, small && s.btnSmall, { backgroundColor: b.bg },
        kind === 's' && { borderWidth: 1.5, borderColor: UI.inputBorder },
        (pressed || off) && { opacity: off ? 0.55 : 0.85 }, style,
      ]}
    >
      {loading ? <ActivityIndicator color={b.fg} /> : (
        <>
          {icon ? <Icon name={icon} color={b.fg} size={small ? 16 : 20} /> : null}
          <T w={700} size={small ? 14 : 16} color={b.fg}>{label}</T>
        </>
      )}
    </Pressable>
  );
}

/** .seg — segmented control; `count` renders the small pill (orange when active). */
export function Seg<K extends string>({ items, value, onChange }: {
  items: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void;
}) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {items.map(it => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[s.segItem, on && s.segOn]}>
            <T w={600} size={13} color={on ? UI.heading : UI.secondary} numberOfLines={1}>{it.label}</T>
            {it.count !== undefined ? (
              <View style={[s.segCount, on && { backgroundColor: UI.cta }]}>
                <T w={600} size={11} color={on ? C.white : UI.body}>{it.count}</T>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** .fl label + .inp field. */
export function Field({ label, icon, dark, style, ...p }: TextInputProps & { label?: string; icon?: IconName; dark?: boolean }) {
  return (
    <View>
      {label ? <T w={600} size={13} color={UI.secondary} style={{ marginHorizontal: 2, marginBottom: 6 }}>{label}</T> : null}
      <View style={[s.inp, dark && s.inpDark, p.multiline && { height: 88, alignItems: 'flex-start', paddingTop: 12 }]}>
        {icon ? <Icon name={icon} color={dark ? C.white : UI.heading} /> : null}
        <TextInput
          placeholderTextColor={dark ? 'rgba(255,255,255,0.45)' : UI.disabled}
          accessibilityLabel={label ?? p.placeholder}
          {...p}
          style={[{ flex: 1, fontFamily: F.regular, fontSize: 15, color: dark ? C.white : UI.heading, height: '100%' }, style]}
        />
      </View>
    </View>
  );
}

/** note — small info line. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <View style={[s.row, { gap: 8, paddingHorizontal: 2, marginBottom: 10 }]}>
      <Icon name="info" size={16} color={UI.secondary} />
      <Muted size={12.5} style={{ flex: 1 }}>{children}</Muted>
    </View>
  );
}

/** alertc — tinted card with a white icon tile. */
export function Alert({ title, sub, tone = 'a', icon = 'alert' }: { title: string; sub?: string | null; tone?: Tone; icon?: IconName }) {
  return (
    <Card style={{ backgroundColor: ICO_TONE[tone].bg }}>
      <View style={[s.row, { gap: 12 }]}>
        <Ico name={icon} tone={tone} style={{ backgroundColor: C.white }} />
        <View style={{ flex: 1 }}>
          <T w={600} color={UI.heading}>{title}</T>
          {sub ? <Muted>{sub}</Muted> : null}
        </View>
      </View>
    </Card>
  );
}

export function Prog({ pct, color = C.S500, style }: { pct: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.prog, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
      <View style={{ width: `${Math.max(2, Math.min(100, pct))}%`, height: '100%', backgroundColor: color, borderRadius: 9 }} />
    </View>
  );
}

export function Stat({ value, label, color = UI.ink }: { value: string | number; label: string; color?: string }) {
  return (
    <Card style={{ flex: 1, marginBottom: 0, padding: 12 }}>
      <T w={700} size={22} color={color}>{value}</T>
      <Muted size={12}>{label}</Muted>
    </Card>
  );
}

export const Row = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) =>
  <View style={[s.row, style]}>{children}</View>;

// ── loading / empty / error (AGENTS.md §8) ───────────────────────────────────────────────────
export function Loading() {
  return <View style={{ paddingVertical: 60, alignItems: 'center' }}><ActivityIndicator color={UI.secondary} /></View>;
}

/** The mockup's empty state (054): big round tinted icon, title, muted text, optional action. */
export function Empty({ icon = 'check', tone = 'g', title, sub, action }: {
  icon?: IconName; tone?: Tone; title: string; sub?: string; action?: ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 50, paddingBottom: 20 }}>
      <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: ICO_TONE[tone].bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={34} color={tone === 'g' ? C.success : ICO_TONE[tone].fg} />
      </View>
      <T w={700} size={22} color={UI.heading} style={{ marginTop: 22, textAlign: 'center' }}>{title}</T>
      {sub ? <Muted size={15} style={{ lineHeight: 22, marginTop: 8, marginHorizontal: 30, marginBottom: 22, textAlign: 'center' }}>{sub}</Muted> : null}
      {action}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ paddingTop: 20 }}>
      <Alert title="Yüklenemedi" sub={message} tone="r" icon="alert" />
      {onRetry ? <Btn label="Tekrar dene" kind="s" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 28 },
  sticky: { paddingTop: 12, paddingHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 14, paddingHorizontal: 2 },
  ib: { width: 40, height: 40, borderRadius: 14, backgroundColor: UI.card, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: UI.border },
  dot: { position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: UI.cta },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4, paddingBottom: 2, alignSelf: 'flex-start' },
  card: { backgroundColor: UI.card, borderRadius: 20, padding: 16, marginBottom: 12, ...shadowCard },
  divider: { height: 1, backgroundColor: UI.border },
  li: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 48 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, alignSelf: 'flex-start' },
  btn: { height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, flex: 1, minWidth: 0 },
  btnSmall: { height: 44, flex: 0, paddingHorizontal: 16, borderRadius: 14 },
  seg: { flexDirection: 'row', backgroundColor: UI.hover, borderRadius: 14, padding: 4, gap: 4, marginBottom: 14 },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10 },
  segOn: { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segCount: { backgroundColor: UI.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  inp: { height: 50, borderRadius: 14, backgroundColor: C.white, borderWidth: 1.5, borderColor: UI.inputBorder, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, marginBottom: 10 },
  inpDark: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.14)' },
  prog: { height: 8, borderRadius: 9, backgroundColor: UI.border, overflow: 'hidden' },
});

/** .kv — two-column label / value grid. */
export function KV({ pairs }: { pairs: [string, string | null | undefined][] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 14 }}>
      {pairs.map(([k, v]) => (
        <View key={k} style={{ width: '46%', flexGrow: 1 }}>
          <T w={600} size={12} color={UI.secondary}>{k}</T>
          <T w={700} size={14} color={UI.heading}>{v || '—'}</T>
        </View>
      ))}
    </View>
  );
}

/** .tl — vertical timeline; `state`: done (green), cur (orange ring), nx (grey), red. */
export function Timeline({ steps }: { steps: { title: string; sub?: string | null; state: 'done' | 'cur' | 'nx' | 'red' }[] }) {
  return (
    <View style={{ paddingLeft: 26 }}>
      {steps.map((st, i) => {
        const dot = st.state === 'done' ? C.success : st.state === 'red' ? C.error : st.state === 'cur' ? C.white : UI.border;
        const line = st.state === 'done' || st.state === 'red' ? C.success : UI.border;
        return (
          <View key={i} style={{ paddingBottom: 14 }}>
            <View style={{ position: 'absolute', left: -21, top: 4, width: 12, height: 12, borderRadius: 6, backgroundColor: dot,
              ...(st.state === 'cur' ? { borderWidth: 3, borderColor: UI.cta, width: 14, height: 14, left: -22, top: 3, borderRadius: 7 } : null) }} />
            {i < steps.length - 1 ? <View style={{ position: 'absolute', left: -16, top: 18, bottom: -2, width: 2, backgroundColor: line }} /> : null}
            <T w={600} color={st.state === 'nx' ? UI.secondary : UI.heading}>{st.title}</T>
            {st.sub ? <Muted>{st.sub}</Muted> : null}
          </View>
        );
      })}
    </View>
  );
}
