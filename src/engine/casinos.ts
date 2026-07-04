/**
 * Casino grouping, boss determination, and boss-tie reroll cascades.
 *
 * A casino is a maximal connected group of built tiles of the same color AND
 * the same height (1 + risers). Two same-color stacks of different heights
 * are separate casinos until heights match, at which point they instantly
 * merge (grouping is recomputed from the board, so merging is automatic).
 */

import { BOARD_LOTS, type LotId } from "@/data/boardLots";
import type { Board, GameState, LogEvent, Rng } from "./types";

export function rollDie(rng: Rng): number {
  return 1 + Math.floor(rng() * 6);
}

export function roll2d6(rng: Rng): number {
  return rollDie(rng) + rollDie(rng);
}

/** Height of a built tile (1 + risers). */
export function tileHeight(board: Board, lotId: LotId): number {
  const t = board[lotId];
  return t.built ? 1 + t.risers : 0;
}

/**
 * The casino group containing `lotId` (empty array if the lot is not built).
 * Same color + same height, connected within the block.
 */
export function casinoGroup(board: Board, lotId: LotId): LotId[] {
  const start = board[lotId];
  if (!start.built) return [];
  const color = start.color;
  const height = tileHeight(board, lotId);
  const seen = new Set<LotId>([lotId]);
  const stack: LotId[] = [lotId];
  const group: LotId[] = [];
  while (stack.length) {
    const id = stack.pop()!;
    group.push(id);
    for (const n of BOARD_LOTS[id].neighbors) {
      if (seen.has(n)) continue;
      const nt = board[n];
      if (nt.built && nt.color === color && tileHeight(board, n) === height) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return group.sort();
}

/** All distinct casino groups on the board. */
export function allCasinos(board: Board): LotId[][] {
  const seen = new Set<LotId>();
  const groups: LotId[][] = [];
  for (const lotId of Object.keys(board)) {
    if (seen.has(lotId) || !board[lotId].built) continue;
    const group = casinoGroup(board, lotId);
    for (const id of group) seen.add(id);
    groups.push(group);
  }
  return groups;
}

/** Total tiles in a casino including risers (point value when scored). */
export function casinoPoints(board: Board, group: LotId[]): number {
  return group.reduce((sum, id) => sum + 1 + board[id].risers, 0);
}

export interface BossInfo {
  /** Highest die value in the casino, or 0 if no dice */
  value: number;
  /** Unique player ids holding dice at that value */
  owners: string[];
}

export function casinoBoss(board: Board, group: LotId[]): BossInfo {
  let value = 0;
  const owners = new Set<string>();
  for (const id of group) {
    const d = board[id].die;
    if (!d) continue;
    if (d.value > value) {
      value = d.value;
      owners.clear();
      owners.add(d.owner);
    } else if (d.value === value) {
      owners.add(d.owner);
    }
  }
  return { value, owners: [...owners] };
}

/** The single boss of a casino, or null (tie or no dice). */
export function bossOf(board: Board, group: LotId[]): string | null {
  const { owners } = casinoBoss(board, group);
  return owners.length === 1 ? owners[0] : null;
}

/**
 * Resolve boss ties in the casino containing `lotId` by rerolling all dice
 * tied at the top value, repeatedly, until a single player holds the
 * highest value (or all tied dice belong to one player).
 * Mutates nothing: returns a new board plus reroll log events.
 */
export function resolveBossTies(
  state: GameState,
  lotId: LotId,
  rng: Rng,
): { board: Board; events: LogEvent[] } {
  let board = state.board;
  const events: LogEvent[] = [];
  const turn = state.turn?.number ?? 0;
  // Guard against pathological rng; ties break with probability 1 long before this.
  for (let guard = 0; guard < 200; guard++) {
    const group = casinoGroup(board, lotId);
    if (group.length === 0) break;
    const { value, owners } = casinoBoss(board, group);
    if (owners.length <= 1) break;
    const rerolls: string[] = [];
    const next: Board = { ...board };
    for (const id of group) {
      const d = next[id].die;
      if (d && d.value === value) {
        const nv = rollDie(rng);
        next[id] = { ...next[id], die: { ...d, value: nv } };
        rerolls.push(`${id}:${d.value}→${nv}`);
      }
    }
    board = next;
    events.push({
      type: "reroll",
      turn,
      at: Date.now(),
      message: `Boss tie in casino at ${group.join(", ")} — tied dice rerolled (${rerolls.join(", ")}).`,
    });
  }
  return { board, events };
}
