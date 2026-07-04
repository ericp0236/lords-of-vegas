/**
 * Step-6 actions: Build, Sprawl, Remodel, Reorganize, Raise, Gamble —
 * plus resolution of pending choices (dice/lot-marker exhaustion and
 * reorganize die placement).
 */

import { BOARD_LOTS, type LotId } from "@/data/boardLots";
import { CASINOS, type CasinoColor } from "@/data/casinoCards";
import {
  casinoGroup,
  casinoPoints,
  bossOf,
  resolveBossTies,
  roll2d6,
  rollDie,
} from "./casinos";
import {
  addMoney,
  appendLog,
  canAfford,
  diceExhausted,
  makeEvent,
  requirePlayer,
} from "./helpers";
import type {
  ActionCommand,
  Board,
  Continuation,
  GameState,
  LogEvent,
  Rng,
} from "./types";

export interface ActionResult {
  state: GameState;
  events: LogEvent[];
}
export type ActionOutcome = ActionResult | { error: string };

// ---------------------------------------------------------------------------
// Die placement with exhaustion handling (build/sprawl provide the vacate
// target up front, so no pending choice is needed for actions).
// ---------------------------------------------------------------------------

function placeDieWithExhaustion(
  state: GameState,
  playerId: string,
  lotId: LotId,
  value: number,
  vacateDieLot: LotId | undefined,
): { state: GameState; events: LogEvent[] } | { error: string } {
  let s = state;
  const events: LogEvent[] = [];
  const player = requirePlayer(s, playerId);

  if (diceExhausted(s, playerId)) {
    if (!vacateDieLot)
      return {
        error:
          "All 12 of your dice are on the board — choose one of your dice to move to the new tile.",
      };
    const src = s.board[vacateDieLot];
    if (!src.die || src.die.owner !== playerId)
      return { error: "You don't have a die on the chosen tile." };
    if (vacateDieLot === lotId) return { error: "Choose a different tile to free a die from." };
    s = {
      ...s,
      board: { ...s.board, [vacateDieLot]: { ...src, die: null } },
    };
    events.push(
      makeEvent(
        s,
        "action",
        `${player.name} removes their die from ${vacateDieLot} (tile stays, now unowned).`,
      ),
    );
  }
  s = {
    ...s,
    board: {
      ...s.board,
      [lotId]: { ...s.board[lotId], die: { owner: playerId, value } },
    },
  };
  return { state: s, events };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export function actionBuild(
  state: GameState,
  playerId: string,
  lotId: LotId,
  color: CasinoColor,
  vacateDieLot: LotId | undefined,
  rng: Rng,
): ActionOutcome {
  const tile = state.board[lotId];
  const lot = BOARD_LOTS[lotId];
  const player = requirePlayer(state, playerId);
  if (tile.built) return { error: "That lot already has a casino tile." };
  if (tile.parkingOwner !== playerId) return { error: "You can only build on your own parking lot." };
  if (state.tileSupply[color] < 1)
    return { error: `No ${CASINOS[color].name} tiles left in the supply.` };
  if (!canAfford(state, playerId, lot.price))
    return { error: `Building on ${lotId} costs $${lot.price}M.` };

  let s = addMoney(state, playerId, -lot.price);
  s = {
    ...s,
    tileSupply: { ...s.tileSupply, [color]: s.tileSupply[color] - 1 },
    board: {
      ...s.board,
      [lotId]: { ...s.board[lotId], built: true, color, risers: 0, parkingOwner: null },
    },
  };
  const events: LogEvent[] = [
    makeEvent(
      s,
      "action",
      `${player.name} builds a ${CASINOS[color].name} casino on ${lotId} for $${lot.price}M.`,
    ),
  ];

  const placed = placeDieWithExhaustion(s, playerId, lotId, lot.printedDie, vacateDieLot);
  if ("error" in placed) return placed;
  s = placed.state;
  events.push(...placed.events);

  const tie = resolveBossTies(s, lotId, rng);
  s = { ...s, board: tie.board };
  events.push(...tie.events);
  return { state: appendLog(s, events), events };
}

// ---------------------------------------------------------------------------
// Sprawl
// ---------------------------------------------------------------------------

export function actionSprawl(
  state: GameState,
  playerId: string,
  fromLot: LotId,
  toLot: LotId,
  vacateDieLot: LotId | undefined,
  rng: Rng,
): ActionOutcome {
  const player = requirePlayer(state, playerId);
  const from = state.board[fromLot];
  const to = state.board[toLot];
  if (!from.built) return { error: "Sprawl from one of your casinos." };
  const group = casinoGroup(state.board, fromLot);
  if (bossOf(state.board, group) !== playerId)
    return { error: "You must be the boss of the casino to sprawl." };
  const adjacent = group.some((id) => BOARD_LOTS[id].neighbors.includes(toLot));
  if (!adjacent) return { error: "The target lot must share an edge with your casino." };
  if (to.built) return { error: "The target lot already has a tile." };
  if (to.parkingOwner) return { error: "You can't sprawl onto a lot with a lot marker." };

  const color = from.color!;
  if (state.tileSupply[color] < 1)
    return { error: `No ${CASINOS[color].name} tiles left in the supply.` };

  const risers = from.risers;
  const cost = BOARD_LOTS[toLot].price * 2 + risers * 15;
  if (!canAfford(state, playerId, cost))
    return { error: `Sprawling into ${toLot} costs $${cost}M (2× price + $15M per riser).` };

  let s = addMoney(state, playerId, -cost);
  s = {
    ...s,
    tileSupply: { ...s.tileSupply, [color]: s.tileSupply[color] - 1 },
    board: {
      ...s.board,
      [toLot]: { ...s.board[toLot], built: true, color, risers, parkingOwner: null },
    },
  };
  const events: LogEvent[] = [
    makeEvent(
      s,
      "action",
      `${player.name} sprawls the ${CASINOS[color].name} casino from ${fromLot} into ${toLot} for $${cost}M.`,
    ),
  ];

  const placed = placeDieWithExhaustion(
    s,
    playerId,
    toLot,
    BOARD_LOTS[toLot].printedDie,
    vacateDieLot,
  );
  if ("error" in placed) return placed;
  s = placed.state;
  events.push(...placed.events);

  const tie = resolveBossTies(s, toLot, rng);
  s = { ...s, board: tie.board };
  events.push(...tie.events);
  return { state: appendLog(s, events), events };
}

// ---------------------------------------------------------------------------
// Remodel
// ---------------------------------------------------------------------------

export function actionRemodel(
  state: GameState,
  playerId: string,
  lotId: LotId,
  newColor: CasinoColor,
  rng: Rng,
): ActionOutcome {
  const player = requirePlayer(state, playerId);
  const group = casinoGroup(state.board, lotId);
  if (group.length === 0) return { error: "There's no casino on that lot." };
  if (bossOf(state.board, group) !== playerId)
    return { error: "You must be the boss of the casino to remodel." };
  const oldColor = state.board[lotId].color!;
  if (newColor === oldColor) return { error: "The casino is already that color." };
  // Only the top tiles change; risers are colorless.
  const spaces = group.length;
  if (state.tileSupply[newColor] < spaces)
    return { error: `Not enough ${CASINOS[newColor].name} tiles left (${spaces} needed).` };
  const cost = spaces * 5;
  if (!canAfford(state, playerId, cost))
    return { error: `Remodeling costs $${cost}M ($5M per space).` };

  let s = addMoney(state, playerId, -cost);
  const board: Board = { ...s.board };
  for (const id of group) board[id] = { ...board[id], color: newColor };
  s = {
    ...s,
    board,
    tileSupply: {
      ...s.tileSupply,
      [oldColor]: s.tileSupply[oldColor] + spaces,
      [newColor]: s.tileSupply[newColor] - spaces,
    },
  };
  const events: LogEvent[] = [
    makeEvent(
      s,
      "action",
      `${player.name} remodels the casino at ${group.join(", ")} from ${CASINOS[oldColor].name} to ${CASINOS[newColor].name} for $${cost}M.`,
    ),
  ];
  // Remodel can merge with an adjacent same-color same-height casino → ties.
  const tie = resolveBossTies(s, lotId, rng);
  s = { ...s, board: tie.board };
  events.push(...tie.events);
  return { state: appendLog(s, events), events };
}

// ---------------------------------------------------------------------------
// Raise
// ---------------------------------------------------------------------------

export function actionRaise(
  state: GameState,
  playerId: string,
  lotId: LotId,
  rng: Rng,
): ActionOutcome {
  const player = requirePlayer(state, playerId);
  const group = casinoGroup(state.board, lotId);
  if (group.length === 0) return { error: "There's no casino on that lot." };
  if (bossOf(state.board, group) !== playerId)
    return { error: "You must be the boss of the casino to raise." };
  const height = 1 + state.board[lotId].risers;
  if (height >= state.players.length)
    return { error: `Casinos can be at most ${state.players.length} tiles tall in this game.` };
  const cost = group.length * 15;
  if (!canAfford(state, playerId, cost))
    return { error: `Raising costs $${cost}M ($15M per riser, one per tile).` };

  let s = addMoney(state, playerId, -cost);
  const board: Board = { ...s.board };
  for (const id of group) board[id] = { ...board[id], risers: board[id].risers + 1 };
  s = { ...s, board };
  const events: LogEvent[] = [
    makeEvent(
      s,
      "action",
      `${player.name} raises the casino at ${group.join(", ")} to height ${height + 1} for $${cost}M.`,
    ),
  ];
  // Raising can merge it with an adjacent same-color casino of the new height.
  const tie = resolveBossTies(s, lotId, rng);
  s = { ...s, board: tie.board };
  events.push(...tie.events);
  return { state: appendLog(s, events), events };
}

// ---------------------------------------------------------------------------
// Reorganize
// ---------------------------------------------------------------------------

export function actionReorganize(
  state: GameState,
  playerId: string,
  lotId: LotId,
  rng: Rng,
  continuation: Continuation = { type: "none" },
): ActionOutcome {
  const player = requirePlayer(state, playerId);
  const group = casinoGroup(state.board, lotId);
  if (group.length === 0) return { error: "There's no casino on that lot." };
  const hasDie = group.some((id) => state.board[id].die?.owner === playerId);
  if (!hasDie) return { error: "You need at least one die in the casino to reorganize." };
  const turn = state.turn!;
  if (group.some((id) => turn.reorganizedLots.includes(id)))
    return { error: "Dice in this casino have already been reorganized this turn." };

  const totalPips = group.reduce((sum, id) => sum + (state.board[id].die?.value ?? 0), 0);
  if (!canAfford(state, playerId, totalPips))
    return { error: `Reorganizing costs $${totalPips}M ($1M per pip in the casino).` };

  let s = addMoney(state, playerId, -totalPips);
  const events: LogEvent[] = [
    makeEvent(
      s,
      "action",
      `${player.name} reorganizes the casino at ${group.join(", ")} for $${totalPips}M — all dice are rerolled.`,
    ),
  ];

  // Reroll all dice; each player's dice return to tiles they came from.
  // Players with 2+ dice choose the assignment (pending choice).
  const byPlayer: Record<string, { lots: LotId[]; newValues: number[] }> = {};
  for (const id of group) {
    const d = s.board[id].die;
    if (!d) continue;
    byPlayer[d.owner] ??= { lots: [], newValues: [] };
    byPlayer[d.owner].lots.push(id);
    byPlayer[d.owner].newValues.push(rollDie(rng));
  }

  const board: Board = { ...s.board };
  const waiting: Record<string, number[]> = {};
  const slots: Record<string, LotId[]> = {};
  for (const [pid, info] of Object.entries(byPlayer)) {
    if (info.lots.length === 1) {
      board[info.lots[0]] = {
        ...board[info.lots[0]],
        die: { owner: pid, value: info.newValues[0] },
      };
    } else {
      waiting[pid] = info.newValues;
      slots[pid] = info.lots;
      // Clear dice awaiting placement so the board shows the interim state.
      for (const id of info.lots) board[id] = { ...board[id], die: null };
    }
  }
  s = {
    ...s,
    board,
    turn: { ...turn, reorganizedLots: [...turn.reorganizedLots, ...group] },
  };

  if (Object.keys(waiting).length > 0) {
    s = {
      ...s,
      pendingChoice: {
        kind: "reorgPlacement",
        casinoLots: group,
        waiting,
        slots,
        continuation,
      },
    };
    const names = Object.keys(waiting)
      .map((pid) => requirePlayer(s, pid).name)
      .join(", ");
    events.push(
      makeEvent(
        s,
        "choice",
        `Rerolled: ${names} must choose which tiles their dice return to.`,
      ),
    );
    return { state: appendLog(s, events), events };
  }

  const tie = resolveBossTies(s, lotId, rng);
  s = { ...s, board: tie.board };
  events.push(...tie.events);
  return { state: appendLog(s, events), events };
}

/** A waiting player assigns their rerolled dice values to their original tiles. */
export function chooseReorgPlacement(
  state: GameState,
  playerId: string,
  placements: Record<LotId, number>,
  rng: Rng,
): ActionOutcome {
  const pc = state.pendingChoice;
  if (!pc || pc.kind !== "reorgPlacement") return { error: "No reorganize placement is pending." };
  const values = pc.waiting[playerId];
  const lots = pc.slots[playerId];
  if (!values) return { error: "You have no dice awaiting placement." };

  const entries = Object.entries(placements) as [LotId, number][];
  if (entries.length !== lots.length)
    return { error: `Place exactly ${lots.length} dice on your original tiles.` };
  const lotSet = new Set(lots);
  for (const [lot] of entries) {
    if (!lotSet.has(lot)) return { error: `${lot} is not one of your original tiles.` };
  }
  // Placement values must be exactly the rerolled values (as a multiset).
  const sortedGiven = entries.map(([, v]) => v).sort();
  const sortedRolled = [...values].sort();
  if (JSON.stringify(sortedGiven) !== JSON.stringify(sortedRolled))
    return { error: "Placed values must match the rerolled dice." };

  const player = requirePlayer(state, playerId);
  const board: Board = { ...state.board };
  for (const [lot, value] of entries) {
    board[lot] = { ...board[lot], die: { owner: playerId, value } };
  }
  const remainingWaiting = { ...pc.waiting };
  delete remainingWaiting[playerId];

  let s: GameState = {
    ...state,
    board,
    pendingChoice:
      Object.keys(remainingWaiting).length > 0
        ? { ...pc, waiting: remainingWaiting }
        : null,
  };
  const events: LogEvent[] = [
    makeEvent(s, "choice", `${player.name} placed their rerolled dice.`),
  ];

  if (!s.pendingChoice) {
    // Everyone placed: settle boss ties. Any continuation (e.g. remaining
    // trade steps) is resumed by the engine dispatcher.
    const tie = resolveBossTies(s, pc.casinoLots[0], rng);
    s = { ...s, board: tie.board };
    events.push(...tie.events);
  }
  return { state: appendLog(s, events), events };
}

// ---------------------------------------------------------------------------
// Gamble
// ---------------------------------------------------------------------------

export function actionGamble(
  state: GameState,
  playerId: string,
  lotId: LotId,
  wager: number,
  rng: Rng,
): ActionOutcome {
  const player = requirePlayer(state, playerId);
  const turn = state.turn!;
  if (turn.gambleUsed) return { error: "You can only gamble once per turn." };
  const group = casinoGroup(state.board, lotId);
  if (group.length === 0) return { error: "There's no casino on that lot." };
  const bossId = bossOf(state.board, group);
  if (!bossId) return { error: "That casino has no boss." };
  if (bossId === playerId) return { error: "You can't gamble at your own casino." };

  const maxBet = casinoPoints(state.board, group) * 5;
  if (!Number.isInteger(wager) || wager < 1) return { error: "Enter a whole-dollar wager." };
  if (wager > maxBet) return { error: `Maximum bet at this casino is $${maxBet}M ($5M per tile).` };
  if (!canAfford(state, playerId, wager)) return { error: "You can't bet more than you have." };

  const boss = requirePlayer(state, bossId);
  const roll = roll2d6(rng);
  let s = state;
  let outcome: string;
  if (roll === 2 || roll === 12) {
    const payout = Math.min(wager * 2, boss.money); // winnings capped by boss's money
    s = addMoney(s, bossId, -payout);
    s = addMoney(s, playerId, payout);
    outcome = `rolled ${roll} — pays DOUBLE! ${boss.name} pays $${payout}M`;
  } else if ([3, 4, 9, 10, 11].includes(roll)) {
    const payout = Math.min(wager, boss.money);
    s = addMoney(s, bossId, -payout);
    s = addMoney(s, playerId, payout);
    outcome = `rolled ${roll} — wins! ${boss.name} pays $${payout}M`;
  } else {
    s = addMoney(s, playerId, -wager);
    s = addMoney(s, bossId, wager);
    outcome = `rolled ${roll} — the House wins. ${boss.name} takes the $${wager}M bet`;
  }
  s = { ...s, turn: { ...turn, gambleUsed: true } };
  const events = [
    makeEvent(
      s,
      "action",
      `${player.name} wagers $${wager}M at ${boss.name}'s casino (${group.join(", ")}): ${outcome}.`,
      { roll, wager },
    ),
  ];
  return { state: appendLog(s, events), events };
}

// ---------------------------------------------------------------------------
// Dispatcher for action commands (used by turn step 6 and by trades)
// ---------------------------------------------------------------------------

export function applyAction(
  state: GameState,
  playerId: string,
  action: ActionCommand,
  rng: Rng,
  continuation: Continuation = { type: "none" },
): ActionOutcome {
  switch (action.type) {
    case "build":
      return actionBuild(state, playerId, action.lotId, action.color, action.vacateDieLot, rng);
    case "sprawl":
      return actionSprawl(state, playerId, action.fromLot, action.toLot, action.vacateDieLot, rng);
    case "remodel":
      return actionRemodel(state, playerId, action.lotId, action.newColor, rng);
    case "reorganize":
      return actionReorganize(state, playerId, action.lotId, rng, continuation);
    case "raise":
      return actionRaise(state, playerId, action.lotId, rng);
    case "gamble":
      return actionGamble(state, playerId, action.lotId, action.wager, rng);
  }
}
