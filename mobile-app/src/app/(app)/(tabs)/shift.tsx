// 003 · Mesai girişi / 017 · çıkış / 062 · mola / 004 · puantaj — POST/GET /api/hr/shift.
// The big button needs a long press so a pocket tap can't punch.
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { addDays, hm, spans, startOfDay, within, type PunchKind } from '@/lib/shift';
import { clock, dayLong } from '@/lib/format';
import { SITES, todayTotals, useNow, useShift, useWorkSite } from '@/features/shift';
import { Btn, Card, Choice, ErrorView, Header, Ico, Lbl, Li, List, Loading, Muted, Note, Row, Screen, Seg, T } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { C, UI } from '@/ui/theme';

const KIND_TR: Record<PunchKind, string> = { in: 'Giriş', break_start: 'Mola başladı', break_end: 'Mola bitti', out: 'Çıkış' };
const KIND_ICON = { in: 'finger', break_start: 'coffee', break_end: 'coffee', out: 'logout' } as const;

export default function Shift() {
  const [tab, setTab] = useState<'today' | 'sheet'>('today');
  const shift = useShift(31);
  const now = useNow(15_000);

  return (
    <Screen onRefresh={shift.reload} refreshing={shift.refreshing}>
      <Header title="Mesai" icon="cal" iconLabel="Vardiya planı" onIcon={() => router.push('/hr/shifts')} />
      <Seg value={tab} onChange={setTab} items={[{ key: 'today', label: 'Bugün' }, { key: 'sheet', label: 'Puantaj' }]} />
      {shift.loading ? <Loading /> : shift.error ? <ErrorView message={shift.error} onRetry={shift.reload} /> : !shift.data ? null
        : tab === 'today' ? <Today shift={shift} now={now} /> : <Sheet shift={shift} now={now} />}
    </Screen>
  );
}

function Today({ shift, now }: { shift: ReturnType<typeof useShift>; now: number }) {
  const data = shift.data!;
  const { worked, brk } = todayTotals(data, now);
  const day = startOfDay(new Date(now)).getTime();
  const todays = data.punches.filter(p => Date.parse(p.punched_at) >= day);

  const main: { kind: PunchKind; label: string; bg: string; ring: string; icon: 'finger' | 'logout' | 'coffee' } =
    data.status === 'off' ? { kind: 'in', label: 'Giriş Yap', bg: C.A400, ring: C.A50, icon: 'finger' }
      : data.status === 'on' ? { kind: 'out', label: 'Çıkış Yap', bg: C.S700, ring: C.S100, icon: 'logout' }
        : { kind: 'break_end', label: 'Molayı bitir', bg: C.warning, ring: C.warningL, icon: 'coffee' };
  const busy = shift.busy === main.kind;

  return (
    <>
      <Card style={{ alignItems: 'center', paddingBottom: 18 }}>
        <Muted>{dayLong(new Date(now))}</Muted>
        <T w={700} size={54} color={UI.heading} style={{ letterSpacing: -1.6, marginVertical: 2, fontVariant: ['tabular-nums'] }}>{clock(new Date(now))}</T>
        <Muted>{data.status === 'off' ? 'Mesai dışı' : `Bugün ${hm(worked)} çalıştın · mola ${hm(brk)}`}</Muted>
        <Pressable
          onLongPress={() => shift.punch(main.kind)} delayLongPress={500} disabled={!!shift.busy}
          accessibilityRole="button" accessibilityLabel={main.label} accessibilityHint="Basılı tut"
          accessibilityActions={[{ name: 'activate', label: main.label }]}
          onAccessibilityAction={() => shift.punch(main.kind)}
          style={({ pressed }) => [{
            width: 168, height: 168, borderRadius: 84, marginTop: 16, backgroundColor: main.ring,
            alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.96 : 1 }],
          }]}
        >
          <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: main.bg, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color={C.white} /> : (
              <>
                <Icon name={main.icon} size={34} color={C.white} />
                <T w={700} size={18} color={C.white} style={{ marginTop: 6 }}>{main.label}</T>
                <T size={12} color="rgba(255,255,255,0.85)">basılı tut</T>
              </>
            )}
          </View>
        </Pressable>
        {data.status === 'on' ? (
          <Btn kind="s" icon="coffee" label="Mola başlat" small style={{ marginTop: 16 }}
            loading={shift.busy === 'break_start'} onPress={() => shift.punch('break_start')} />
        ) : null}
      </Card>

      <SitePicker />
      <Row style={{ gap: 10, marginBottom: 12 }}>
        <Btn kind="s" small icon="cal" label="İzin & talepler" style={{ flex: 1 }} onPress={() => router.push('/hr/requests')} />
        <Btn kind="s" small icon="clock" label="Kayıt düzelt" style={{ flex: 1 }} onPress={() => router.push('/hr/new-request')} />
      </Row>

      <Lbl>Bugünkü kayıtlar</Lbl>
      {todays.length === 0 ? <Note>Bugün henüz kayıt yok.</Note> : (
        <List>
          {todays.slice().reverse().map(p => (
            <Li key={p.id} left={<Ico name={KIND_ICON[p.kind]} tone={p.kind === 'in' ? 'g' : p.kind === 'out' ? 'k' : 'a'} />}
              title={KIND_TR[p.kind]} sub={p.site ?? undefined} right={<T w={700} color={UI.heading}>{clock(p.punched_at)}</T>} />
          ))}
        </List>
      )}
      <Note>Konum doğrulama kuralları henüz tanımlı değil; kayıtlar sunucu saatiyle tutulur.</Note>
    </>
  );
}

function Sheet({ shift, now }: { shift: ReturnType<typeof useShift>; now: number }) {
  const [range, setRange] = useState<'7' | '30'>('7');
  const { work, brk } = spans(shift.data!.punches, now);
  const today = startOfDay(new Date(now));
  const days = Array.from({ length: Number(range) }, (_, i) => {
    const d = addDays(today, -i);
    const a = d.getTime(), z = addDays(d, 1).getTime();
    return { d, worked: within(work, a, z), brk: within(brk, a, z) };
  });
  const total = days.reduce((s, x) => s + x.worked, 0);

  return (
    <>
      <Choice value={range} onChange={setRange} items={[{ key: '7', label: 'Son 7 gün' }, { key: '30', label: 'Son 30 gün' }]} />
      <Card style={{ backgroundColor: C.P800 }}>
        <Muted style={{ color: 'rgba(255,255,255,0.6)' }}>Son {range} gün · {days.filter(d => d.worked).length} iş günü</Muted>
        <Row style={{ alignItems: 'flex-end' }}>
          <T w={700} size={40} color={C.white} style={{ letterSpacing: -0.8 }}>{hm(total)}</T>
          <Muted style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>saat</Muted>
        </Row>
      </Card>
      <List>
        {days.map(x => (
          <Li key={x.d.toISOString()} title={x.d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'short' })}
            sub={x.brk ? `Mola ${hm(x.brk)}` : undefined}
            right={<T w={700} color={x.worked ? UI.heading : UI.disabled}>{x.worked ? hm(x.worked) : '—'}</T>} />
        ))}
      </List>
    </>
  );
}

function SitePicker() {
  const [site, setSite] = useWorkSite();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Li left={<Ico name="pin" tone={site ? 'g' : 'a'} />} title={site ?? 'Çalışma yeri seç'} sub="Bugün nerede çalışıyorsun?"
        chevron onPress={() => setOpen(o => !o)} />
      {open ? <Choice value={site ?? ''} onChange={v => { setSite(v); setOpen(false); }} items={SITES.map(x => ({ key: x, label: x }))} /> : null}
    </Card>
  );
}
