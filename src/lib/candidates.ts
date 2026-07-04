/**
 * UI helpers that compute which lots are eligible targets for each action,
 * used to highlight the board. Final validation always happens in the engine.
 */

import { ALL_LOT_IDS, BOARD_LOTS, type LotId } from "@/data/boardLots";
import { bossOf, casinoGroup } from "@/engine/casinos";
import { diceLots, parkingLots } from "@/engine/helpers";
import type { GameState } from "@/engine/types";

/** Lots the player can build on (their parking lots). */
export function buildTargets(state: GameState, playerId: string): LotId[] {
  return parkingLots(state, playerId);
}

/** One representative lot per casino where the player is boss. */
export function bossCasinoLots(state: GameState, playerId: string): LotId[] {
  const seen = new Set<LotId>();
  const reps: LotId[] = [];
  for (const lotId of ALL_LOT_IDS) {
    if (seen.has(lotId) || !state.board[lotId].built) continue;
    const group = casinoGroup(state.board, lotId);
    for (const id of group) seen.add(id);
    if (bossOf(state.board, group) === playerId) reps.push(...group);
  }
  return reps;
}

/** Adjacent, empty, unmarked lots a casino can sprawl into. */
export function sprawlTargets(state: GameState, fromLot: LotId): LotId[] {
  const group = casinoGroup(state.board, fromLot);
  const targets = new Set<LotId>();
  for (const id of group) {
    for (const n of BOARD_LOTS[id].neighbors) {
      const t = state.board[n];
      if (!t.built && !t.parkingOwner) targets.add(n);
    }
  }
  return [...targets];
}

/** Lots in casinos where the player has at least one die (reorganize). */
export function reorganizeTargets(state: GameState, playerId: string): LotId[] {
  const reorganized = new Set(state.turn?.reorganizedLots ?? []);
  const seen = new Set<LotId>();
  const result: LotId[] = [];
  for (const lotId of ALL_LOT_IDS) {
    if (seen.has(lotId) || !state.board[lotId].built) continue;
    const group = casinoGroup(state.board, lotId);
    for (const id of group) seen.add(id);
    if (group.some((id) => reorganized.has(id))) continue;
    if (group.some((id) => state.board[id].die?.owner === playerId)) result.push(...group);
  }
  return result;
}

/** Lots in casinos bossed by someone else (gamble). */
export function gambleTargets(state: GameState, playerId: string): LotId[] {
  const seen = new Set<LotId>();
  const result: LotId[] = [];
  for (const lotId of ALL_LOT_IDS) {
    if (seen.has(lotId) || !state.board[lotId].built) continue;
    const group = casinoGroup(state.board, lotId);
    for (const id of group) seen.add(id);
    const boss = bossOf(state.board, group);
    if (boss && boss !== playerId) result.push(...group);
  }
  return result;
}

/** The player's dice lots, excluding a target (for exhaustion vacate picks). */
export function vacateDieCandidates(
  state: GameState,
  playerId: string,
  excludeLot?: LotId,
): LotId[] {
  return diceLots(state, playerId).filter((id) => id !== excludeLot);
}
