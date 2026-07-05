"use client";

import type { ReactNode } from "react";
import { diceOnBoard, markersOnBoard } from "@/engine/helpers";
import type { GameState } from "@/engine/types";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import { MiniDie, MiniMarker } from "./ui/MiniIcons";
import { MoneyValue } from "./ui/MoneyValue";

const DICE_TOTAL = 12;
const MARKERS_TOTAL = 10;

export function MyStatsPanel({
  state,
  playerId,
  compact = false,
}: {
  state: GameState;
  playerId: string;
  compact?: boolean;
}) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const diceLeft = DICE_TOTAL - diceOnBoard(state, playerId);
  const markersLeft = MARKERS_TOTAL - markersOnBoard(state, playerId);

  return (
    <div className={`my-stats ${compact ? "my-stats--compact" : ""}`}>
      <div className="my-stats__grid">
        <StatTile
          label="Money"
          compact={compact}
          value={<MoneyValue amount={player.money} className="text-sm" />}
        />
        <StatTile
          label="Dice"
          compact={compact}
          icon={<MiniDie className="text-[var(--accent)]" />}
          value={
            <span className="font-mono text-sm font-bold text-white">
              <AnimatedNumber value={diceLeft} />
              <span className="text-[10px] font-medium text-muted">/{DICE_TOTAL}</span>
            </span>
          }
          low={diceLeft === 0}
        />
        <StatTile
          label="Markers"
          compact={compact}
          icon={<MiniMarker className="text-[var(--accent)]" />}
          value={
            <span className="font-mono text-sm font-bold text-white">
              <AnimatedNumber value={markersLeft} />
              <span className="text-[10px] font-medium text-muted">/{MARKERS_TOTAL}</span>
            </span>
          }
          low={markersLeft === 0}
        />
      </div>
    </div>
  );
}

function StatTile({
  label,
  icon,
  value,
  compact,
  low = false,
}: {
  label: string;
  icon?: ReactNode;
  value: ReactNode;
  compact?: boolean;
  low?: boolean;
}) {
  return (
    <div
      className={`my-stats__tile ${low ? "my-stats__tile--low" : ""} ${compact ? "my-stats__tile--compact" : ""}`}
      title={label}
    >
      <div className="my-stats__tile-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="my-stats__tile-value">{value}</div>
    </div>
  );
}
