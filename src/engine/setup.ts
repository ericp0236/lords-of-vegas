/** Game creation, lobby management, and setup per the official rulebook. */

import { ALL_LOT_IDS, BOARD_LOTS } from "@/data/boardLots";
import {
  CASINO_COLOR_KEYS,
  GAME_OVER_CARD,
  LOT_CARDS,
  TILES_PER_COLOR,
  type CasinoColor,
  type PropertyCard,
} from "@/data/casinoCards";
import type {
  Board,
  GameState,
  JoinRequest,
  LogEvent,
  Player,
  Rng,
} from "./types";
import { appendLog, makeEvent } from "./helpers";
import { rollDie, roll2d6 } from "./casinos";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

function emptyBoard(): Board {
  const board: Board = {};
  for (const lotId of ALL_LOT_IDS) {
    board[lotId] = { lotId, parkingOwner: null, built: false, color: null, risers: 0, die: null };
  }
  return board;
}

function emptyDiscard(): Record<string, PropertyCard[]> {
  return { strip: [], albion: [], sphinx: [], vega: [], tivoli: [], pioneer: [] };
}

export function createGame(
  roomCode: string,
  host: { id: string; token: string; name: string; color: Player["color"] },
): GameState {
  const hostPlayer: Player = {
    id: host.id,
    token: host.token,
    name: host.name,
    color: host.color,
    money: 0,
    trackIndex: 0,
    isHost: true,
    seat: 0,
  };
  const state: GameState = {
    schemaVersion: 1,
    roomCode,
    phase: "lobby",
    hostId: host.id,
    players: [hostPlayer],
    joinRequests: [],
    board: emptyBoard(),
    deck: [],
    discard: emptyDiscard(),
    tileSupply: Object.fromEntries(
      CASINO_COLOR_KEYS.map((c) => [c, TILES_PER_COLOR]),
    ) as Record<CasinoColor, number>,
    turn: null,
    pendingChoice: null,
    trade: null,
    winnerId: null,
    log: [],
    createdAt: Date.now(),
  };
  return appendLog(state, [
    makeEvent(state, "lobby", `${host.name} opened the table (room ${roomCode}).`),
  ]);
}

export function requestJoin(
  state: GameState,
  request: Omit<JoinRequest, "requestedAt">,
): { state: GameState; events: LogEvent[] } | { error: string } {
  if (state.phase !== "lobby") return { error: "The game has already started." };
  if (state.players.length + state.joinRequests.length >= MAX_PLAYERS)
    return { error: "The table is full." };
  const nameTaken =
    state.players.some((p) => p.name.toLowerCase() === request.name.toLowerCase()) ||
    state.joinRequests.some((r) => r.name.toLowerCase() === request.name.toLowerCase());
  if (nameTaken) return { error: "That name is already taken in this room." };
  const colorTaken =
    state.players.some((p) => p.color === request.color) ||
    state.joinRequests.some((r) => r.color === request.color);
  if (colorTaken) return { error: "That color is already taken." };
  const events = [
    makeEvent(state, "lobby", `${request.name} asked to join the table.`),
  ];
  return {
    state: appendLog(
      { ...state, joinRequests: [...state.joinRequests, { ...request, requestedAt: Date.now() }] },
      events,
    ),
    events,
  };
}

export function approveJoin(
  state: GameState,
  requestId: string,
): { state: GameState; events: LogEvent[] } | { error: string } {
  if (state.phase !== "lobby") return { error: "The game has already started." };
  const req = state.joinRequests.find((r) => r.id === requestId);
  if (!req) return { error: "Join request not found." };
  if (state.players.length >= MAX_PLAYERS) return { error: "The table is full." };
  const player: Player = {
    id: req.id,
    token: req.token,
    name: req.name,
    color: req.color,
    money: 0,
    trackIndex: 0,
    isHost: false,
    seat: state.players.length,
  };
  const events = [makeEvent(state, "lobby", `${req.name} joined the table.`)];
  return {
    state: appendLog(
      {
        ...state,
        players: [...state.players, player],
        joinRequests: state.joinRequests.filter((r) => r.id !== requestId),
      },
      events,
    ),
    events,
  };
}

export function rejectJoin(
  state: GameState,
  requestId: string,
): { state: GameState; events: LogEvent[] } | { error: string } {
  const req = state.joinRequests.find((r) => r.id === requestId);
  if (!req) return { error: "Join request not found." };
  const events = [makeEvent(state, "lobby", `${req.name}'s join request was declined.`)];
  return {
    state: appendLog(
      { ...state, joinRequests: state.joinRequests.filter((r) => r.id !== requestId) },
      events,
    ),
    events,
  };
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Rulebook deck construction: after dealing, divide the remaining cards into
 * 4 roughly equal stacks, place the Game Over card on top of the 4th stack,
 * then stack 1-3 go on top. So the Game Over card sits at the top of the
 * final quarter of the deck.
 */
export function buildDeckWithGameOver(remaining: PropertyCard[]): PropertyCard[] {
  const n = remaining.length;
  const base = Math.floor(n / 4);
  const extra = n % 4;
  // Distribute the remainder across the first stacks ("roughly equal").
  const sizes = [0, 1, 2, 3].map((i) => base + (i < extra ? 1 : 0));
  const firstThree = sizes[0] + sizes[1] + sizes[2];
  return [
    ...remaining.slice(0, firstThree),
    GAME_OVER_CARD,
    ...remaining.slice(firstThree),
  ];
}

/**
 * Turn order: each player rolls 2d6; highest goes first. Players tied for
 * highest roll one extra die (repeatedly) until the tie breaks. Turn order
 * then proceeds by seat (join order) starting from the first player.
 */
export function determineFirstPlayer(
  players: Player[],
  rng: Rng,
): { firstId: string; rolls: Record<string, number> } {
  const rolls: Record<string, number> = {};
  for (const p of players) rolls[p.id] = roll2d6(rng);
  let best = Math.max(...Object.values(rolls));
  let contenders = players.filter((p) => rolls[p.id] === best).map((p) => p.id);
  // Tied players roll 1 extra die until a single leader emerges.
  while (contenders.length > 1) {
    const extra: Record<string, number> = {};
    for (const id of contenders) extra[id] = rollDie(rng);
    best = Math.max(...Object.values(extra));
    contenders = contenders.filter((id) => extra[id] === best);
  }
  return { firstId: contenders[0], rolls };
}

function freshTileSupply(): Record<CasinoColor, number> {
  return Object.fromEntries(
    CASINO_COLOR_KEYS.map((c) => [c, TILES_PER_COLOR]),
  ) as Record<CasinoColor, number>;
}

function setupNewRound(
  state: GameState,
  rng: Rng,
): { state: GameState; events: LogEvent[] } {
  const events: LogEvent[] = [];
  let s: GameState = {
    ...state,
    phase: "playing",
    joinRequests: [],
    board: emptyBoard(),
    discard: emptyDiscard(),
    tileSupply: freshTileSupply(),
    turn: null,
    pendingChoice: null,
    trade: null,
    winnerId: null,
    log: [],
  };

  // Shuffle the 48 lot cards and deal 2 to each player.
  const shuffled = shuffle(LOT_CARDS, rng);
  const players = [...s.players].sort((a, b) => a.seat - b.seat);
  let cursor = 0;
  const board = { ...s.board };
  const discard = { ...s.discard };
  const updatedPlayers = players.map((p) => ({ ...p }));

  for (const p of updatedPlayers) {
    const dealt = [shuffled[cursor], shuffled[cursor + 1]];
    cursor += 2;
    let dieSum = 0;
    const lotNames: string[] = [];
    for (const card of dealt) {
      const lotId = card.lotId!;
      board[lotId] = { ...board[lotId], parkingOwner: p.id };
      dieSum += BOARD_LOTS[lotId].printedDie;
      lotNames.push(lotId);
      // Dealt cards are discarded to their matching property slots.
      discard[card.pays] = [...discard[card.pays], card];
    }
    p.money = 20 - dieSum;
    events.push(
      makeEvent(
        s,
        "setup",
        `${p.name} starts with parking lots ${lotNames.join(" & ")} and $${p.money}M.`,
      ),
    );
  }

  // Remaining cards form the deck with the Game Over card in the 4th quarter.
  const deck = buildDeckWithGameOver(shuffled.slice(cursor));

  // First player by 2d6 (ties: 1 extra die), then clockwise by seat.
  const { firstId, rolls } = determineFirstPlayer(updatedPlayers, rng);
  const first = updatedPlayers.find((p) => p.id === firstId)!;
  events.push(
    makeEvent(
      s,
      "setup",
      `Turn order rolls: ${updatedPlayers
        .map((p) => `${p.name} ${rolls[p.id]}`)
        .join(", ")}. ${first.name} goes first.`,
    ),
  );

  s = {
    ...s,
    players: updatedPlayers,
    board,
    discard,
    deck,
    turn: {
      number: 1,
      activePlayerId: firstId,
      phase: "draw",
      drawnCard: null,
      gambleUsed: false,
      reorganizedLots: [],
      reorgReveal: null,
    },
  };
  return { state: appendLog(s, events), events };
}

export function startGame(
  state: GameState,
  rng: Rng,
): { state: GameState; events: LogEvent[] } | { error: string } {
  if (state.phase !== "lobby") return { error: "The game has already started." };
  if (state.players.length < MIN_PLAYERS)
    return { error: `Need at least ${MIN_PLAYERS} players to start.` };
  if (state.players.length > MAX_PLAYERS)
    return { error: `At most ${MAX_PLAYERS} players.` };

  return setupNewRound(state, rng);
}

export function replayGame(
  state: GameState,
  rng: Rng,
): { state: GameState; events: LogEvent[] } | { error: string } {
  if (state.phase !== "ended") return { error: "The game hasn't ended yet." };
  if (state.players.length < MIN_PLAYERS)
    return { error: `Need at least ${MIN_PLAYERS} players to replay.` };

  const players = state.players.map((p) => ({ ...p, money: 0, trackIndex: 0 }));
  const replayEvent = makeEvent(
    { ...state, turn: null, log: [] },
    "lobby",
    `${state.players.find((p) => p.id === state.hostId)?.name ?? "The host"} started a rematch with the same players.`,
  );
  const { state: next, events } = setupNewRound({ ...state, players }, rng);
  return {
    state: { ...next, log: [replayEvent, ...next.log] },
    events: [replayEvent, ...events],
  };
}

/** Seat-order successor of the active player. */
export function nextPlayerId(state: GameState, currentId: string): string {
  const ordered = [...state.players].sort((a, b) => a.seat - b.seat);
  const idx = ordered.findIndex((p) => p.id === currentId);
  return ordered[(idx + 1) % ordered.length].id;
}
