"use client";

/**
 * Scoring track for side rails and sheets.
 * - `grid`: 3-column tiers (Director view, mobile sheet)
 * - `column`: single column stretched top-to-bottom (player left rail)
 */

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { motion } from "motion/react";
import { PLAYER_COLORS } from "@/data/playerColors";
import {
  advanceGapAt,
  buildTrackGrid,
  JACKPOT,
  MAX_TRACK_INDEX,
  SCORE_TRACK,
  stepFrom,
  trackTiers,
} from "@/data/scoreTrack";
import type { GameState } from "@/engine/types";
import { PlayerCarMarker } from "./ui/MiniIcons";

const GRID_COLS = 3;
const GRID_CELL_WIDTH = `calc((100% - ${GRID_COLS - 1}px) / ${GRID_COLS})`;
const { tiers: TIER_BLOCKS, jackpotIndex: JACKPOT_INDEX } = buildTrackGrid(GRID_COLS);

/** gap 1 = no tint; higher gaps ramp up to ~32% accent mix at gap 9. */
function tierBackground(gap: number): string | undefined {
  if (gap <= 1) return undefined;
  const mix = Math.min(32, 6 + (gap - 2) * 3.25);
  return `color-mix(in srgb, var(--accent) ${mix}%, var(--surface-2))`;
}

function tierGapByIndex(): Map<number, number> {
  const map = new Map<number, number>();
  for (const tier of trackTiers()) {
    for (let i = tier.fromIndex; i <= tier.toIndex; i++) {
      map.set(i, tier.gap);
    }
  }
  return map;
}

const TIER_GAP_BY_INDEX = tierGapByIndex();

export function ScoreTrackPanel({
  state,
  layout = "grid",
  className = "",
}: {
  state: GameState;
  layout?: "grid" | "column";
  className?: string;
}) {
  const playersByIndex = useMemo(() => {
    const map = new Map<number, GameState["players"]>();
    for (const p of state.players) {
      const list = map.get(p.trackIndex) ?? [];
      list.push(p);
      map.set(p.trackIndex, list);
    }
    return map;
  }, [state.players]);

  if (layout === "column") {
    return (
      <section
        className={`flex min-h-0 flex-1 flex-col border border-[var(--border)] bg-[var(--surface)] ${className}`}
        aria-label="Score track"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-px p-px">
          {SCORE_TRACK.map((_, trackIndex) => (
            <TrackCell
              key={trackIndex}
              trackIndex={trackIndex}
              tierGap={TIER_GAP_BY_INDEX.get(trackIndex) ?? 0}
              players={playersByIndex.get(trackIndex) ?? []}
              layout="column"
              className="min-h-0 flex-1"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 ${className}`}
    >
      <h2 className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">
        Score track
      </h2>

      <div className="flex flex-col gap-1">
        {TIER_BLOCKS.map((tier) => (
          <div
            key={`${tier.gap}-${tier.rows[0][0]}`}
            className={`flex flex-col gap-px ${
              tier.gap > 1 ? "rounded-sm p-0.5 ring-1 ring-inset ring-[var(--accent)]/20" : ""
            }`}
          >
            {tier.rows.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-px">
                {row.map((trackIndex) => (
                  <TrackCell
                    key={trackIndex}
                    trackIndex={trackIndex}
                    tierGap={tier.gap}
                    players={playersByIndex.get(trackIndex) ?? []}
                    layout="grid"
                    className="shrink-0"
                    style={{ width: GRID_CELL_WIDTH }}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}

        <TrackCell
          trackIndex={JACKPOT_INDEX}
          tierGap={0}
          players={playersByIndex.get(JACKPOT_INDEX) ?? []}
          layout="grid"
          className="shrink-0"
          style={{ width: GRID_CELL_WIDTH }}
        />
      </div>
    </section>
  );
}

function TrackCell({
  trackIndex,
  tierGap,
  players,
  layout,
  className = "",
  style,
}: {
  trackIndex: number;
  tierGap: number;
  players: GameState["players"];
  layout: "grid" | "column";
  className?: string;
  style?: CSSProperties;
}) {
  const value = SCORE_TRACK[trackIndex];
  const step = stepFrom(trackIndex);
  const gap = advanceGapAt(trackIndex);
  const isJackpot = trackIndex === MAX_TRACK_INDEX;
  const isStart = trackIndex === 0;
  const tierBg = isJackpot ? undefined : tierBackground(tierGap);
  const isColumn = layout === "column";

  return (
    <div
      className={`flex items-center justify-between gap-0.5 bg-[var(--surface-2)] ${className} ${
        isColumn ? "px-1 py-0" : "min-h-[22px] rounded-sm px-1 py-0.5"
      } ${isJackpot ? "ring-1 ring-inset ring-[var(--accent)]/70" : ""}`}
      style={{ ...style, ...(tierBg ? { background: tierBg } : {}) }}
      title={cellTitle(value, step, gap, tierGap, isJackpot, isStart)}
    >
      <span
        className={`font-mono leading-none ${
          isColumn ? "text-[9px]" : "text-[10px]"
        } ${isJackpot ? "font-bold text-[var(--accent)]" : "text-white/85"}`}
      >
        {value}
        {isJackpot && <span className="sr-only"> jackpot</span>}
      </span>
      {players.length > 0 && (
        <div className={`flex justify-end gap-px ${isColumn ? "max-w-[55%] flex-col items-end" : "max-w-[60%] flex-wrap"}`}>
          {players.map((p) => (
            <motion.span
              key={p.id}
              layoutId={`score-marker-${p.id}`}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="inline-flex shrink-0"
            >
              <PlayerCarMarker
                color={PLAYER_COLORS[p.color].hex}
                size={isColumn ? 12 : 14}
                title={`${p.name}: ${value} pts`}
              />
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}

function cellTitle(
  value: number,
  step: ReturnType<typeof stepFrom>,
  gap: number,
  tierGap: number,
  isJackpot: boolean,
  isStart: boolean,
): string {
  if (isJackpot) return `${JACKPOT} — jackpot`;
  if (isStart) return "Start (0 points)";
  if (tierGap > 1) {
    return `${value} pts — ${tierGap}-point tier${step ? ` (next: ${step.toValue})` : ""}`;
  }
  if (!step) return `${value} points`;
  return `${value} points (next: ${step.toValue})`;
}
