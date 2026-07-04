/**
 * Trading: any player may propose at any time; every affected player must
 * approve; the proposer can cancel while pending and clicks Execute once all
 * approvals are in. Steps execute in order; per the rulebook, if a step
 * cannot occur, the later steps do not occur (earlier steps stand).
 * Only one pending trade at a time.
 */

import {
  addMoney,
  appendLog,
  isActivePlayer,
  makeEvent,
  requirePlayer,
} from "./helpers";
import { applyAction } from "./actions";
import { resolveBossTies } from "./casinos";
import type {
  GameState,
  LogEvent,
  Rng,
  TradeState,
  TradeStep,
} from "./types";

export interface TradeResult {
  state: GameState;
  events: LogEvent[];
}
export type TradeOutcome = TradeResult | { error: string };

function participantsOf(steps: TradeStep[], proposerId: string): string[] {
  const set = new Set<string>([proposerId]);
  for (const step of steps) {
    if (step.type === "action") set.add(step.player);
    else {
      set.add(step.from);
      set.add(step.to);
    }
  }
  return [...set];
}

export function proposeTrade(
  state: GameState,
  proposerId: string,
  steps: TradeStep[],
): TradeOutcome {
  if (state.phase !== "playing") return { error: "The game isn't in progress." };
  if (state.trade) return { error: "Another trade is already pending." };
  if (state.pendingChoice) return { error: "Waiting on a pending choice." };
  if (steps.length === 0) return { error: "Add at least one step to the trade." };

  for (const step of steps) {
    if (step.type === "money") {
      if (step.amount < 1 || !Number.isInteger(step.amount))
        return { error: "Money steps need a whole positive amount." };
      if (step.from === step.to) return { error: "Money steps need two different players." };
    } else if (step.type === "lot" || step.type === "die") {
      if (step.from === step.to) return { error: "Transfer steps need two different players." };
    } else if (step.type === "action") {
      if (!isActivePlayer(state, step.player))
        return { error: "Only the active player can bundle actions into a trade." };
    }
  }

  const proposer = requirePlayer(state, proposerId);
  const trade: TradeState = {
    id: `trade-${Date.now()}`,
    proposerId,
    steps,
    participants: participantsOf(steps, proposerId),
    approvals: [proposerId],
    status: "pending",
    createdAt: Date.now(),
  };
  const s: GameState = { ...state, trade };
  const events = [
    makeEvent(
      s,
      "trade",
      `${proposer.name} proposed a trade (${steps.length} step${steps.length === 1 ? "" : "s"}) involving ${trade.participants
        .map((id) => requirePlayer(s, id).name)
        .join(", ")}.`,
    ),
  ];
  return { state: appendLog(s, events), events };
}

export function approveTrade(state: GameState, playerId: string): TradeOutcome {
  const trade = state.trade;
  if (!trade) return { error: "No trade is pending." };
  if (!trade.participants.includes(playerId))
    return { error: "You aren't part of this trade." };
  if (trade.approvals.includes(playerId)) return { error: "You already approved." };
  const approvals = [...trade.approvals, playerId];
  const ready = trade.participants.every((id) => approvals.includes(id));
  const player = requirePlayer(state, playerId);
  const s: GameState = {
    ...state,
    trade: { ...trade, approvals, status: ready ? "ready" : "pending" },
  };
  const events = [
    makeEvent(
      s,
      "trade",
      `${player.name} approved the trade.${ready ? " All parties approved — the proposer can execute." : ""}`,
    ),
  ];
  return { state: appendLog(s, events), events };
}

export function rejectTrade(state: GameState, playerId: string): TradeOutcome {
  const trade = state.trade;
  if (!trade) return { error: "No trade is pending." };
  if (!trade.participants.includes(playerId))
    return { error: "You aren't part of this trade." };
  const player = requirePlayer(state, playerId);
  const s: GameState = { ...state, trade: null };
  const events = [makeEvent(s, "trade", `${player.name} rejected the trade.`)];
  return { state: appendLog(s, events), events };
}

export function cancelTrade(state: GameState, playerId: string): TradeOutcome {
  const trade = state.trade;
  if (!trade) return { error: "No trade is pending." };
  if (trade.proposerId !== playerId) return { error: "Only the proposer can cancel." };
  const player = requirePlayer(state, playerId);
  const s: GameState = { ...state, trade: null };
  const events = [makeEvent(s, "trade", `${player.name} cancelled their trade.`)];
  return { state: appendLog(s, events), events };
}

/**
 * Execute the steps in order. A failed step logs the reason and stops the
 * remaining steps (earlier steps stand — rulebook). A reorganize action step
 * can pause execution on a pending die-placement choice; the engine resumes
 * the remaining steps via the continuation.
 */
export function executeTradeSteps(
  state: GameState,
  steps: TradeStep[],
  rng: Rng,
): TradeResult {
  let s = state;
  const events: LogEvent[] = [];
  // Create an event and append it to the state log immediately (action-step
  // outcomes append their own events internally, so we never batch-append).
  const emit = (message: string) => {
    const ev = makeEvent(s, "trade", message);
    s = appendLog(s, [ev]);
    events.push(ev);
  };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const remaining = steps.slice(i + 1);

    if (step.type === "money") {
      const from = requirePlayer(s, step.from);
      const to = requirePlayer(s, step.to);
      if (from.money < step.amount) {
        emit(
          `Trade stopped: ${from.name} doesn't have $${step.amount}M. Later steps do not occur.`,
        );
        break;
      }
      s = addMoney(s, step.from, -step.amount);
      s = addMoney(s, step.to, step.amount);
      emit(`${from.name} pays ${to.name} $${step.amount}M.`);
    } else if (step.type === "lot") {
      const from = requirePlayer(s, step.from);
      const to = requirePlayer(s, step.to);
      const tile = s.board[step.lotId];
      if (tile.built || tile.parkingOwner !== step.from) {
        emit(
          `Trade stopped: ${from.name} no longer owns lot ${step.lotId}. Later steps do not occur.`,
        );
        break;
      }
      s = {
        ...s,
        board: { ...s.board, [step.lotId]: { ...tile, parkingOwner: step.to } },
      };
      emit(`${from.name} gives lot ${step.lotId} to ${to.name}.`);
    } else if (step.type === "die") {
      const from = requirePlayer(s, step.from);
      const to = requirePlayer(s, step.to);
      const tile = s.board[step.lotId];
      if (!tile.die || tile.die.owner !== step.from) {
        emit(
          `Trade stopped: ${from.name} no longer has a die on ${step.lotId}. Later steps do not occur.`,
        );
        break;
      }
      // The new die keeps the same value it is replacing.
      s = {
        ...s,
        board: {
          ...s.board,
          [step.lotId]: { ...tile, die: { owner: step.to, value: tile.die.value } },
        },
      };
      emit(
        `${from.name}'s die on ${step.lotId} (value ${tile.die.value}) now belongs to ${to.name}.`,
      );
      const tie = resolveBossTies(s, step.lotId, rng);
      s = appendLog({ ...s, board: tie.board }, tie.events);
      events.push(...tie.events);
    } else {
      // Bundled action by the active player.
      const outcome = applyAction(s, step.player, step.action, rng, {
        type: "tradeSteps",
        remaining,
        proposerId: s.trade?.proposerId ?? step.player,
      });
      if ("error" in outcome) {
        emit(
          `Trade stopped: bundled action failed (${outcome.error}). Later steps do not occur.`,
        );
        break;
      }
      s = outcome.state; // action events already appended internally
      events.push(...outcome.events);
      if (s.pendingChoice) {
        // Execution pauses; remaining steps resume when the choice resolves.
        return { state: s, events };
      }
    }
  }
  return { state: s, events };
}

export function executeTrade(
  state: GameState,
  playerId: string,
  rng: Rng,
): TradeOutcome {
  const trade = state.trade;
  if (!trade) return { error: "No trade is pending." };
  if (trade.proposerId !== playerId) return { error: "Only the proposer can execute." };
  if (trade.status !== "ready")
    return { error: "All affected players must approve before executing." };
  if (state.pendingChoice) return { error: "Waiting on a pending choice." };

  const proposer = requirePlayer(state, playerId);
  let s: GameState = { ...state, trade: null };
  const header = makeEvent(s, "trade", `${proposer.name} executes the trade.`);
  s = appendLog(s, [header]);
  const result = executeTradeSteps(s, trade.steps, rng);
  return { state: result.state, events: [header, ...result.events] };
}
