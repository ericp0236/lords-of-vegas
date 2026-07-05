"use client";

/**
 * Lightweight celebratory confetti burst — pure CSS transforms driven by
 * motion, no canvas and no dependencies. Renders ~70 pieces once and lets
 * them fall; cheap enough for old iPads.
 */

import { useMemo } from "react";
import { motion } from "motion/react";

const COLORS = ["#f5c542", "#ff5d73", "#43e8e0", "#3ddc97", "#ffffff", "#9333ea"];

interface Piece {
  id: number;
  x: number; // vw
  delay: number;
  duration: number;
  size: number;
  color: string;
  drift: number;
  spin: number;
}

/** Deterministic pseudo-random in [0, 1) — render-pure and SSR-stable. */
function prand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const items = useMemo<Piece[]>(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        x: prand(i) * 100,
        delay: prand(i + 1000) * 2.2,
        duration: 3 + prand(i + 2000) * 2.5,
        size: 6 + prand(i + 3000) * 7,
        color: COLORS[i % COLORS.length],
        drift: (prand(i + 4000) - 0.5) * 30,
        spin: 360 + prand(i + 5000) * 720,
      })),
    [pieces],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
      {items.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: -30, rotate: 0, opacity: 1 }}
          animate={{
            y: "110vh",
            x: p.drift * 8,
            rotate: p.spin,
            opacity: [1, 1, 0.9, 0],
          }}
          transition={{ delay: p.delay, duration: p.duration, ease: [0.3, 0.4, 0.6, 1] }}
          className="absolute top-0"
          style={{
            left: `${p.x}vw`,
            width: p.size,
            height: p.size * 0.45,
            background: p.color,
            borderRadius: 1.5,
          }}
        />
      ))}
    </div>
  );
}
