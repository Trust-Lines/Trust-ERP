"use client";

import { useMemo } from "react";
import { motion } from "motion/react";

export const FIREWORK_PALETTE = ["#154528", "#fde047", "#a16207", "#ffffff", "#dff2e6"];

export function VictoryFireworks({ reduceMotion }: { reduceMotion: boolean }) {
  const bursts = useMemo(() => {
    if (reduceMotion) return [];
    return Array.from({ length: 4 }, (_, b) => {
      const cx = 12 + b * 24 + Math.random() * 10;
      const cy = 14 + Math.random() * 16;
      const rocketDelay = 0.15 + b * 0.42;
      const rocketDuration = 0.5 + Math.random() * 0.12;
      const burstDelay = rocketDelay + rocketDuration - 0.04;
      const size = 15 + Math.floor(Math.random() * 6);
      return {
        id: b,
        cx,
        cy,
        rocketDelay,
        rocketDuration,
        burstDelay,
        color: FIREWORK_PALETTE[b % FIREWORK_PALETTE.length],
        particles: Array.from({ length: size }, (_, i) => {
          const angle = (i / size) * Math.PI * 2 + Math.random() * 0.25;
          const radius = 46 + Math.random() * 46;
          return {
            id: i,
            dx: Math.cos(angle) * radius,
            dy: Math.sin(angle) * radius,
            color: FIREWORK_PALETTE[(b + i) % FIREWORK_PALETTE.length],
            size: 4 + Math.random() * 3
          };
        })
      };
    });
  }, [reduceMotion]);

  if (!bursts.length) return null;

  return (
    <div className="firework-layer" aria-hidden="true">
      {bursts.map((burst) => (
        <div key={burst.id} className="firework-origin" style={{ left: `${burst.cx}%`, top: `${burst.cy}%` }}>
          <motion.span
            className="firework-rocket"
            style={{ background: `linear-gradient(to top, ${burst.color}, transparent)` }}
            initial={{ y: 130, opacity: 0, scaleY: 0.5 }}
            animate={{ y: 0, opacity: [0, 1, 1, 0], scaleY: 1 }}
            transition={{ duration: burst.rocketDuration, delay: burst.rocketDelay, ease: "easeOut" }}
          />
          <motion.span
            className="firework-glow"
            style={{ background: `radial-gradient(circle, ${burst.color}55 0%, transparent 70%)` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 2.4, 3.2], opacity: [0, 0.8, 0] }}
            transition={{ duration: 0.6, delay: burst.burstDelay, ease: "easeOut" }}
          />
          {burst.particles.map((p) => (
            <motion.span
              key={p.id}
              className="firework-particle"
              style={{ background: p.color, width: p.size, height: p.size }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
              animate={{
                x: [0, p.dx * 0.9, p.dx * 1.08],
                y: [0, p.dy * 0.75, p.dy + 46],
                opacity: [0, 1, 0],
                scale: [0.6, 1, 0.5]
              }}
              transition={{ duration: 1.35, delay: burst.burstDelay, ease: [0.16, 0.8, 0.3, 1], times: [0, 0.45, 1] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export const CONFETTI_PALETTE = ["#154528", "#fde047", "#a16207", "#ffffff", "#dff2e6", "#0d2417"];

export function VictoryConfetti({ reduceMotion }: { reduceMotion: boolean }) {
  const pieces = useMemo(() => {
    if (reduceMotion) return [];
    return Array.from({ length: 26 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 2.8 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 90,
      rotate: 180 + Math.random() * 360,
      width: 5 + Math.random() * 4,
      height: 9 + Math.random() * 6,
      color: CONFETTI_PALETTE[i % CONFETTI_PALETTE.length],
      round: i % 4 === 0
    }));
  }, [reduceMotion]);

  if (!pieces.length) return null;

  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: p.round ? "50%" : "1px"
          }}
          initial={{ y: -24, x: 0, opacity: 0, rotate: 0 }}
          animate={{ y: 560, x: p.drift, opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
