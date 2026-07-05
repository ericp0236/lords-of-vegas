"use client";

import { useEffect, useMemo, useState } from "react";
import type { LotId } from "@/data/boardLots";
import type { PlayerColor } from "@/data/playerColors";
import type { GameState, PendingChoice, ReorgReroll } from "@/engine/types";

export interface ReorgRollOverlayDie {
  value: number;
  color: PlayerColor;
  fromValue: number;
}

/** How long to show dice rolling on the board before placement UI appears. */
export const REORG_ROLL_MS = 1200;

export function useReorgRollPhase(
  pending: PendingChoice | null,
  players: GameState["players"],
  turnReveal: ReorgReroll[] | null | undefined,
) {
  const [rollDone, setRollDone] = useState(false);

  const rerolls = useMemo(() => {
    if (pending?.kind === "reorgPlacement" && pending.rerolls?.length) {
      return pending.rerolls;
    }
    if (turnReveal?.length) return turnReveal;
    return [];
  }, [pending, turnReveal]);

  const rollKey = useMemo(() => {
    if (rerolls.length === 0) return null;
    return rerolls.map((r) => `${r.lotId}:${r.from}:${r.to}`).join("|");
  }, [rerolls]);

  useEffect(() => {
    if (!rollKey) {
      setRollDone(false);
      return;
    }
    setRollDone(false);
    const t = window.setTimeout(() => setRollDone(true), REORG_ROLL_MS);
    return () => window.clearTimeout(t);
  }, [rollKey]);

  const rollOverlays = useMemo((): Partial<Record<LotId, ReorgRollOverlayDie>> => {
    if (!rollKey || rollDone) return {};
    const map: Partial<Record<LotId, ReorgRollOverlayDie>> = {};
    for (const r of rerolls) {
      const owner = players.find((p) => p.id === r.ownerId);
      if (!owner) continue;
      map[r.lotId] = { value: r.to, color: owner.color, fromValue: r.from };
    }
    return map;
  }, [rollKey, rollDone, players, rerolls]);

  return {
    inRollPhase: !!rollKey && !rollDone,
    rollDone: !rollKey || rollDone,
    rollOverlays,
  };
}
