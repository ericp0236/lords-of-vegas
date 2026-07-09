"use client";

import { AnimatePresence, motion } from "motion/react";
import { PLAYER_COLORS } from "@/data/playerColors";
import type { GameState } from "@/engine/types";
import {
  activityActionTile,
  activityHint,
  activityVerb,
  pendingChoiceNote,
} from "@/lib/turnActivity";
import { ActionTileButton, type ActionTileKind } from "./ui/ActionTileButton";

const ACTION_TILES: ActionTileKind[] = [
  "build",
  "sprawl",
  "remodel",
  "raise",
  "reorganize",
  "gamble",
];

/**
 * Read-only spectator dock shown to inactive players: who is up, what they're
 * doing, and a mirrored (non-interactive) action tile grid. Renders inner
 * content only — the caller supplies the Panel/dock wrapper.
 */
export function ActivePlayerPanel({
  state,
  compact = false,
}: {
  state: GameState;
  compact?: boolean;
}) {
  const active = state.players.find((p) => p.id === state.turn?.activePlayerId);
  const drawPhase = state.turn?.phase === "draw";
  const activity = state.turn?.activity;
  const activeTile = activityActionTile(activity);
  const hint =
    pendingChoiceNote(state) ??
    activityHint(activity, active?.name ?? "The active player") ??
    (drawPhase
      ? `${active?.name ?? "The active player"} is drawing a card.`
      : `${active?.name ?? "The active player"} is choosing an action.`);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <span
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold"
            style={{
              background: PLAYER_COLORS[active.color].hex,
              color: PLAYER_COLORS[active.color].textHex,
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white/90" />
            </span>
            {active.name}
            <span className="text-[10px] font-semibold opacity-85">
              {drawPhase ? "drawing" : activityVerb(activity)}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted">Waiting…</span>
        )}
      </div>

      {!compact && !drawPhase && (
        <div className="pointer-events-none grid grid-cols-3 gap-2 opacity-80">
          {ACTION_TILES.map((kind) => (
            <ActionTileButton
              key={kind}
              kind={kind}
              active={kind === activeTile}
              disabled={kind === "gamble" && !!state.turn?.gambleUsed}
              onClick={() => {}}
            />
          ))}
        </div>
      )}

      <div className="action-dock-hint" aria-live="polite">
        <AnimatePresence mode="wait">
          {hint && (
            <motion.p
              key={hint}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="action-dock-hint__text action-dock-hint__text--pending"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
