"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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

function nextPipFace(face: number): number {
  return (face % 6) + 1;
}

/** Cycle pip faces +1 each step, ending on the final roll result. */
function buildRollSequence(start: number, end: number, steps: number): number[] {
  if (steps <= 1) return [end];
  const faces: number[] = [start];
  let current = start;
  for (let i = 0; i < steps - 2; i++) {
    current = nextPipFace(current);
    if (i === steps - 3 && current === end && steps > 3) {
      current = nextPipFace(current);
    }
    faces.push(current);
  }
  faces.push(end);
  return faces;
}

/** Fast-to-slow delays so the die feels like it is slowing to a stop. */
function rollStepDelays(stepCount: number, totalMs: number): number[] {
  if (stepCount <= 0) return [];
  const weights = Array.from({ length: stepCount }, (_, i) => {
    const t = (i + 1) / stepCount;
    return 0.35 + t * t * 1.65;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.round((w / sum) * totalMs));
}

/**
 * A die that visibly rolls when its value changes: each pip face tumbles in
 * with a 3D flip while cycling 1→2→3→4→5→6 before settling on the result.
 */
export function RollingDie({
  value,
  color,
  palette,
  size = 28,
  rollOnMount = false,
  longRoll = false,
  fromValue,
  totalMs: totalMsProp,
  continuous = false,
}: {
  value: number;
  color?: PlayerColor;
  palette?: DiePalette;
  size?: number;
  /** Also play the roll animation when first mounted */
  rollOnMount?: boolean;
  /** Longer shuffle — used for reorganize rerolls */
  longRoll?: boolean;
  /** Animate from a specific prior value (reorganize reveal) */
  fromValue?: number;
  /** Override the total tumble duration (ms). Falls back to the long/short defaults. */
  totalMs?: number;
  /** Keep tumbling indefinitely until unmounted (gamble dice tray). */
  continuous?: boolean;
}) {
  const shouldRollOnMount = rollOnMount || fromValue !== undefined || continuous;
  const stepCount = longRoll ? 15 : 11;
  const totalMs = totalMsProp ?? (longRoll ? 1200 : 720);
  const revealKey =
    fromValue !== undefined ? `reveal:${fromValue}->${value}:${longRoll}` : null;
  const revealRanRef = useRef<string | null>(null);
  const prevRef = useRef<number | null>(shouldRollOnMount ? null : value);
  const timersRef = useRef<number[]>([]);

  const [display, setDisplay] = useState(() => {
    if (fromValue !== undefined) return fromValue;
    if (shouldRollOnMount) return nextPipFace(nextPipFace(value));
    return value;
  });
  const [rolling, setRolling] = useState(shouldRollOnMount);
  const [landing, setLanding] = useState(false);
  const [faceEpoch, setFaceEpoch] = useState(0);

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  };

  const schedule = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  useEffect(() => {
    clearTimers();

    if (continuous) {
      let current =
        fromValue !== undefined
          ? fromValue
          : nextPipFace(nextPipFace(value));
      setRolling(true);
      setLanding(false);
      setDisplay(current);
      setFaceEpoch(0);

      const tick = () => {
        current = nextPipFace(current);
        setDisplay(current);
        setFaceEpoch((n) => n + 1);
        schedule(tick, 95);
      };
      schedule(tick, 45);
      return () => {
        clearTimers();
        if (fromValue !== undefined) revealRanRef.current = null;
        else if (shouldRollOnMount) prevRef.current = null;
      };
    }

    const isReveal = fromValue !== undefined;
    let startFace: number;

    if (isReveal) {
      if (revealRanRef.current === revealKey) return;
      revealRanRef.current = revealKey;
      prevRef.current = value;
      startFace = fromValue;
    } else if (prevRef.current === value) {
      return;
    } else {
      startFace = prevRef.current ?? nextPipFace(nextPipFace(value));
      prevRef.current = value;
    }

    const sequence = buildRollSequence(startFace, value, stepCount);
    const delays = rollStepDelays(sequence.length - 1, totalMs);

    setRolling(true);
    setLanding(false);
    setDisplay(sequence[0]);
    setFaceEpoch(0);

    let step = 0;
    const advance = () => {
      step += 1;
      if (step >= sequence.length) {
        setRolling(false);
        setLanding(true);
        schedule(() => setLanding(false), 320);
        return;
      }
      setDisplay(sequence[step]);
      setFaceEpoch((n) => n + 1);
      schedule(advance, delays[step] ?? 80);
    };

    schedule(advance, delays[0] ?? 45);
    return () => {
      clearTimers();
      // Strict Mode re-runs effects after cleanup — reset so the roll can replay.
      if (isReveal) {
        revealRanRef.current = null;
      } else if (shouldRollOnMount) {
        prevRef.current = null;
      }
    };
  }, [value, fromValue, revealKey, stepCount, totalMs, shouldRollOnMount, continuous]);

  const die = (
    <DieFace value={display} color={color} palette={palette} size={size} />
  );

  if (!rolling && !landing && faceEpoch === 0) {
    return <span className="inline-flex">{die}</span>;
  }

  return (
    <div
      className="inline-flex items-center justify-center"
      style={{
        width: size,
        height: size,
        perspective: size * 2.4,
      }}
    >
      <motion.div
        className="inline-flex origin-center"
        animate={
          landing
            ? { scale: [1.18, 0.94, 1], rotateZ: [0, -4, 0] }
            : { scale: 1, rotateZ: 0 }
        }
        transition={
          landing
            ? { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
            : { duration: 0.08 }
        }
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={faceEpoch}
            className="inline-flex origin-center"
            style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
            initial={
              faceEpoch === 0
                ? { rotateX: 0, rotateY: 0, opacity: 1, scale: 1 }
                : { rotateX: -92, rotateY: 18, scale: 0.65, opacity: 0.08 }
            }
            animate={{ rotateX: 0, rotateY: 0, scale: 1, opacity: 1 }}
            exit={{ rotateX: 92, rotateY: -18, scale: 0.65, opacity: 0.08 }}
            transition={{
              duration: rolling ? 0.1 : 0.16,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {die}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
