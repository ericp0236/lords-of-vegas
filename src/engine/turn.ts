/**
 * Turn steps 1-5: draw a property card, take over the lot, pay parking lots,
 * pay casinos, score casinos (respecting scoring-track breaks), discard.
 * Also the Game Over / 90-point end sequences.
 */

import { ALL_LOT_IDS, BOARD_LOTS } from "@/data/boardLots";
import { CASINOS, type PropertyCard } from "@/data/casinoCards";
import { advanceTrack, MAX_TRACK_INDEX, SCORE_TRACK } from "@/data/scoreTrack";
import { allCasinos, bossOf, casinoPoints, resolveBossTies } from "./casinos";
import {
  addMoney,
  appendLog,
  diceExhausted,
  makeEvent,
  markersExhausted,
  requirePlayer,
  updatePlayer,
} from "./helpers";
import { nextPlayerId } from "./setup";
import type { GameState, LogEvent, Rng } from "./types";
import type { PropertyCard as Card } from "@/data/casinoCards";

interface StepResult {
  state: GameState;
  events: LogEvent[];
}

// ---------------------------------------------------------------------------
// Step 2: pay all parking lots
// ---------------------------------------------------------------------------

export function payParkingLots(state: GameState): StepResult {
  let s = state;
  const events: LogEvent[] = [];
  const byPlayer = new Map<string, string[]>();
  for (const lotId of ALL_LOT_IDS) {
    const t = s.board[lotId];
    if (!t.built && t.parkingOwner) {
      s = addMoney(s, t.parkingOwner, 1);
      const lots = byPlayer.get(t.parkingOwner) ?? [];
      lots.push(lotId);
      byPlayer.set(t.parkingOwner, lots);
    }
  }
  if (byPlayer.size) {
    const grouped = s.players
      .filter((p) => byPlayer.has(p.id))
      .map((p) => {
        const lots = byPlayer.get(p.id)!;
        return `${p.name} +$${lots.length}M (${lots.join(", ")})`;
      });
    events.push(
      makeEvent(
        s,
        "parking-payout",
        `Parking lots pay $1M each: ${grouped.join(", ")}.`,
        { count: [...byPlayer.values()].reduce((n, lots) => n + lots.length, 0) },
      ),
    );
  }
  return { state: appendLog(s, events), events };
}

// ---------------------------------------------------------------------------
// Steps 3-4: pay & score casinos matching a card
// ---------------------------------------------------------------------------

function matchingCasinos(state: GameState, card: PropertyCard): string[][] {
  return allCasinos(state.board).filter((group) => {
    if (card.pays === "strip") {
      return group.some((id) => BOARD_LOTS[id].stripAdjacent);
    }
    return state.board[group[0]].color === card.pays;
  });
}

export function payCasinos(state: GameState, groups: string[][]): StepResult {
  let s = state;
  const events: LogEvent[] = [];
  // $1M per pip to each die owner in every matching casino.
  const totals: Record<string, number> = {};
  for (const group of groups) {
    for (const lotId of group) {
      const d = s.board[lotId].die;
      if (d) totals[d.owner] = (totals[d.owner] ?? 0) + d.value;
    }
  }
  for (const [playerId, amount] of Object.entries(totals)) {
    s = addMoney(s, playerId, amount);
  }
  if (Object.keys(totals).length) {
    events.push(
      makeEvent(
        s,
        "casino-payout",
        `Casino payout: ${Object.entries(totals)
          .map(([pid, amt]) => `${requirePlayer(s, pid).name} +$${amt}M`)
          .join(", ")}.`,
        { totals },
      ),
    );
  }
  return { state: appendLog(s, events), events };
}

export function scoreCasinos(state: GameState, groups: string[][]): StepResult {
  let s = state;
  const events: LogEvent[] = [];
  // Score each casino individually, smallest point value first.
  const ordered = groups
    .map((group) => ({ group, pts: casinoPoints(s.board, group) }))
    .sort((a, b) => a.pts - b.pts);
  for (const { group, pts } of ordered) {
    const bossId = bossOf(s.board, group);
    if (!bossId) continue; // no dice → no boss → no score
    const boss = requirePlayer(s, bossId);
    const newIndex = advanceTrack(boss.trackIndex, pts);
    const gained = SCORE_TRACK[newIndex] - SCORE_TRACK[boss.trackIndex];
    const lost = pts - gained;
    s = updatePlayer(s, bossId, { trackIndex: newIndex });
    events.push(
      makeEvent(
        s,
        "scoring",
        `${boss.name}'s ${pts}-tile casino (${group.join(", ")}) scores — marker ${newIndex === boss.trackIndex ? "stays at" : "moves to"} ${SCORE_TRACK[newIndex]}${lost > 0 ? ` (${lost} point${lost === 1 ? "" : "s"} lost at a break)` : ""}.`,
        { playerId: bossId, points: pts, track: SCORE_TRACK[newIndex] },
      ),
    );
  }
  return { state: appendLog(s, events), events };
}

// ---------------------------------------------------------------------------
// Step 1: take over the drawn lot
// ---------------------------------------------------------------------------

/**
 * Resolve step 1 for the drawn card. May return a pending choice when the
 * active player's dice or lot markers are exhausted; the remaining steps run
 * once the choice resolves (continuation).
 */
function resolveDrawStep1(
  state: GameState,
  card: Card,
  rng: Rng,
): { state: GameState; events: LogEvent[]; pending: boolean } {
  const lotId = card.lotId!;
  const pid = state.turn!.activePlayerId;
  const player = requirePlayer(state, pid);
  const tile = state.board[lotId];
  let s = state;
  const events: LogEvent[] = [];

  if (!tile.built) {
    if (!tile.parkingOwner) {
      // Gain the lot: place a lot marker.
      if (markersExhausted(s, pid)) {
        s = {
          ...s,
          pendingChoice: {
            kind: "vacateLot",
            playerId: pid,
            targetLot: lotId,
            continuation: { type: "drawSteps", card },
          },
        };
        events.push(
          makeEvent(
            s,
            "choice",
            `${player.name} has all 10 lot markers on the board and must vacate a lot to claim ${lotId}.`,
          ),
        );
        return { state: appendLog(s, events), events, pending: true };
      }
      s = {
        ...s,
        board: { ...s.board, [lotId]: { ...tile, parkingOwner: pid } },
      };
      const ev = makeEvent(s, "draw", `${player.name} places a lot marker on ${lotId}.`);
      s = appendLog(s, [ev]);
      events.push(ev);
    }
    // Already owned by anyone (including the drawer): nothing happens.
  } else {
    // Built tile.
    const die = tile.die;
    if (die && die.owner !== pid) {
      // Replace the other player's die with own die at the SAME value.
      if (diceExhausted(s, pid)) {
        s = {
          ...s,
          pendingChoice: {
            kind: "removeDie",
            playerId: pid,
            targetLot: lotId,
            targetValue: die.value,
            continuation: { type: "drawSteps", card },
          },
        };
        events.push(
          makeEvent(
            s,
            "choice",
            `${player.name} has all 12 dice on the board and must remove one to take over ${lotId}.`,
          ),
        );
        return { state: appendLog(s, events), events, pending: true };
      }
      s = {
        ...s,
        board: {
          ...s.board,
          [lotId]: { ...tile, die: { owner: pid, value: die.value } },
        },
      };
      const takeoverEv = makeEvent(
        s,
        "draw",
        `${player.name} takes over the die on ${lotId} (value ${die.value}).`,
      );
      s = appendLog(s, [takeoverEv]);
      events.push(takeoverEv);
      const tie = resolveBossTies(s, lotId, rng);
      s = appendLog({ ...s, board: tie.board }, tie.events);
      events.push(...tie.events);
    } else if (!die) {
      // Tile with no die: place own die at the printed value.
      if (diceExhausted(s, pid)) {
        s = {
          ...s,
          pendingChoice: {
            kind: "removeDie",
            playerId: pid,
            targetLot: lotId,
            targetValue: BOARD_LOTS[lotId].printedDie,
            continuation: { type: "drawSteps", card },
          },
        };
        events.push(
          makeEvent(
            s,
            "choice",
            `${player.name} has all 12 dice on the board and must remove one to claim the tile on ${lotId}.`,
          ),
        );
        return { state: appendLog(s, events), events, pending: true };
      }
      s = {
        ...s,
        board: {
          ...s.board,
          [lotId]: { ...tile, die: { owner: pid, value: BOARD_LOTS[lotId].printedDie } },
        },
      };
      const claimEv = makeEvent(
        s,
        "draw",
        `${player.name} places a die on the unclaimed tile at ${lotId} (value ${BOARD_LOTS[lotId].printedDie}).`,
      );
      s = appendLog(s, [claimEv]);
      events.push(claimEv);
      const tie = resolveBossTies(s, lotId, rng);
      s = appendLog({ ...s, board: tie.board }, tie.events);
      events.push(...tie.events);
    }
    // Own die already there: leave it alone.
  }
  return { state: s, events, pending: false };
}

// ---------------------------------------------------------------------------
// Steps 2-5 (shared by normal flow and post-choice continuation)
// ---------------------------------------------------------------------------

export function runDrawSteps2to5(state: GameState, card: Card): StepResult {
  let s = state;
  const events: LogEvent[] = [];

  const parking = payParkingLots(s);
  s = parking.state;
  events.push(...parking.events);

  const groups = matchingCasinos(s, card);
  const pay = payCasinos(s, groups);
  s = pay.state;
  events.push(...pay.events);

  const score = scoreCasinos(s, groups);
  s = score.state;
  events.push(...score.events);

  // Step 5: discard to the matching property slot.
  s = {
    ...s,
    discard: { ...s.discard, [card.pays]: [...s.discard[card.pays], card] },
    turn: { ...s.turn!, phase: "actions", drawnCard: card },
  };

  // A player reaching the top of the track ends the game after scoring.
  const jackpot = s.players.find((p) => p.trackIndex >= MAX_TRACK_INDEX);
  if (jackpot) {
    const end = finishGame(s, `${jackpot.name} reached the top of the scoring track!`);
    return { state: end.state, events: [...events, ...end.events] };
  }
  return { state: s, events };
}

// ---------------------------------------------------------------------------
// Draw command
// ---------------------------------------------------------------------------

export function drawCard(state: GameState, rng: Rng): StepResult | { error: string } {
  const turn = state.turn;
  if (!turn) return { error: "The game hasn't started." };
  if (turn.phase !== "draw") return { error: "You already drew a card this turn." };
  if (state.pendingChoice) return { error: "Waiting on a pending choice." };
  if (state.deck.length === 0) return { error: "The deck is empty." };

  const card = state.deck[0];
  let s: GameState = { ...state, deck: state.deck.slice(1) };
  const player = requirePlayer(s, turn.activePlayerId);
  const events: LogEvent[] = [];

  if (card.isGameOver) {
    events.push(
      makeEvent(s, "game-over", `${player.name} drew the GAME OVER card! The game ends immediately.`),
    );
    s = appendLog(s, events);
    const end = runGameOverSequence(s);
    return { state: end.state, events: [...events, ...end.events] };
  }

  const deckName = card.pays === "strip" ? "The Strip" : CASINOS[card.pays].name;
  events.push(
    makeEvent(s, "draw", `${player.name} drew ${card.lotId} (${deckName}).`, {
      lotId: card.lotId,
      pays: card.pays,
    }),
  );
  s = appendLog(s, events);

  const step1 = resolveDrawStep1(s, card, rng);
  if (step1.pending) {
    return { state: step1.state, events: [...events, ...step1.events] };
  }
  const rest = runDrawSteps2to5(step1.state, card);
  return { state: rest.state, events: [...events, ...step1.events, ...rest.events] };
}

// ---------------------------------------------------------------------------
// Game end
// ---------------------------------------------------------------------------

/**
 * Game Over card: no more actions or trades. Pay parking lots, then pay and
 * score every casino touching The Strip (smallest first), then decide the
 * winner (points; money tiebreak).
 */
export function runGameOverSequence(state: GameState): StepResult {
  let s: GameState = { ...state, trade: null, pendingChoice: null };
  const events: LogEvent[] = [];

  const parking = payParkingLots(s);
  s = parking.state;
  events.push(...parking.events);

  const stripGroups = allCasinos(s.board).filter((g) =>
    g.some((id) => BOARD_LOTS[id].stripAdjacent),
  );
  const pay = payCasinos(s, stripGroups);
  s = pay.state;
  events.push(...pay.events);

  const score = scoreCasinos(s, stripGroups);
  s = score.state;
  events.push(...score.events);

  const end = finishGame(s, "Final Strip payout complete.");
  return { state: end.state, events: [...events, ...end.events] };
}

export function finishGame(state: GameState, reason: string): StepResult {
  let s = state;
  const events: LogEvent[] = [];
  const best = Math.max(...s.players.map((p) => SCORE_TRACK[p.trackIndex]));
  const tied = s.players.filter((p) => SCORE_TRACK[p.trackIndex] === best);
  let winner = tied[0];
  if (tied.length > 1) {
    const bestMoney = Math.max(...tied.map((p) => p.money));
    winner = tied.find((p) => p.money === bestMoney)!;
  }
  s = { ...s, phase: "ended", winnerId: winner.id, trade: null, pendingChoice: null };
  events.push(
    makeEvent(
      s,
      "game-over",
      `${reason} ${winner.name} wins with ${best} points${tied.length > 1 ? ` (money tiebreak: $${winner.money}M)` : ""}!`,
      { winnerId: winner.id, points: best },
    ),
  );
  return { state: appendLog(s, events), events };
}

// ---------------------------------------------------------------------------
// End turn
// ---------------------------------------------------------------------------

export function endTurn(state: GameState): StepResult | { error: string } {
  const turn = state.turn;
  if (!turn) return { error: "The game hasn't started." };
  if (turn.phase !== "actions") return { error: "Draw a card before ending your turn." };
  if (state.pendingChoice) return { error: "Waiting on a pending choice." };

  const nextId = nextPlayerId(state, turn.activePlayerId);
  const next = requirePlayer(state, nextId);
  const s: GameState = {
    ...state,
    turn: {
      number: turn.number + 1,
      activePlayerId: nextId,
      phase: "draw",
      drawnCard: null,
      gambleUsed: false,
      reorganizedLots: [],
      reorgReveal: null,
    },
  };
  const events = [makeEvent(s, "draw", `${next.name}'s turn begins.`)];
  return { state: appendLog(s, events), events };
}
