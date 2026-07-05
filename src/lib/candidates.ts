/**
 * UI helpers that compute which lots are eligible targets for each action,
 * used to highlight the board. Final validation always happens in the engine.
 */

import { ALL_LOT_IDS, BOARD_LOTS, type LotId } from "@/data/boardLots";
import { CASINO_COLOR_KEYS } from "@/data/casinoCards";
import { bossOf, casinoGroup, casinoPoints } from "@/engine/casinos";
import { canAfford, diceLots, parkingLots } from "@/engine/helpers";
import type { GameState } from "@/engine/types";

export type ActionKind = "build" | "sprawl" | "remodel" | "raise" | "reorganize" | "gamble";

/** Lots the player can build on (affordable parking lots with tiles in supply). */
export function buildTargets(state: GameState, playerId: string): LotId[] {
  const tilesAvailable = CASINO_COLOR_KEYS.some((c) => state.tileSupply[c] >= 1);
  if (!tilesAvailable) return [];
  return parkingLots(state, playerId).filter((id) =>
    canAfford(state, playerId, BOARD_LOTS[id].price),
  );
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

/** Boss casinos with an affordable, supplied sprawl target. */
export function sprawlFromTargets(state: GameState, playerId: string): LotId[] {
  const seen = new Set<LotId>();
  const result: LotId[] = [];
  for (const lotId of ALL_LOT_IDS) {
    if (seen.has(lotId) || !state.board[lotId].built) continue;
    const group = casinoGroup(state.board, lotId);
    for (const id of group) seen.add(id);
    if (bossOf(state.board, group) !== playerId) continue;
    if (sprawlTargets(state, lotId, playerId).length > 0) result.push(...group);
  }
  return result;
}

/** Adjacent, empty, unmarked lots a casino can sprawl into. */
export function sprawlTargets(
  state: GameState,
  fromLot: LotId,
  playerId?: string,
): LotId[] {
  const group = casinoGroup(state.board, fromLot);
  const color = state.board[fromLot].color;
  if (!color || state.tileSupply[color] < 1) return [];
  const risers = state.board[fromLot].risers;
  const targets = new Set<LotId>();
  for (const id of group) {
    for (const n of BOARD_LOTS[id].neighbors) {
      const t = state.board[n];
      if (t.built || t.parkingOwner) continue;
      const cost = BOARD_LOTS[n].price * 2 + risers * 15;
      if (playerId && !canAfford(state, playerId, cost)) continue;
      targets.add(n);
    }
  }
  return [...targets];
}

/** Boss casinos the player can afford to remodel (alternate color with enough tiles). */
export function remodelTargets(state: GameState, playerId: string): LotId[] {
  const seen = new Set<LotId>();
  const result: LotId[] = [];
  for (const lotId of ALL_LOT_IDS) {
    if (seen.has(lotId) || !state.board[lotId].built) continue;
    const group = casinoGroup(state.board, lotId);
    for (const id of group) seen.add(id);
    if (bossOf(state.board, group) !== playerId) continue;
    const spaces = group.length;
    const oldColor = state.board[lotId].color!;
    if (!canAfford(state, playerId, spaces * 5)) continue;
    const hasColor = CASINO_COLOR_KEYS.some(
      (c) => c !== oldColor && state.tileSupply[c] >= spaces,
    );
    if (!hasColor) continue;
    result.push(...group);
  }
  return result;
}

/** Boss casinos the player can afford to raise below max height. */
export function raiseTargets(state: GameState, playerId: string): LotId[] {
  const seen = new Set<LotId>();
  const result: LotId[] = [];
  for (const lotId of ALL_LOT_IDS) {
    if (seen.has(lotId) || !state.board[lotId].built) continue;
    const group = casinoGroup(state.board, lotId);
    for (const id of group) seen.add(id);
    if (bossOf(state.board, group) !== playerId) continue;
    const height = 1 + state.board[lotId].risers;
    if (height >= state.players.length) continue;
    if (!canAfford(state, playerId, group.length * 15)) continue;
    result.push(...group);
  }
  return result;
}

/** Lots in casinos where the player can afford to reorganize. */
export function reorganizeTargets(state: GameState, playerId: string): LotId[] {
  const reorganized = new Set(state.turn?.reorganizedLots ?? []);
  const seen = new Set<LotId>();
  const result: LotId[] = [];
  for (const lotId of ALL_LOT_IDS) {
    if (seen.has(lotId) || !state.board[lotId].built) continue;
    const group = casinoGroup(state.board, lotId);
    for (const id of group) seen.add(id);
    if (group.some((id) => reorganized.has(id))) continue;
    if (!group.some((id) => state.board[id].die?.owner === playerId)) continue;
    const totalPips = group.reduce((sum, id) => sum + (state.board[id].die?.value ?? 0), 0);
    if (!canAfford(state, playerId, totalPips)) continue;
    result.push(...group);
  }
  return result;
}

/** Lots in other bosses' casinos where the player can place a bet. */
export function gambleTargets(state: GameState, playerId: string): LotId[] {
  if (!canAfford(state, playerId, 1)) return [];
  const seen = new Set<LotId>();
  const result: LotId[] = [];
  for (const lotId of ALL_LOT_IDS) {
    if (seen.has(lotId) || !state.board[lotId].built) continue;
    const group = casinoGroup(state.board, lotId);
    for (const id of group) seen.add(id);
    const boss = bossOf(state.board, group);
    if (!boss || boss === playerId) continue;
    if (casinoPoints(state.board, group) * 5 < 1) continue;
    result.push(...group);
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

export function isActionAvailable(
  state: GameState,
  playerId: string,
  action: ActionKind,
): boolean {
  switch (action) {
    case "build":
      return buildTargets(state, playerId).length > 0;
    case "sprawl":
      return sprawlFromTargets(state, playerId).length > 0;
    case "remodel":
      return remodelTargets(state, playerId).length > 0;
    case "raise":
      return raiseTargets(state, playerId).length > 0;
    case "reorganize":
      return reorganizeTargets(state, playerId).length > 0;
    case "gamble":
      return !state.turn?.gambleUsed && gambleTargets(state, playerId).length > 0;
  }
}
