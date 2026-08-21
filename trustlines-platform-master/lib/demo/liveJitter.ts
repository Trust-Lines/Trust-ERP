'use client';

import { useEffect, useState } from 'react';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

export function useLiveTick(intervalMs = 2400): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

export function liveJitter(seed: string, tick: number, amplitude = 0.02): number {
  const phase = hash(seed) * Math.PI * 2;
  const speed = 0.55 + hash(seed + '|speed') * 0.5;
  return Math.sin(tick * speed + phase) * amplitude;
}

export function jitterPct(base: number, seed: string, tick: number, amplitude = 0.02): number {
  return Math.min(1, Math.max(0, base + liveJitter(seed, tick, amplitude)));
}
