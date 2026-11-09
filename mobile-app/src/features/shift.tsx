import { useEffect, useState } from 'react';
import { Alert as RNAlert, View } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { addDays, hm, spans, startOfDay, within, type PunchKind, type ShiftData } from '@/lib/shift';
import { clock } from '@/lib/format';
import { Btn, Card, Chip, Muted, Row, T } from '@/ui/kit';
import { C } from '@/ui/theme';

/** Re-render every `ms` so running timers move. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** My punches for the last `days` local days (+1 day so a shift carried over midnight is whole). */
export function useShift(days = 7) {
  const [from] = useState(() => addDays(startOfDay(new Date()), -days).toISOString());
  const q = useApi<ShiftData>(`/api/hr/shift?from=${encodeURIComponent(from)}`);
  const [busy, setBusy] = useState<PunchKind | null>(null);

  async function punch(kind: PunchKind) {
    setBusy(kind);
    try {
      await api('/api/hr/shift', { method: 'POST', body: { kind } });
    } catch (e) {
      RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : 'Tekrar dene.');
      if (!(e instanceof ApiError && e.status === 409)) { setBusy(null); return; }
    }
    await q.reload();
    setBusy(null);
  }
  return { ...q, punch, busy };
}

export function todayTotals(data: ShiftData | null, now: number) {
  const day = startOfDay(new Date(now)).getTime();
  const { work, brk } = spans(data?.punches ?? [], now);
  const firstIn = data?.punches.find(p => p.kind === 'in' && Date.parse(p.punched_at) >= day);
  return { worked: within(work, day, day + 864e5), brk: within(brk, day, day + 864e5), firstIn };
}

/** The dark "Mesaide" card from the home screen (002). */
export function ShiftCard({ shift }: { shift: ReturnType<typeof useShift> }) {
  const now = useNow();
  const { data, busy, punch } = shift;
  if (!data) return null;
  const { worked, brk, firstIn } = todayTotals(data, now);
  const site = data.last?.site;
  const chip = data.status === 'on'
    ? { label: '● Mesaide', bg: 'rgba(30,142,87,0.25)', fg: C.successL }
    : data.status === 'break'
      ? { label: '● Molada', bg: 'rgba(244,167,23,0.25)', fg: C.warningL }
      : { label: 'Mesai dışı', bg: 'rgba(255,255,255,0.12)', fg: C.white };

  return (
    <Card style={{ backgroundColor: C.P800 }}>
      <Row>
        <Chip label={chip.label} style={{ backgroundColor: chip.bg }} />
        <View style={{ flex: 1 }} />
        {site ? <T size={13} color="rgba(255,255,255,0.6)">{site}</T> : null}
      </Row>
      <Row style={{ marginTop: 12, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <T w={700} size={40} color={C.white} style={{ letterSpacing: -0.8, fontVariant: ['tabular-nums'] }}>{hm(worked)}</T>
          <Muted style={{ color: 'rgba(255,255,255,0.6)' }}>
            {firstIn ? `Giriş ${clock(firstIn.punched_at)} · Mola ${hm(brk)}` : 'Bugün giriş yok'}
          </Muted>
        </View>
        {data.status === 'off' ? (
          <Btn small label="Giriş yap" onPress={() => router.push('/shift')} />
        ) : (
          <>
            <Btn small kind="ghost" icon="coffee" label={data.status === 'break' ? 'Molayı bitir' : 'Mola'}
              loading={busy === 'break_start' || busy === 'break_end'}
              onPress={() => punch(data.status === 'break' ? 'break_end' : 'break_start')} />
            {data.status === 'on' ? <Btn small label="Çıkış" onPress={() => router.push('/shift')} /> : null}
          </>
        )}
      </Row>
    </Card>
  );
}
