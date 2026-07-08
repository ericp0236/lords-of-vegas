/**
 * Top-level command dispatcher. UI code calls `applyCommand` with the acting
 * player's id — never mutating state directly. Every command is validated;
 * failures return `{ ok: false, error }` and leave state untouched.
 */

import { appendLog, isActivePlayer, makeEvent, requirePlayer } from "./helpers";
import { applyAction, chooseReorgPlacement } from "./actions";
import {
  approveJoin,
  rejectJoin,
  requestJoin,
  replayGame,
  startGame,
} from "./setup";
import { drawCard, endTurn, runDrawSteps2to5 } from "./turn";
import {
  approveTrade,
  cancelTrade,
  executeTrade,
  executeTradeSteps,
  proposeTrade,
  rejectTrade,
} from "./trade";
import type {
  Command,
  EngineResult,
  GameState,
  LogEvent,
  Rng,
} from "./types";

function ok(state: GameState, events: LogEvent[]): EngineResult {
  return { ok: true, state, events };
}
function err(error: string): EngineResult {
  return { ok: false, error };
}

export function applyCommand(
  state: GameState,
  actorId: string,
  command: Command,
  rng: Rng = Math.random,
): EngineResult {
  try {
    switch (command.type) {
      // ------------------------------------------------------------ lobby
      case "requestJoin": {
        const r = requestJoin(state, command.request);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }
      case "approveJoin": {
        if (actorId !== state.hostId) return err("Only the host can approve joins.");
        const r = approveJoin(state, command.requestId);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }
      case "rejectJoin": {
        if (actorId !== state.hostId) return err("Only the host can decline joins.");
        const r = rejectJoin(state, command.requestId);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }
      case "leaveLobby": {
        if (state.phase !== "lobby") return err("The game has already started.");
        if (command.playerId === state.hostId) return err("The host can't leave the lobby.");
        const leaving = state.players.find((p) => p.id === command.playerId);
        if (!leaving) return err("Player not found.");
        const players = state.players
          .filter((p) => p.id !== command.playerId)
          .map((p, i) => ({ ...p, seat: i }));
        const ev = makeEvent(state, "lobby", `${leaving.name} left the table.`);
        return ok(appendLog({ ...state, players }, [ev]), [ev]);
      }
      case "startGame": {
        if (actorId !== state.hostId) return err("Only the host can start the game.");
        const r = startGame(state, rng);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }
      case "replayGame": {
        if (actorId !== state.hostId) return err("Only the host can start a rematch.");
        const r = replayGame(state, rng);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }

      // ------------------------------------------------------------- turn
      case "drawCard": {
        if (state.phase !== "playing") return err("The game isn't in progress.");
        if (!isActivePlayer(state, actorId)) return err("It's not your turn.");
        const r = drawCard(state, rng);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }
      case "action": {
        if (state.phase !== "playing") return err("The game isn't in progress.");
        if (!isActivePlayer(state, actorId)) return err("It's not your turn.");
        if (state.turn!.phase !== "actions")
          return err("Draw a property card before taking actions.");
        if (state.pendingChoice) return err("Waiting on a pending choice.");
        const r = applyAction(state, actorId, command.action, rng);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }
      case "endTurn": {
        if (state.phase !== "playing") return err("The game isn't in progress.");
        if (!isActivePlayer(state, actorId)) return err("It's not your turn.");
        const r = endTurn(state);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }

      // -------------------------------------------------- pending choices
      case "chooseRemoveDie": {
        const pc = state.pendingChoice;
        if (!pc || pc.kind !== "removeDie") return err("No die removal is pending.");
        if (pc.playerId !== actorId) return err("This choice belongs to another player.");
        const src = state.board[command.lotId];
        if (!src.die || src.die.owner !== actorId)
          return err("You don't have a die on that tile.");
        if (command.lotId === pc.targetLot)
          return err("Choose a different tile to free a die from.");
        const player = requirePlayer(state, actorId);
        let s: GameState = {
          ...state,
          pendingChoice: null,
          board: {
            ...state.board,
            [command.lotId]: { ...src, die: null },
            [pc.targetLot]: {
              ...state.board[pc.targetLot],
              die: { owner: actorId, value: pc.targetValue },
            },
          },
        };
        const ev = makeEvent(
          s,
          "choice",
          `${player.name} moves their die from ${command.lotId} to ${pc.targetLot} (value ${pc.targetValue}). The vacated tile is now unowned.`,
        );
        s = appendLog(s, [ev]);
        const events: LogEvent[] = [ev];
        if (pc.continuation.type === "drawSteps") {
          const rest = runDrawSteps2to5(s, pc.continuation.card);
          return ok(rest.state, [...events, ...rest.events]);
        }
        return ok(s, events);
      }
      case "chooseVacateLot": {
        const pc = state.pendingChoice;
        if (!pc || pc.kind !== "vacateLot") return err("No lot vacation is pending.");
        if (pc.playerId !== actorId) return err("This choice belongs to another player.");
        const src = state.board[command.lotId];
        if (src.built || src.parkingOwner !== actorId)
          return err("You don't have a lot marker there.");
        const player = requirePlayer(state, actorId);
        let s: GameState = {
          ...state,
          pendingChoice: null,
          board: {
            ...state.board,
            [command.lotId]: { ...src, parkingOwner: null },
            [pc.targetLot]: { ...state.board[pc.targetLot], parkingOwner: actorId },
          },
        };
        const ev = makeEvent(
          s,
          "choice",
          `${player.name} moves their lot marker from ${command.lotId} to ${pc.targetLot}.`,
        );
        s = appendLog(s, [ev]);
        const events: LogEvent[] = [ev];
        if (pc.continuation.type === "drawSteps") {
          const rest = runDrawSteps2to5(s, pc.continuation.card);
          return ok(rest.state, [...events, ...rest.events]);
        }
        return ok(s, events);
      }
      case "chooseReorgPlacement": {
        const pc = state.pendingChoice;
        if (!pc || pc.kind !== "reorgPlacement")
          return err("No reorganize placement is pending.");
        if (command.playerId !== actorId) return err("You can only place your own dice.");
        const r = chooseReorgPlacement(state, actorId, command.placements, rng);
        if ("error" in r) return err(r.error);
        // All placements done → resume any paused trade steps.
        if (!r.state.pendingChoice && pc.continuation.type === "tradeSteps") {
          const resumed = executeTradeSteps(r.state, pc.continuation.remaining, rng);
          return ok(resumed.state, [...r.events, ...resumed.events]);
        }
        return ok(r.state, r.events);
      }

      // ------------------------------------------------------------ trade
      case "proposeTrade": {
        const r = proposeTrade(state, actorId, command.steps);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }
      case "approveTrade": {
        const r = approveTrade(state, actorId);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }
      case "rejectTrade": {
        const r = rejectTrade(state, actorId);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }
      case "cancelTrade": {
        const r = cancelTrade(state, actorId);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }
      case "executeTrade": {
        const r = executeTrade(state, actorId, rng);
        return "error" in r ? err(r.error) : ok(r.state, r.events);
      }
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : "Unexpected engine error.");
  }
}
