/** Deterministic RNG helpers and game-state factories for engine tests. */

import { createGame } from "@/engine/setup";
import { applyCommand } from "@/engine/engine";
import type { GameState, Rng } from "@/engine/types";
import type { PlayerColor } from "@/data/playerColors";

/**
 * An rng that yields the given die faces (1-6) in order, then repeats the
 * last value. Each value v is produced by returning (v - 1) / 6.
 */
export function dieSequence(...faces: number[]): Rng {
  let i = 0;
  return () => {
    const f = faces[Math.min(i, faces.length - 1)];
    i++;
    return (f - 1) / 6;
  };
}

/** rng that always rolls the same face */
export function constantDie(face: number): Rng {
  return () => (face - 1) / 6;
}

export interface TestPlayers {
  ids: string[];
  state: GameState;
}

const COLORS: PlayerColor[] = ["red", "blue", "green", "yellow", "purple", "black"];

/** A lobby with `n` approved players; host is p0. */
export function lobbyWith(n: number): GameState {
  let state = createGame("TEST", {
    id: "p0",
    token: "t0",
    name: "Player0",
    color: COLORS[0],
  });
  for (let i = 1; i < n; i++) {
    const req = applyCommand(state, `p${i}`, {
      type: "requestJoin",
      request: { id: `p${i}`, token: `t${i}`, name: `Player${i}`, color: COLORS[i] },
    });
    if (!req.ok) throw new Error(req.error);
    state = req.state;
    const app = applyCommand(state, "p0", { type: "approveJoin", requestId: `p${i}` });
    if (!app.ok) throw new Error(app.error);
    state = app.state;
  }
  return state;
}

/** A started 3-player game with deterministic setup. */
export function startedGame(rng: Rng = Math.random): GameState {
  const lobby = lobbyWith(3);
  const r = applyCommand(lobby, "p0", { type: "startGame" }, rng);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** Force a specific player to be the active player in the actions phase. */
export function inActionsPhase(state: GameState, playerId: string): GameState {
  return {
    ...state,
    turn: {
      number: state.turn?.number ?? 1,
      activePlayerId: playerId,
      phase: "actions",
      drawnCard: null,
      gambleUsed: false,
      reorganizedLots: [],
      reorgReveal: null,
    },
  };
}

/** Give a player money (test setup only). */
export function withMoney(state: GameState, playerId: string, money: number): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, money } : p)),
  };
}

/** Place a built tile directly on the board (test setup only). */
export function withTile(
  state: GameState,
  lotId: string,
  tile: {
    color: "albion" | "sphinx" | "vega" | "tivoli" | "pioneer";
    risers?: number;
    die?: { owner: string; value: number } | null;
  },
): GameState {
  return {
    ...state,
    board: {
      ...state.board,
      [lotId]: {
        lotId,
        parkingOwner: null,
        built: true,
        color: tile.color,
        risers: tile.risers ?? 0,
        die: tile.die ?? null,
      },
    },
  };
}

/** Place a parking-lot marker directly (test setup only). */
export function withParking(state: GameState, lotId: string, owner: string): GameState {
  return {
    ...state,
    board: {
      ...state.board,
      [lotId]: { lotId, parkingOwner: owner, built: false, color: null, risers: 0, die: null },
    },
  };
}
