"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "motion/react";
import { PLAYER_COLORS, type PlayerColor } from "@/data/playerColors";

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

/** Lighten/darken a #rrggbb color by `amount` (-255..255). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.min(255, Math.max(0, v + amount));
  const r = ch((n >> 16) & 0xff);
  const g = ch((n >> 8) & 0xff);
  const b = ch(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export interface DiePalette {
  name: string;
  hex: string;
  textHex: string;
}

/** Neutral ivory palette for house dice (gambling rolls). */
export const HOUSE_DIE: DiePalette = { name: "House", hex: "#f3efe2", textHex: "#1a1c22" };

export function DieFace({
  value,
  color,
  palette,
  size = 28,
}: {
  value: number;
  color?: PlayerColor;
  palette?: DiePalette;
  size?: number;
}) {
  const meta = palette ?? PLAYER_COLORS[color ?? "red"];
  const pips = PIP_LAYOUTS[value] ?? [];
  const pad = size * 0.22;
  const cell = (size - pad * 2) / 2;
  const r = size * 0.088;
  const gradId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${meta.name} die showing ${value}`}
      className="drop-shadow-md"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={shade(meta.hex, 46)} />
          <stop offset="0.55" stopColor={meta.hex} />
          <stop offset="1" stopColor={shade(meta.hex, -38)} />
        </linearGradient>
      </defs>
      <rect
        x={0.5}
        y={0.5}
        width={size - 1}
        height={size - 1}
        rx={size * 0.22}
        fill={`url(#${gradId})`}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1}
      />
      {/* glossy top-left highlight */}
      <rect
        x={size * 0.1}
        y={size * 0.07}
        width={size * 0.55}
        height={size * 0.28}
        rx={size * 0.14}
        fill="rgba(255,255,255,0.18)"
      />
      {pips.map(([row, col], i) => (
        <circle
          key={i}
          cx={pad + col * cell}
          cy={pad + row * cell}
          r={r}
          fill={meta.textHex}
          stroke="rgba(0,0,0,0.25)"
          strokeWidth={0.6}
        />
      ))}
    </svg>
  );
}

/**
 * A die that visibly rolls when its value changes: face shuffles through
 * random values with a rotation wobble before settling on the real result.
 */
export function RollingDie({
  value,
  color,
  palette,
  size = 28,
  rollOnMount = false,
}: {
  value: number;
  color?: PlayerColor;
  palette?: DiePalette;
  size?: number;
  /** Also play the roll animation when first mounted */
  rollOnMount?: boolean;
}) {
  const [display, setDisplay] = useState(value);
  const [rolling, setRolling] = useState(false);
  const prevRef = useRef<number | null>(rollOnMount ? null : value);

  useEffect(() => {
    if (prevRef.current === value) return;
    prevRef.current = value;
    setRolling(true);
    let ticks = 0;
    const interval = setInterval(() => {
      ticks += 1;
      if (ticks >= 6) {
        clearInterval(interval);
        setDisplay(value);
        setRolling(false);
      } else {
        setDisplay(1 + Math.floor(Math.random() * 6));
      }
    }, 75);
    return () => clearInterval(interval);
  }, [value]);

  return (
    <motion.div
      animate={
        rolling
          ? { rotate: [0, -14, 11, -8, 5, 0], scale: [1, 1.15, 1.1, 1.05, 1] }
          : { rotate: 0, scale: 1 }
      }
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="inline-flex"
    >
      <DieFace value={display} color={color} palette={palette} size={size} />
    </motion.div>
  );
}
