/**
 * Shared read-only helpers for describing what the active player is doing,
 * used by both the in-game spectator dock and the Director view. Derived
 * entirely from synced state (`turn.activity`, `pendingChoice`) — no mutation.
 */

import type { LotId } from "@/data/boardLots";
import { casinoGroup } from "@/engine/casinos";
import type { GameState, TurnActivity } from "@/engine/types";
import type { ActionTileKind } from "@/components/ui/ActionTileButton";
import {
  buildTargets,
  gambleTargets,
  raiseTargets,
  remodelTargets,
  reorganizeTargets,
  sprawlFromTargets,
  sprawlTargets,
  vacateDieCandidates,
} from "./candidates";

/** A blocking pending choice, described for anyone watching. */
export function pendingChoiceNote(state: GameState): string | null {
  const pending = state.pendingChoice;
  if (!pending) return null;
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "A player";
  switch (pending.kind) {
    case "removeDie":
      return `${name(pending.playerId)} must choose a die to move.`;
    case "vacateLot":
      return `${name(pending.playerId)} must vacate a lot marker.`;
    case "reorgPlacement":
      return "Players are placing rerolled dice.";
    default:
      return "Waiting for a player choice…";
  }
}

/** Third-person description of the active player's in-progress selection. */
export function activityHint(
  activity: TurnActivity | null | undefined,
  activeName: string,
): string | null {
  if (!activity) return null;
  switch (activity.kind) {
    case "build":
      if (activity.lotId) return `${activeName} is choosing a casino color.`;
      if (activity.color) return `${activeName} is choosing a lot to build on.`;
      return `${activeName} is choosing where to build.`;
    case "sprawl-from":
      return `${activeName} is choosing a casino to sprawl from.`;
    case "sprawl-to":
      return `${activeName} is choosing where to sprawl.`;
    case "remodel-casino":
      return `${activeName} is choosing a casino to remodel.`;
    case "remodel-color":
      return `${activeName} is choosing a new casino color.`;
    case "raise-casino":
      return `${activeName} is choosing a casino to raise.`;
    case "reorganize-casino":
      return `${activeName} is choosing a casino to reorganize.`;
    case "gamble-casino":
      return `${activeName} is choosing a casino to gamble at.`;
    case "gamble-wager":
      return `${activeName} is setting a wager.`;
    case "vacate-die":
      return `${activeName} is moving a die.`;
    default:
      return null;
  }
}

/** Short present-tense label for the chip, e.g. "building", "gambling". */
export function activityVerb(activity: TurnActivity | null | undefined): string {
  if (!activity) return "acting";
  switch (activity.kind) {
    case "build":
      return "building";
    case "sprawl-from":
    case "sprawl-to":
      return "sprawling";
    case "remodel-casino":
    case "remodel-color":
      return "remodeling";
    case "raise-casino":
      return "raising";
    case "reorganize-casino":
      return "reorganizing";
    case "gamble-casino":
    case "gamble-wager":
      return "gambling";
    case "vacate-die":
      return "moving a die";
    default:
      return "acting";
  }
}

/** Which action tile the active player is currently working in, if any. */
export function activityActionTile(
  activity: TurnActivity | null | undefined,
): ActionTileKind | null {
  if (!activity) return null;
  switch (activity.kind) {
    case "build":
      return "build";
    case "sprawl-from":
    case "sprawl-to":
      return "sprawl";
    case "remodel-casino":
    case "remodel-color":
      return "remodel";
    case "raise-casino":
      return "raise";
    case "reorganize-casino":
      return "reorganize";
    case "gamble-casino":
    case "gamble-wager":
      return "gamble";
    default:
      return null;
  }
}

/**
 * Read-only board highlights mirroring the active player's selection, computed
 * with the active player's id. `eligible` marks candidate lots; `focused`
 * marks a locked-in choice. Spectators never get clickable lots.
 */
export function spectatorHighlights(
  state: GameState,
  activePlayerId: string,
  activity: TurnActivity | null | undefined,
): { eligibleLots: Set<LotId>; focusedLots: Set<LotId> } {
  const eligible = new Set<LotId>();
  const focused = new Set<LotId>();
  if (!activity) return { eligibleLots: eligible, focusedLots: focused };

  switch (activity.kind) {
    case "build":
      for (const id of buildTargets(state, activePlayerId)) eligible.add(id);
      if (activity.lotId) focused.add(activity.lotId);
      break;
    case "sprawl-from":
      for (const id of sprawlFromTargets(state, activePlayerId)) eligible.add(id);
      break;
    case "sprawl-to":
      for (const id of sprawlTargets(state, activity.fromLot, activePlayerId)) eligible.add(id);
      for (const id of casinoGroup(state.board, activity.fromLot)) focused.add(id);
      break;
    case "remodel-casino":
      for (const id of remodelTargets(state, activePlayerId)) eligible.add(id);
      break;
    case "remodel-color":
      for (const id of casinoGroup(state.board, activity.lotId)) focused.add(id);
      break;
    case "raise-casino":
      for (const id of raiseTargets(state, activePlayerId)) eligible.add(id);
      break;
    case "reorganize-casino":
      for (const id of reorganizeTargets(state, activePlayerId)) eligible.add(id);
      break;
    case "gamble-casino":
      for (const id of gambleTargets(state, activePlayerId)) eligible.add(id);
      break;
    case "gamble-wager":
      for (const id of casinoGroup(state.board, activity.lotId)) focused.add(id);
      break;
    case "vacate-die":
      for (const id of vacateDieCandidates(state, activePlayerId)) eligible.add(id);
      break;
  }
  return { eligibleLots: eligible, focusedLots: focused };
}
