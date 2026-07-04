import { describe, expect, it } from "vitest";
import { CASINO_COLOR_KEYS } from "@/data/casinoCards";
import { applyCommand } from "@/engine/engine";
import { diceLots, parkingLots } from "@/engine/helpers";
import type { Command, GameState } from "@/engine/types";
import { buildTargets, gambleTargets, reorganizeTargets } from "@/lib/candidates";
import { lobbyWith } from "./testUtils";

/** Simple deterministic PRNG so failures are reproducible by seed. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Play a full random game: every turn draws, sometimes takes random legal-ish
 * actions, resolves every pending choice, and ends the turn. The engine must
 * never crash, never corrupt invariants, and the game must reach an end.
 */
function playRandomGame(seed: number): GameState {
  const rng = mulberry32(seed);
  const playerCount = 3 + Math.floor(rng() * 4); // 3-6
  let state = lobbyWith(playerCount);
  const started = applyCommand(state, "p0", { type: "startGame" }, rng);
  if (!started.ok) throw new Error(started.error);
  state = started.state;

  const trySend = (actorId: string, command: Command) => {
    const r = applyCommand(state, actorId, command, rng);
    if (r.ok) state = r.state;
    return r.ok;
  };

  for (let step = 0; step < 5000 && state.phase === "playing"; step++) {
    const pc = state.pendingChoice;
    if (pc) {
      if (pc.kind === "removeDie") {
        const options = diceLots(state, pc.playerId).filter((l) => l !== pc.targetLot);
        expect(options.length).toBeGreaterThan(0);
        if (!trySend(pc.playerId, { type: "chooseRemoveDie", lotId: pick(rng, options) }))
          throw new Error("removeDie choice rejected");
      } else if (pc.kind === "vacateLot") {
        const options = parkingLots(state, pc.playerId);
        expect(options.length).toBeGreaterThan(0);
        if (!trySend(pc.playerId, { type: "chooseVacateLot", lotId: pick(rng, options) }))
          throw new Error("vacateLot choice rejected");
      } else {
        const pid = Object.keys(pc.waiting)[0];
        const lots = pc.slots[pid];
        const values = [...pc.waiting[pid]];
        // random assignment of values to lots
        for (let i = values.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [values[i], values[j]] = [values[j], values[i]];
        }
        const placements = Object.fromEntries(lots.map((l, i) => [l, values[i]]));
        if (!trySend(pid, { type: "chooseReorgPlacement", playerId: pid, placements }))
          throw new Error("reorgPlacement choice rejected");
      }
      continue;
    }

    const turn = state.turn!;
    const active = turn.activePlayerId;

    if (turn.phase === "draw") {
      if (!trySend(active, { type: "drawCard" })) throw new Error("drawCard rejected");
      continue;
    }

    // Actions phase: random action attempts, then end the turn.
    const roll = rng();
    if (roll < 0.25) {
      const lots = buildTargets(state, active);
      if (lots.length)
        trySend(active, {
          type: "action",
          action: { type: "build", lotId: pick(rng, lots), color: pick(rng, [...CASINO_COLOR_KEYS]) },
        });
    } else if (roll < 0.35) {
      const lots = reorganizeTargets(state, active);
      if (lots.length)
        trySend(active, { type: "action", action: { type: "reorganize", lotId: pick(rng, lots) } });
      continue; // may have created a pending choice
    } else if (roll < 0.45) {
      const lots = gambleTargets(state, active);
      if (lots.length && !turn.gambleUsed)
        trySend(active, {
          type: "action",
          action: { type: "gamble", lotId: pick(rng, lots), wager: 1 },
        });
    }
    if (!trySend(active, { type: "endTurn" })) throw new Error("endTurn rejected");
  }

  expect(state.phase).toBe("ended");
  expect(state.winnerId).toBeTruthy();
  // Invariants: money never negative, tile supply within bounds.
  for (const p of state.players) expect(p.money).toBeGreaterThanOrEqual(0);
  for (const c of CASINO_COLOR_KEYS) {
    expect(state.tileSupply[c]).toBeGreaterThanOrEqual(0);
    expect(state.tileSupply[c]).toBeLessThanOrEqual(9);
  }
  return state;
}

describe("random full-game playthroughs", () => {
  it("plays 40 seeded games to completion without engine errors", () => {
    for (let seed = 1; seed <= 40; seed++) {
      playRandomGame(seed);
    }
  });
});
