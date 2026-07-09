/**
 * Turn activity sync: the active player mirrors their in-progress action
 * selection so spectators see what they're doing before it commits. Pure UI
 * sync — no rule validation, no log events, no board changes.
 */

import { isActivePlayer } from "./helpers";
import type { GameState, LogEvent, TurnActivity } from "./types";

interface ActivityOutcome {
  state: GameState;
  events: LogEvent[];
}

function sameActivity(a: TurnActivity | null | undefined, b: TurnActivity): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b);
}

export function setTurnActivity(
  state: GameState,
  playerId: string,
  activity: TurnActivity,
): ActivityOutcome | { error: string } {
  if (state.phase !== "playing") return { error: "The game isn't in progress." };
  if (!state.turn) return { error: "The game hasn't started." };
  if (!isActivePlayer(state, playerId)) return { error: "It's not your turn." };
  if (sameActivity(state.turn.activity, activity)) return { state, events: [] };
  return {
    state: { ...state, turn: { ...state.turn, activity } },
    events: [],
  };
}

/** Drop any mirrored activity once a real command commits. */
export function clearTurnActivity(state: GameState): GameState {
  if (!state.turn || state.turn.activity == null) return state;
  return { ...state, turn: { ...state.turn, activity: null } };
}
