"use client";

/**
 * Player standings — horizontal strip for mobile, compact table for the
 * desktop info rail.
 */

import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { PLAYER_COLORS } from "@/data/playerColors";
import { SCORE_TRACK } from "@/data/scoreTrack";
import { diceOnBoard, markersOnBoard } from "@/engine/helpers";
import type { GameState } from "@/engine/types";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import { MiniDie, MiniMarker, PlayerCarMarker } from "./ui/MiniIcons";
import { MoneyValue } from "./ui/MoneyValue";

function orderedPlayers(state: GameState) {
  return [...state.players].sort((a, b) => a.seat - b.seat);
}

export function PlayerStandingsTable({
  state,
  viewerId,
}: {
  state: GameState;
  viewerId?: string;
}) {
  const activeId = state.phase === "playing" ? state.turn?.activePlayerId : null;
  const players = orderedPlayers(state);

  return (
    <div className="standings-table-wrap overflow-x-auto">
      <table className="standings-table w-full border-collapse">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-muted">
            <th className="pb-1.5 pr-1 text-left font-bold">Player</th>
            <th className="pb-1.5 px-0.5 text-right font-bold">Pts</th>
            <th className="pb-1.5 px-0.5 text-right font-bold">$</th>
            <th className="pb-1.5 px-0.5 text-right font-bold" title="Dice left">
              <span className="sr-only">Dice left</span>
              <MiniDie className="mx-auto" />
            </th>
            <th className="pb-1.5 pl-0.5 text-right font-bold" title="Lot markers left">
              <span className="sr-only">Lot markers left</span>
              <MiniMarker className="mx-auto" />
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const meta = PLAYER_COLORS[p.color];
            const isActive = p.id === activeId;
            const isMe = p.id === viewerId;
            const diceLeft = 12 - diceOnBoard(state, p.id);
            const markersLeft = 10 - markersOnBoard(state, p.id);

            return (
              <tr
                key={p.id}
                className={`standings-table__row ${isActive ? "standings-table__row--active" : ""}`}
                style={
                  isActive
                    ? ({ "--player-color": meta.hex } as CSSProperties)
                    : undefined
                }
              >
                <td className="py-1 pr-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="relative flex shrink-0 items-center">
                      <PlayerCarMarker color={meta.hex} size={12} />
                      {isActive && (
                        <span
                          className="absolute inset-0 animate-ping rounded-full opacity-60"
                          style={{ background: meta.hex }}
                        />
                      )}
                    </span>
                    <span className="truncate text-[11px] font-semibold leading-none">
                      {p.name}
                      {isMe && <span className="text-muted"> ·you</span>}
                    </span>
                  </div>
                </td>
                <td className="px-0.5 py-1 text-right font-mono text-[10px] font-bold text-[var(--accent)]">
                  <AnimatedNumber value={SCORE_TRACK[p.trackIndex]} />
                </td>
                <td className="px-0.5 py-1 text-right">
                  <MoneyValue amount={p.money} className="text-[10px] leading-none" />
                </td>
                <td className="px-0.5 py-1 text-right font-mono text-[10px] text-white/55">
                  {diceLeft}
                </td>
                <td className="py-1 pl-0.5 text-right font-mono text-[10px] text-white/55">
                  {markersLeft}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Horizontal chip strip — used on mobile where the side rail is hidden. */
export function PlayerChips({
  state,
  viewerId,
}: {
  state: GameState;
  viewerId?: string;
}) {
  const activeId = state.phase === "playing" ? state.turn?.activePlayerId : null;
  const players = orderedPlayers(state);

  return (
    <div className="scrollbar-thin flex shrink-0 gap-1.5 overflow-x-auto pb-0.5">
      {players.map((p) => {
        const meta = PLAYER_COLORS[p.color];
        const isActive = p.id === activeId;
        const isMe = p.id === viewerId;
        return (
          <motion.div
            key={p.id}
            animate={{
              boxShadow: isActive
                ? `0 0 0 1.5px ${meta.hex}, 0 0 16px 1px ${meta.hex}66`
                : "0 0 0 1px var(--border)",
            }}
            transition={{ duration: 0.4 }}
            className={`flex min-w-fit shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 ${
              isActive ? "bg-[var(--surface-2)]" : "bg-[var(--surface)]"
            }`}
          >
            <span className="relative flex shrink-0 items-center">
              <PlayerCarMarker color={meta.hex} size={14} />
              {isActive && (
                <span
                  className="absolute inset-0 animate-ping rounded-full opacity-60"
                  style={{ background: meta.hex }}
                />
              )}
            </span>
            <span className="max-w-[9ch] truncate text-xs font-semibold leading-none">
              {p.name}
              {isMe && <span className="text-muted"> ·you</span>}
            </span>
            <MoneyValue amount={p.money} className="text-xs leading-none" />
            <span className="text-xs leading-none text-[var(--accent)]">
              <AnimatedNumber value={SCORE_TRACK[p.trackIndex]} className="font-mono font-bold" />
              <span className="ml-0.5 text-[9px] text-muted">pts</span>
            </span>
            <span
              className="hidden items-center gap-0.5 font-mono text-[10px] leading-none text-white/50 sm:flex"
              title={`${12 - diceOnBoard(state, p.id)} dice, ${10 - markersOnBoard(state, p.id)} lot markers remaining`}
            >
              <MiniDie /> {12 - diceOnBoard(state, p.id)}
              <MiniMarker className="ml-1" /> {10 - markersOnBoard(state, p.id)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
