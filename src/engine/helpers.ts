/** Shared engine helpers: player lookups, money, dice/marker counts, logging. */

import { ALL_LOT_IDS, type LotId } from "@/data/boardLots";
import { DICE_PER_PLAYER, LOT_MARKERS_PER_PLAYER } from "@/data/playerColors";
import type { GameState, LogEvent, LogEventType, Player } from "./types";

export function playerById(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export function requirePlayer(state: GameState, id: string): Player {
  const p = playerById(state, id);
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
}

export function updatePlayer(
  state: GameState,
  id: string,
  patch: Partial<Player>,
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

/** Add (or subtract) money; bank is unlimited, player money never negative. */
export function addMoney(state: GameState, playerId: string, amount: number): GameState {
  const p = requirePlayer(state, playerId);
  return updatePlayer(state, playerId, { money: Math.max(0, p.money + amount) });
}

export function canAfford(state: GameState, playerId: string, amount: number): boolean {
  return requirePlayer(state, playerId).money >= amount;
}

/** Number of a player's dice currently on the board. */
export function diceOnBoard(state: GameState, playerId: string): number {
  return ALL_LOT_IDS.filter((id) => state.board[id].die?.owner === playerId).length;
}

/** Lots where the player currently has a die. */
export function diceLots(state: GameState, playerId: string): LotId[] {
  return ALL_LOT_IDS.filter((id) => state.board[id].die?.owner === playerId);
}

/** True when all 12 dice are on the board (a new placement forces a removal). */
export function diceExhausted(state: GameState, playerId: string): boolean {
  return diceOnBoard(state, playerId) >= DICE_PER_PLAYER;
}

/** Number of the player's lot markers on the board (unbuilt owned lots). */
export function markersOnBoard(state: GameState, playerId: string): number {
  return ALL_LOT_IDS.filter(
    (id) => !state.board[id].built && state.board[id].parkingOwner === playerId,
  ).length;
}

/** Lots where the player has a parking-lot marker. */
export function parkingLots(state: GameState, playerId: string): LotId[] {
  return ALL_LOT_IDS.filter(
    (id) => !state.board[id].built && state.board[id].parkingOwner === playerId,
  );
}

export function markersExhausted(state: GameState, playerId: string): boolean {
  return markersOnBoard(state, playerId) >= LOT_MARKERS_PER_PLAYER;
}

export function makeEvent(
  state: GameState,
  type: LogEventType,
  message: string,
  data?: Record<string, unknown>,
): LogEvent {
  return { type, message, turn: state.turn?.number ?? 0, at: Date.now(), data };
}

const LOG_TAIL = 250;

/** Append events to the in-state log tail. */
export function appendLog(state: GameState, events: LogEvent[]): GameState {
  if (events.length === 0) return state;
  return { ...state, log: [...state.log, ...events].slice(-LOG_TAIL) };
}

export function activePlayerId(state: GameState): string | null {
  return state.turn?.activePlayerId ?? null;
}

export function isActivePlayer(state: GameState, playerId: string): boolean {
  return activePlayerId(state) === playerId;
}
