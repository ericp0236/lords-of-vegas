"use client";

/**
 * Turns game-state changes into audio feedback. Watches the state log tail
 * for fresh events (works for *everyone's* actions, not just yours — you
 * hear payouts and builds that happen on other players' turns) and detects
 * turn handoff to the viewer.
 */

import { useEffect, useRef } from "react";
import type { GameState, LogEvent } from "@/engine/types";
import { playSound, type SoundName } from "./sound/SoundManager";

function soundForEvent(e: LogEvent): SoundName | null {
  switch (e.type) {
    case "draw":
      if (e.message.includes(" drew ")) return "cardDraw";
      if (e.message.includes("lot marker")) return "chip";
      if (e.message.includes("die")) return "diceLand";
      return null;
    case "parking-payout":
      return "coin";
    case "casino-payout":
      return "cash";
    case "scoring":
      return "score";
    case "action":
      if (e.message.includes(" builds ")) return "build";
      if (e.message.includes(" sprawls ")) return "sprawl";
      if (e.message.includes(" raises ")) return "raise";
      if (e.message.includes(" remodels ")) return "remodel";
      if (e.message.includes(" reorganizes ")) return "reorganize";
      if (e.message.includes(" wagers ")) return "diceRoll";
      if (e.message.includes("removes their die")) return "diceLand";
      return null;
    case "reroll":
      return "diceRoll";
    case "trade":
      return "trade";
    case "choice":
      return "notify";
    case "game-over":
      return "gameOver";
    default:
      return null;
  }
}

const eventKey = (e: LogEvent) => `${e.at}:${e.type}:${e.message}`;

export function useGameFeedback(state: GameState | null, meId?: string) {
  const seenRef = useRef<Set<string> | null>(null);
  const prevActiveRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!state) return;

    if (!seenRef.current) {
      // First snapshot is history — absorb silently.
      seenRef.current = new Set(state.log.map(eventKey));
    } else {
      const fresh: SoundName[] = [];
      for (const e of state.log) {
        const k = eventKey(e);
        if (seenRef.current.has(k)) continue;
        seenRef.current.add(k);
        const s = soundForEvent(e);
        if (s) fresh.push(s);
      }
      // Stagger a burst of events (a draw can pay parking, pay casinos, and
      // score at once) and cap it so resolution never becomes a din.
      fresh.slice(0, 4).forEach((s, i) => {
        if (i === 0) playSound(s);
        else setTimeout(() => playSound(s), i * 260);
      });
      if (seenRef.current.size > 800) {
        seenRef.current = new Set(state.log.map(eventKey));
      }
    }

    const active = state.phase === "playing" ? state.turn?.activePlayerId ?? null : null;
    if (prevActiveRef.current !== undefined && prevActiveRef.current !== active) {
      if (meId && active === meId) playSound("turn");
    }
    prevActiveRef.current = active;
  }, [state, meId]);
}
