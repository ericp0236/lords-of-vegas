import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Copy, Users, Dice5, RefreshCw, Check, X, Plus, Trash2, Eye, Crown, ArrowRight } from "lucide-react";

/* =========================================================================
   LORDS OF VEGAS — remote multiplayer web implementation
   =========================================================================
   NOTES FOR NEXT PASS:
   - LOT_DICE below is a PLACEHOLDER (round-robin filler). Swap in the real
     printed die values from the board once transcribed.
   - CARD_STRIP_LOTS picks 4 strip-adjacent lots to be "Pay the Strip" cards;
     everything else is round-robin assigned to the 5 casino colors. This is
     a documented assumption (see chat) since our 48-lot 6-player board
     doesn't match the rulebook's generic "45 + 4" card count.
   - No hidden information exists in this game (per rulebook), so every
     player view and the director view show the same full state. Director
     mode just hides action controls and cleans up the layout for recording.
   ========================================================================= */

// ---------------------------------------------------------------------------
// BOARD DATA
// ---------------------------------------------------------------------------

const CASINO_COLORS = {
  purple: { name: "Albion", hex: "#8b3fa8", dark: "#5a2870" },
  gold: { name: "Sphinx", hex: "#c9a227", dark: "#8a6e10" },
  green: { name: "Vega", hex: "#1f8a68", dark: "#125942" },
  silver: { name: "Tivoli", hex: "#9aa5b1", dark: "#5f6871" },
  brown: { name: "Pioneer", hex: "#8a5a34", dark: "#5c3b21" },
};
const CASINO_COLOR_KEYS = Object.keys(CASINO_COLORS);

const PLAYER_COLORS = {
  black: "#2b2b2b",
  blue: "#2563eb",
  green: "#16a34a",
  purple: "#9333ea",
  red: "#dc2626",
  yellow: "#eab308",
};
const PLAYER_COLOR_KEYS = Object.keys(PLAYER_COLORS);

const BLOCKS = {
  A: { rows: 2, cols: 3, stripSide: "right", gridRow: 0, gridCol: 0, prices: [9, 6, 15, 12, 9, 20] },
  B: { rows: 2, cols: 3, stripSide: "left", gridRow: 0, gridCol: 1, prices: [15, 6, 9, 20, 9, 12] },
  C: { rows: 4, cols: 3, stripSide: "right", gridRow: 1, gridCol: 0, prices: [12, 9, 20, 6, 8, 12, 6, 8, 12, 9, 6, 12] },
  D: { rows: 3, cols: 3, stripSide: "left", gridRow: 1, gridCol: 1, prices: [20, 9, 12, 8, 12, 6, 15, 6, 9] },
  E: { rows: 2, cols: 3, stripSide: "right", gridRow: 2, gridCol: 0, prices: [9, 6, 15, 12, 9, 20] },
  F: { rows: 3, cols: 3, stripSide: "left", gridRow: 2, gridCol: 1, prices: [20, 9, 12, 12, 8, 6, 15, 6, 9] },
};

// PLACEHOLDER die values (1-6 filler pattern) — replace once transcribed.
const FILLER_DICE = [4, 2, 6, 1, 5, 3];

function buildBoardLots() {
  const lots = {};
  for (const [blockId, block] of Object.entries(BLOCKS)) {
    for (let r = 0; r < block.rows; r++) {
      for (let c = 0; c < block.cols; c++) {
        const idx = r * block.cols + c;
        const lotNum = idx + 1;
        const id = `${blockId}${lotNum}`;
        const stripAdjacent = block.stripSide === "right" ? c === block.cols - 1 : c === 0;
        lots[id] = {
          id,
          block: blockId,
          row: r,
          col: c,
          price: block.prices[idx],
          dieValue: FILLER_DICE[idx % FILLER_DICE.length],
          stripAdjacent,
        };
      }
    }
  }
  return lots;
}
const BOARD_LOTS = buildBoardLots();
const ALL_LOT_IDS = Object.keys(BOARD_LOTS);

function neighborsOf(lotId) {
  const lot = BOARD_LOTS[lotId];
  const block = BLOCKS[lot.block];
  const out = [];
  const tryAdd = (r, c) => {
    if (r < 0 || c < 0 || r >= block.rows || c >= block.cols) return;
    const idx = r * block.cols + c;
    out.push(`${lot.block}${idx + 1}`);
  };
  tryAdd(lot.row - 1, lot.col);
  tryAdd(lot.row + 1, lot.col);
  tryAdd(lot.row, lot.col - 1);
  tryAdd(lot.row, lot.col + 1);
  return out;
}

// Scoring track (0 prepended as the "start" position)
const SCORE_TRACK = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 23, 26, 29, 32, 36, 40, 44, 49, 54, 60, 66, 73, 81, 90];

// ---------------------------------------------------------------------------
// PROPERTY DECK
// ---------------------------------------------------------------------------

const STRIP_CARD_LOTS = ["A6", "C12", "D7", "F7"];
const GAME_OVER_LOT = "F7";

function buildDeckTemplate() {
  const cards = [];
  let colorCursor = 0;
  for (const lotId of ALL_LOT_IDS) {
    if (STRIP_CARD_LOTS.includes(lotId)) {
      cards.push({ lotId, payColor: "strip", isGameOver: lotId === GAME_OVER_LOT });
    } else {
      cards.push({ lotId, payColor: CASINO_COLOR_KEYS[colorCursor % CASINO_COLOR_KEYS.length] });
      colorCursor++;
    }
  }
  return cards;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildShuffledDeck() {
  const template = buildDeckTemplate();
  const gameOverCard = template.find((c) => c.isGameOver);
  const rest = shuffle(template.filter((c) => !c.isGameOver));
  const insertPos = Math.ceil(rest.length * 0.75);
  rest.splice(insertPos, 0, gameOverCard);
  return rest;
}

// ---------------------------------------------------------------------------
// GAME ENGINE (pure-ish functions over room state)
// ---------------------------------------------------------------------------

function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}
function roll2d6() {
  return rollDie() + rollDie();
}

function makeEmptyBoard() {
  const tiles = {};
  for (const id of ALL_LOT_IDS) tiles[id] = { lotId: id, owner: null, built: false, color: null, risers: 0, die: null };
  return tiles;
}

function newLog(state, text) {
  const entry = { t: Date.now(), text };
  return { ...state, log: [...state.log.slice(-199), entry] };
}

function createRoom(roomCode, hostName, hostColor) {
  const hostId = crypto.randomUUID();
  return {
    version: 1,
    roomCode,
    phase: "lobby", // lobby -> playing -> ended
    players: [
      { id: hostId, name: hostName, color: hostColor, money: 0, dice: [], lots: [], score: 0, isHost: true },
    ],
    directorPresent: false,
    board: makeEmptyBoard(),
    deck: [],
    discard: { purple: [], gold: [], green: [], silver: [], brown: [], strip: [] },
    tileSupply: { purple: 9, gold: 9, green: 9, silver: 9, brown: 9 },
    turnOrder: [],
    currentTurnIdx: 0,
    turnStep: 0, // 0 = waiting to draw
    currentCard: null,
    turnFlags: { gambleUsed: false, reorganizedDice: [] },
    pendingTrade: null,
    log: [{ t: Date.now(), text: "Room created." }],
    winner: null,
  };
}

function addPlayer(state, name, color) {
  if (state.phase !== "lobby") return state;
  if (state.players.some((p) => p.color === color)) return state;
  const p = { id: crypto.randomUUID(), name, color, money: 0, dice: [], lots: [], score: 0, isHost: false };
  return newLog({ ...state, players: [...state.players, p] }, `${name} joined the table.`);
}

function playerById(state, id) {
  return state.players.find((p) => p.id === id);
}

function updatePlayer(state, id, patch) {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

function startGame(state) {
  if (state.players.length < 2) return state;
  let s = { ...state, board: makeEmptyBoard(), deck: buildShuffledDeck(), phase: "playing" };

  // deal 2 initial cards per player
  for (let pi = 0; pi < s.players.length; pi++) {
    const player = s.players[pi];
    const cards = [s.deck.shift(), s.deck.shift()];
    let dieSum = 0;
    const newLotIds = [];
    for (const card of cards) {
      const lot = BOARD_LOTS[card.lotId];
      s.board = { ...s.board, [card.lotId]: { ...s.board[card.lotId], owner: player.id } };
      dieSum += lot.dieValue;
      newLotIds.push(card.lotId);
      const pile = card.payColor === "strip" ? "strip" : card.payColor;
      s.discard = { ...s.discard, [pile]: [...s.discard[pile], card] };
    }
    const money = 20 - dieSum;
    s = updatePlayer(s, player.id, { money, lots: [...player.lots, ...newLotIds] });
  }

  // determine turn order via 2d6, rerolling ties
  let contenders = s.players.map((p) => p.id);
  let rolls = {};
  let order = [];
  while (contenders.length > 0) {
    let best = -1;
    let bestIds = [];
    for (const id of contenders) {
      const r = roll2d6();
      rolls[id] = r;
    }
    best = Math.max(...contenders.map((id) => rolls[id]));
    bestIds = contenders.filter((id) => rolls[id] === best);
    if (bestIds.length === 1) {
      order.push(bestIds[0]);
      contenders = contenders.filter((id) => id !== bestIds[0]);
    }
    // if tied, loop again only among tied (others wait); simplify: reroll all contenders until unique top emerges
  }
  s.turnOrder = order;
  s.currentTurnIdx = 0;
  s.turnStep = 0;
  s = newLog(s, `Game started. Turn order: ${order.map((id) => playerById(s, id).name).join(" → ")}.`);
  return s;
}

function currentPlayerId(state) {
  return state.turnOrder[state.currentTurnIdx];
}

function giveMoney(state, playerId, amount) {
  const p = playerById(state, playerId);
  return updatePlayer(state, playerId, { money: p.money + amount });
}
function takeMoney(state, playerId, amount) {
  const p = playerById(state, playerId);
  const paid = Math.min(p.money, amount);
  return { state: updatePlayer(state, playerId, { money: p.money - paid }), paid };
}

// Find all casinos (connected groups of same color+height lots) touching a set of seed lots,
// or all casinos on the board if seedLots is null.
function getCasinoGroups(state, seedLots = null) {
  const board = state.board;
  const visited = new Set();
  const groups = [];
  const candidates = seedLots || ALL_LOT_IDS;
  for (const startId of candidates) {
    if (visited.has(startId)) continue;
    const tile = board[startId];
    if (!tile.built) continue;
    const group = [];
    const stack = [startId];
    visited.add(startId);
    while (stack.length) {
      const id = stack.pop();
      group.push(id);
      const t = board[id];
      for (const n of neighborsOf(id)) {
        if (visited.has(n)) continue;
        const nt = board[n];
        if (nt.built && nt.color === t.color && nt.risers === t.risers) {
          visited.add(n);
          stack.push(n);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

function casinoBoss(state, group) {
  let bestVal = -1;
  let bestOwners = [];
  for (const lotId of group) {
    const d = state.board[lotId].die;
    if (!d) continue;
    if (d.value > bestVal) {
      bestVal = d.value;
      bestOwners = [d.owner];
    } else if (d.value === bestVal) {
      bestOwners.push(d.owner);
    }
  }
  return { value: bestVal, owners: [...new Set(bestOwners)] };
}

function casinoTileCount(state, group) {
  return group.reduce((sum, id) => sum + 1 + state.board[id].risers, 0);
}

// Resolve boss ties by rerolling the tied top dice, repeatedly, for a specific casino group.
function resolveTies(state, group) {
  let s = state;
  let guard = 0;
  while (guard++ < 50) {
    const { value, owners } = casinoBoss(s, group);
    if (owners.length <= 1) break;
    // reroll every die at the tied top value
    let board = { ...s.board };
    const rerolled = [];
    for (const lotId of group) {
      const d = board[lotId].die;
      if (d && d.value === value) {
        const nv = rollDie();
        board[lotId] = { ...board[lotId], die: { ...d, value: nv } };
        rerolled.push(`${lotId}→${nv}`);
      }
    }
    s = { ...s, board };
    s = newLog(s, `Boss tie reroll in casino: ${rerolled.join(", ")}.`);
  }
  return s;
}

function moveScore(player, points) {
  let remaining = points;
  let idx = SCORE_TRACK.indexOf(player.score);
  if (idx === -1) idx = 0;
  while (remaining > 0 && idx + 1 < SCORE_TRACK.length) {
    const gap = SCORE_TRACK[idx + 1] - SCORE_TRACK[idx];
    if (gap <= remaining) {
      idx++;
      remaining -= gap;
    } else break;
  }
  return SCORE_TRACK[idx];
}

// Pay & score all casinos matching a card (color-based or strip-based)
function payAndScoreForCard(state, card) {
  let s = state;
  const matches = (group) => {
    const color = s.board[group[0]].color;
    if (card.payColor === "strip") return group.some((id) => BOARD_LOTS[id].stripAdjacent);
    return color === card.payColor;
  };
  const groups = getCasinoGroups(s).filter(matches);

  // PAY step: everyone with a die in a matching casino gets $1m per pip
  for (const group of groups) {
    for (const lotId of group) {
      const d = s.board[lotId].die;
      if (d) s = giveMoney(s, d.owner, d.value);
    }
  }

  // SCORE step: boss of each casino scores tiles-count points, smallest casino first
  const withPoints = groups.map((g) => ({ group: g, pts: casinoTileCount(s, g) })).sort((a, b) => a.pts - b.pts);
  for (const { group, pts } of withPoints) {
    const { owners } = casinoBoss(s, group);
    if (owners.length !== 1) continue; // shouldn't happen, ties resolved elsewhere
    const bossId = owners[0];
    const boss = playerById(s, bossId);
    const newScore = moveScore(boss, pts);
    s = updatePlayer(s, bossId, { score: newScore });
    s = newLog(s, `${boss.name}'s casino (${group.join(",")}) scores ${pts} pts → ${newScore}.`);
  }
  return s;
}

function payParkingLots(state) {
  let s = state;
  for (const lotId of ALL_LOT_IDS) {
    const tile = s.board[lotId];
    if (!tile.built && tile.owner) {
      s = giveMoney(s, tile.owner, 1);
    }
  }
  return s;
}

// STEP 1-5: draw a card and resolve it
function drawCard(state) {
  let s = state;
  const pid = currentPlayerId(s);
  if (s.deck.length === 0) return s;
  const card = s.deck[0];
  s = { ...s, deck: s.deck.slice(1) };
  const lot = BOARD_LOTS[card.lotId];
  const tile = s.board[card.lotId];

  // Step 1: gain control
  if (!tile.built) {
    if (!tile.owner) {
      s = { ...s, board: { ...s.board, [card.lotId]: { ...tile, owner: pid } } };
      const p = playerById(s, pid);
      s = updatePlayer(s, pid, { lots: [...p.lots, card.lotId] });
    }
    // if already owned by someone (including current player), nothing changes for lot control
  } else {
    // has a built tile
    if (tile.die && tile.die.owner !== pid) {
      s = { ...s, board: { ...s.board, [card.lotId]: { ...tile, die: { owner: pid, value: tile.die.value } } } };
    } else if (!tile.die) {
      s = { ...s, board: { ...s.board, [card.lotId]: { ...tile, die: { owner: pid, value: lot.dieValue } } } };
    }
    // if tile.die.owner === pid, leave alone
    s = resolveTies(s, getCasinoGroups(s, [card.lotId])[0] || [card.lotId]);
  }

  // Step 2: pay parking lots
  s = payParkingLots(s);

  // Steps 3-4: pay & score casinos for this card
  s = payAndScoreForCard(s, card);

  // Step 5: discard
  const pile = card.payColor === "strip" ? "strip" : card.payColor;
  s = { ...s, discard: { ...s.discard, [pile]: [...s.discard[pile], card] } };

  s = { ...s, currentCard: card, turnStep: 6 };
  s = newLog(s, `${playerById(s, pid).name} drew ${card.lotId} (${card.payColor === "strip" ? "Pay the Strip" : CASINO_COLORS[card.payColor].name}).`);

  // check win
  s = checkGameEnd(s, card);
  return s;
}

function checkGameEnd(state, card) {
  let s = state;
  if (card && card.isGameOver) {
    s = { ...s, phase: "ended" };
    s = finalizeGameOver(s);
    return s;
  }
  const winner = s.players.find((p) => p.score >= 90);
  if (winner) {
    s = { ...s, phase: "ended" };
    s = finalizeWinner(s);
  }
  return s;
}

function finalizeGameOver(state) {
  let s = newLog(state, "Game Over card drawn! Final payout in progress...");
  s = payParkingLots(s);
  const stripGroups = getCasinoGroups(s).filter((g) => g.some((id) => BOARD_LOTS[id].stripAdjacent));
  for (const group of stripGroups) {
    for (const lotId of group) {
      const d = s.board[lotId].die;
      if (d) s = giveMoney(s, d.owner, d.value);
    }
  }
  const withPoints = stripGroups.map((g) => ({ group: g, pts: casinoTileCount(s, g) })).sort((a, b) => a.pts - b.pts);
  for (const { group, pts } of withPoints) {
    const { owners } = casinoBoss(s, group);
    if (owners.length !== 1) continue;
    const boss = playerById(s, owners[0]);
    const newScore = moveScore(boss, pts);
    s = updatePlayer(s, owners[0], { score: newScore });
  }
  return finalizeWinner(s);
}

function finalizeWinner(state) {
  let s = state;
  const maxScore = Math.max(...s.players.map((p) => p.score));
  const tied = s.players.filter((p) => p.score === maxScore);
  let winner = tied[0];
  if (tied.length > 1) {
    const maxMoney = Math.max(...tied.map((p) => p.money));
    winner = tied.find((p) => p.money === maxMoney);
  }
  s = { ...s, winner: winner.id };
  s = newLog(s, `🏆 ${winner.name} wins with ${winner.score} points!`);
  return s;
}

// ---- ACTIONS -----------------------------------------------------------

function canAfford(state, pid, amount) {
  return playerById(state, pid).money >= amount;
}

function giveDieToPlayer(state, pid) {
  // returns {state, die|null} — removes an available die (from pool) or forces reuse of one on board
  const p = playerById(state, pid);
  if (p.dice.length < 12) {
    return { state: updatePlayer(state, pid, { dice: [...p.dice, true] }), ok: true };
  }
  return { state, ok: false }; // caller must handle "already 12 on board" edge case (v1: block action)
}

function actionBuild(state, pid, lotId, color) {
  let s = state;
  const tile = s.board[lotId];
  const lot = BOARD_LOTS[lotId];
  if (tile.built || tile.owner !== pid) return { state, error: "You don't own an empty lot there." };
  if (s.tileSupply[color] <= 0) return { state, error: `No ${CASINO_COLORS[color].name} tiles left.` };
  if (!canAfford(s, pid, lot.price)) return { state, error: "Not enough money." };
  s = giveMoney(s, pid, -lot.price);
  s = { ...s, tileSupply: { ...s.tileSupply, [color]: s.tileSupply[color] - 1 } };
  s = { ...s, board: { ...s.board, [lotId]: { ...tile, built: true, color, risers: 0, die: { owner: pid, value: lot.dieValue }, owner: null } } };
  const p = playerById(s, pid);
  s = updatePlayer(s, pid, { lots: p.lots.filter((l) => l !== lotId) });
  s = resolveTies(s, getCasinoGroups(s, [lotId])[0] || [lotId]);
  s = newLog(s, `${p.name} built a ${CASINO_COLORS[color].name} casino on ${lotId}.`);
  return { state: s };
}

function actionSprawl(state, pid, fromLotId, toLotId) {
  let s = state;
  const fromTile = s.board[fromLotId];
  const toTile = s.board[toLotId];
  if (!fromTile.built) return { state, error: "Source is not a casino." };
  const group = getCasinoGroups(s, [fromLotId])[0];
  const boss = casinoBoss(s, group);
  if (boss.owners.length !== 1 || boss.owners[0] !== pid) return { state, error: "You must be the boss of the casino to sprawl." };
  if (!neighborsOf(fromLotId).includes(toLotId)) return { state, error: "Target lot must be adjacent." };
  if (toTile.built || toTile.owner) return { state, error: "Target lot must be unowned." };
  const color = fromTile.color;
  if (s.tileSupply[color] <= 0) return { state, error: `No ${CASINO_COLORS[color].name} tiles left.` };
  const lotPrice = BOARD_LOTS[toLotId].price;
  const risers = fromTile.risers;
  const cost = lotPrice * 2 + risers * 15;
  if (!canAfford(s, pid, cost)) return { state, error: "Not enough money." };
  s = giveMoney(s, pid, -cost);
  s = { ...s, tileSupply: { ...s.tileSupply, [color]: s.tileSupply[color] - 1 } };
  s = { ...s, board: { ...s.board, [toLotId]: { ...toTile, built: true, color, risers, die: { owner: pid, value: BOARD_LOTS[toLotId].dieValue }, owner: null } } };
  s = resolveTies(s, getCasinoGroups(s, [toLotId])[0] || [toLotId]);
  s = newLog(s, `${playerById(s, pid).name} sprawled from ${fromLotId} into ${toLotId}.`);
  return { state: s };
}

function actionRemodel(state, pid, fromLotId, newColor) {
  let s = state;
  const group = getCasinoGroups(s, [fromLotId])[0];
  if (!group) return { state, error: "No casino there." };
  const boss = casinoBoss(s, group);
  if (boss.owners.length !== 1 || boss.owners[0] !== pid) return { state, error: "You must be the boss to remodel." };
  const oldColor = s.board[fromLotId].color;
  if (newColor === oldColor) return { state, error: "Already that color." };
  if (s.tileSupply[newColor] < group.length) return { state, error: `Not enough ${CASINO_COLORS[newColor].name} tiles left.` };
  const cost = group.length * 5;
  if (!canAfford(s, pid, cost)) return { state, error: "Not enough money." };
  s = giveMoney(s, pid, -cost);
  s = { ...s, tileSupply: { ...s.tileSupply, [oldColor]: s.tileSupply[oldColor] + group.length, [newColor]: s.tileSupply[newColor] - group.length } };
  let board = { ...s.board };
  for (const lotId of group) board[lotId] = { ...board[lotId], color: newColor };
  s = { ...s, board };
  s = resolveTies(s, getCasinoGroups(s, [fromLotId])[0] || group);
  s = newLog(s, `${playerById(s, pid).name} remodeled casino at ${fromLotId} to ${CASINO_COLORS[newColor].name}.`);
  return { state: s };
}

function actionReorganize(state, pid, lotId, turnFlags) {
  let s = state;
  const group = getCasinoGroups(s, [lotId])[0];
  if (!group) return { state, error: "No casino there." };
  const hasDie = group.some((id) => s.board[id].die && s.board[id].die.owner === pid);
  if (!hasDie) return { state, error: "You need a die in this casino to reorganize." };
  const alreadyDone = group.some((id) => turnFlags.reorganizedDice.includes(id));
  if (alreadyDone) return { state, error: "This casino was already reorganized this turn." };
  let totalPips = 0;
  for (const id of group) if (s.board[id].die) totalPips += s.board[id].die.value;
  const cost = totalPips;
  if (!canAfford(s, pid, cost)) return { state, error: "Not enough money." };
  s = giveMoney(s, pid, -cost);
  let board = { ...s.board };
  for (const id of group) {
    const d = board[id].die;
    if (d) board[id] = { ...board[id], die: { ...d, value: rollDie() } };
  }
  s = { ...s, board };
  s = resolveTies(s, group);
  const newFlags = { ...turnFlags, reorganizedDice: [...turnFlags.reorganizedDice, ...group] };
  s = { ...s, turnFlags: newFlags };
  s = newLog(s, `${playerById(s, pid).name} reorganized casino at ${lotId}.`);
  return { state: s };
}

function actionRaise(state, pid, lotId, numPlayers) {
  let s = state;
  const group = getCasinoGroups(s, [lotId])[0];
  if (!group) return { state, error: "No casino there." };
  const boss = casinoBoss(s, group);
  if (boss.owners.length !== 1 || boss.owners[0] !== pid) return { state, error: "You must be the boss to raise." };
  const curHeight = 1 + s.board[lotId].risers;
  if (curHeight >= numPlayers) return { state, error: "Casino is already at max height." };
  const cost = group.length * 15;
  if (!canAfford(s, pid, cost)) return { state, error: "Not enough money." };
  s = giveMoney(s, pid, -cost);
  let board = { ...s.board };
  for (const id of group) board[id] = { ...board[id], risers: board[id].risers + 1 };
  s = { ...s, board };
  s = resolveTies(s, getCasinoGroups(s, [lotId])[0] || group);
  s = newLog(s, `${playerById(s, pid).name} raised casino at ${lotId} by 1 riser.`);
  return { state: s };
}

function actionGamble(state, pid, bossLotId, wager) {
  let s = state;
  const group = getCasinoGroups(s, [bossLotId])[0];
  if (!group) return { state, error: "No casino there." };
  const boss = casinoBoss(s, group);
  if (boss.owners.length !== 1 || boss.owners[0] === pid) return { state, error: "Pick a casino owned by another player." };
  const bossId = boss.owners[0];
  const bossP = playerById(s, bossId);
  const maxBet = casinoTileCount(s, group) * 5;
  const actualWager = Math.min(wager, maxBet, playerById(s, pid).money);
  if (actualWager <= 0) return { state, error: "Invalid wager." };
  const roll = roll2d6();
  let outcome, payout;
  if (roll === 2 || roll === 12) {
    payout = Math.min(actualWager * 2, bossP.money);
    outcome = "double win";
  } else if ([3, 4, 9, 10, 11].includes(roll)) {
    payout = Math.min(actualWager, bossP.money);
    outcome = "win";
  } else {
    payout = -actualWager;
    outcome = "lose";
  }
  s = giveMoney(s, bossId, -Math.max(payout, 0));
  s = giveMoney(s, pid, payout > 0 ? payout : -actualWager);
  s = newLog(s, `${playerById(s, pid).name} gambled $${actualWager}m at ${bossP.name}'s casino, rolled ${roll} (${outcome}).`);
  return { state: s };
}

// ---------------------------------------------------------------------------
// STORAGE / MULTIPLAYER SYNC HOOK
// ---------------------------------------------------------------------------

function useRoomSync(roomCode) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const savingRef = useRef(false);

  const key = roomCode ? `lov-room:${roomCode}` : null;

  const refresh = useCallback(async () => {
    if (!key) return;
    try {
      const res = await window.storage.get(key, true);
      if (res && res.value) setRoom(JSON.parse(res.value));
    } catch (e) {
      // key not found yet — that's fine before creation
    }
  }, [key]);

  useEffect(() => {
    if (!key) return;
    refresh();
    const iv = setInterval(refresh, 2000);
    return () => clearInterval(iv);
  }, [key, refresh]);

  const save = useCallback(
    async (newRoom) => {
      if (!key) return;
      savingRef.current = true;
      setRoom(newRoom);
      try {
        await window.storage.set(key, JSON.stringify(newRoom), true);
      } catch (e) {
        setError("Failed to save game state.");
      }
      savingRef.current = false;
    },
    [key]
  );

  // mutate: fetch freshest copy, apply fn, save
  const mutate = useCallback(
    async (fn) => {
      if (!key) return;
      let latest = room;
      try {
        const res = await window.storage.get(key, true);
        if (res && res.value) latest = JSON.parse(res.value);
      } catch (e) {
        /* use in-memory room */
      }
      const next = fn(latest);
      if (next) await save(next);
    },
    [key, room, save]
  );

  return { room, refresh, save, mutate, error };
}

// ---------------------------------------------------------------------------
// SMALL UI PRIMITIVES
// ---------------------------------------------------------------------------

function Btn({ children, onClick, variant = "primary", disabled, className = "" }) {
  const base = "px-3 py-1.5 rounded-md text-sm font-semibold tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-amber-500 hover:bg-amber-400 text-slate-900",
    ghost: "bg-transparent border border-amber-500/40 text-amber-300 hover:bg-amber-500/10",
    danger: "bg-rose-600 hover:bg-rose-500 text-white",
    subtle: "bg-slate-700 hover:bg-slate-600 text-slate-100",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function DieFace({ value, color }) {
  const dotPositions = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
  };
  return (
    <svg width="22" height="22" viewBox="0 0 100 100" className="drop-shadow">
      <rect x="4" y="4" width="92" height="92" rx="16" fill={color || "#eee"} stroke="#00000055" strokeWidth="4" />
      {(dotPositions[value] || []).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill={value && PLAYER_COLOR_KEYS.includes(Object.keys(PLAYER_COLORS).find((k) => PLAYER_COLORS[k] === color)) ? "#fff" : "#222"} />
      ))}
    </svg>
  );
}

function MoneyTag({ amount }) {
  return <span className="text-emerald-300 font-mono">${amount}m</span>;
}

// ---------------------------------------------------------------------------
// BOARD RENDERING
// ---------------------------------------------------------------------------

function LotCell({ lot, tile, players, onClick, selected }) {
  const price = lot.price;
  let content;
  const ownerColor = tile.owner ? PLAYER_COLORS[players.find((p) => p.id === tile.owner)?.color] : null;

  if (tile.built) {
    const cc = CASINO_COLORS[tile.color];
    const dieOwnerColor = tile.die ? PLAYER_COLORS[players.find((p) => p.id === tile.die.owner)?.color] : null;
    content = (
      <div className="w-full h-full flex flex-col items-center justify-center rounded" style={{ backgroundColor: cc.hex }}>
        <div className="text-[9px] font-bold text-white/90">{tile.risers > 0 ? `+${tile.risers}` : ""}</div>
        {tile.die ? <DieFace value={tile.die.value} color={dieOwnerColor} /> : <div className="text-[9px] text-white/70">no die</div>}
      </div>
    );
  } else {
    content = (
      <div className="w-full h-full flex flex-col items-center justify-center rounded bg-slate-800/70 border border-slate-600">
        <div className="text-[9px] text-amber-200/80 font-mono">{lot.id}</div>
        <div className="text-[9px] text-emerald-300 font-mono">${price}m</div>
        {tile.owner && <div className="w-2.5 h-2.5 rounded-full mt-0.5" style={{ backgroundColor: ownerColor }} />}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`aspect-square cursor-pointer ${selected ? "ring-2 ring-amber-400" : ""}`}
      title={`${lot.id} — $${price}m`}
    >
      {content}
    </div>
  );
}

function BlockGrid({ blockId, board, players, onLotClick, selectedLot }) {
  const block = BLOCKS[blockId];
  const cells = [];
  for (let r = 0; r < block.rows; r++) {
    for (let c = 0; c < block.cols; c++) {
      const idx = r * block.cols + c;
      const id = `${blockId}${idx + 1}`;
      cells.push(
        <LotCell key={id} lot={BOARD_LOTS[id]} tile={board[id]} players={players} selected={selectedLot === id} onClick={() => onLotClick(id)} />
      );
    }
  }
  return (
    <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${block.cols}, minmax(0,1fr))`, width: "9rem" }}>
      {cells}
    </div>
  );
}

function Board({ state, onLotClick, selectedLot }) {
  return (
    <div className="bg-slate-900/60 p-3 rounded-lg border border-amber-900/40">
      <div className="grid grid-cols-[9rem_2rem_9rem] gap-2 justify-center">
        <BlockGrid blockId="A" board={state.board} players={state.players} onLotClick={onLotClick} selectedLot={selectedLot} />
        <div className="flex items-center justify-center text-amber-300/50 text-[10px] font-bold tracking-widest" style={{ writingMode: "vertical-rl" }}>THE STRIP</div>
        <BlockGrid blockId="B" board={state.board} players={state.players} onLotClick={onLotClick} selectedLot={selectedLot} />

        <BlockGrid blockId="C" board={state.board} players={state.players} onLotClick={onLotClick} selectedLot={selectedLot} />
        <div className="flex items-center justify-center text-amber-300/50 text-[10px] font-bold tracking-widest" style={{ writingMode: "vertical-rl" }}>THE STRIP</div>
        <BlockGrid blockId="D" board={state.board} players={state.players} onLotClick={onLotClick} selectedLot={selectedLot} />

        <BlockGrid blockId="E" board={state.board} players={state.players} onLotClick={onLotClick} selectedLot={selectedLot} />
        <div className="flex items-center justify-center text-amber-300/50 text-[10px] font-bold tracking-widest" style={{ writingMode: "vertical-rl" }}>THE STRIP</div>
        <BlockGrid blockId="F" board={state.board} players={state.players} onLotClick={onLotClick} selectedLot={selectedLot} />
      </div>
    </div>
  );
}

function ScoreTrack({ players }) {
  return (
    <div className="bg-slate-900/60 p-3 rounded-lg border border-amber-900/40">
      <div className="text-amber-300 text-xs font-bold tracking-widest mb-2">SCORE TRACK</div>
      <div className="flex flex-wrap gap-1">
        {SCORE_TRACK.slice(1).map((v) => {
          const here = players.filter((p) => p.score === v);
          return (
            <div key={v} className="relative w-8 h-8 flex items-center justify-center rounded bg-slate-800 border border-slate-600 text-[10px] text-slate-300">
              {v}
              {here.length > 0 && (
                <div className="absolute -top-1.5 -right-1.5 flex">
                  {here.map((p) => (
                    <div key={p.id} className="w-3 h-3 rounded-full border border-white" style={{ backgroundColor: PLAYER_COLORS[p.color] }} title={p.name} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerList({ players, turnOrder, currentTurnIdx, winner }) {
  const activeId = turnOrder && turnOrder.length ? turnOrder[currentTurnIdx] : null;
  return (
    <div className="bg-slate-900/60 p-3 rounded-lg border border-amber-900/40 space-y-2">
      <div className="text-amber-300 text-xs font-bold tracking-widest mb-1">PLAYERS</div>
      {players.map((p) => (
        <div key={p.id} className={`flex items-center justify-between px-2 py-1.5 rounded ${p.id === activeId ? "bg-amber-500/10 border border-amber-500/40" : "bg-slate-800/50"}`}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAYER_COLORS[p.color] }} />
            <span className="text-slate-100 text-sm">{p.name}</span>
            {p.id === activeId && <ArrowRight size={12} className="text-amber-400" />}
            {winner === p.id && <Crown size={14} className="text-amber-400" />}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <MoneyTag amount={p.money} />
            <span className="text-slate-400">{p.dice.length}/12 dice</span>
            <span className="text-slate-400">{p.lots.length} lots</span>
            <span className="text-amber-300 font-mono">{p.score} pts</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function GambleWheel() {
  return (
    <div className="bg-slate-900/60 p-3 rounded-lg border border-amber-900/40 text-xs text-slate-300">
      <div className="text-amber-300 font-bold tracking-widest mb-1">GAMBLING FIELD</div>
      <div>Win on 3,4,9,10,11 · Double on 2,12 · House wins 5,6,7,8</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TRADE BUILDER
// ---------------------------------------------------------------------------

function TradeBuilder({ state, myId, onClose, onExecute }) {
  const [steps, setSteps] = useState([]);
  const [pendingType, setPendingType] = useState("money");
  const [from, setFrom] = useState(myId);
  const [to, setTo] = useState(state.players.find((p) => p.id !== myId)?.id || "");
  const [amount, setAmount] = useState(1);
  const [lotId, setLotId] = useState("");
  const [dieLotId, setDieLotId] = useState("");

  const addStep = () => {
    if (pendingType === "money") {
      setSteps([...steps, { type: "money", from, to, amount: Number(amount) }]);
    } else if (pendingType === "lot") {
      if (!lotId) return;
      setSteps([...steps, { type: "lot", from, to, lotId }]);
    } else if (pendingType === "die") {
      if (!dieLotId) return;
      setSteps([...steps, { type: "die", from, to, lotId: dieLotId }]);
    }
  };

  const removeStep = (i) => setSteps(steps.filter((_, idx) => idx !== i));

  const myOwnedLots = state.players.find((p) => p.id === from)?.lots || [];
  const boardDiceOfFrom = ALL_LOT_IDS.filter((id) => state.board[id].die && state.board[id].die.owner === from);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-amber-600/50 rounded-lg p-4 max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-amber-300 font-bold tracking-wide">Propose a Trade</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="space-y-2 mb-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-800 rounded px-2 py-1 text-xs text-slate-200">
              <span>
                {s.type === "money" && `${playerById(state, s.from)?.name} pays ${playerById(state, s.to)?.name} $${s.amount}m`}
                {s.type === "lot" && `${playerById(state, s.from)?.name} gives lot ${s.lotId} to ${playerById(state, s.to)?.name}`}
                {s.type === "die" && `${playerById(state, s.from)?.name} swaps die on ${s.lotId} to ${playerById(state, s.to)?.name}`}
              </span>
              <button onClick={() => removeStep(i)}><Trash2 size={14} className="text-rose-400" /></button>
            </div>
          ))}
          {steps.length === 0 && <div className="text-slate-500 text-xs italic">No steps added yet.</div>}
        </div>

        <div className="border-t border-slate-700 pt-3 space-y-2">
          <div className="flex gap-2 text-xs">
            <select className="bg-slate-800 rounded px-2 py-1 text-slate-100 flex-1" value={pendingType} onChange={(e) => setPendingType(e.target.value)}>
              <option value="money">Money</option>
              <option value="lot">Parking lot</option>
              <option value="die">Die in a casino</option>
            </select>
            <select className="bg-slate-800 rounded px-2 py-1 text-slate-100 flex-1" value={from} onChange={(e) => setFrom(e.target.value)}>
              {state.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span className="text-slate-500 self-center">→</span>
            <select className="bg-slate-800 rounded px-2 py-1 text-slate-100 flex-1" value={to} onChange={(e) => setTo(e.target.value)}>
              {state.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {pendingType === "money" && (
            <input type="number" min="0" className="bg-slate-800 rounded px-2 py-1 text-slate-100 w-full text-xs" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ($m)" />
          )}
          {pendingType === "lot" && (
            <select className="bg-slate-800 rounded px-2 py-1 text-slate-100 w-full text-xs" value={lotId} onChange={(e) => setLotId(e.target.value)}>
              <option value="">Select lot owned by {playerById(state, from)?.name}</option>
              {myOwnedLots.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          {pendingType === "die" && (
            <select className="bg-slate-800 rounded px-2 py-1 text-slate-100 w-full text-xs" value={dieLotId} onChange={(e) => setDieLotId(e.target.value)}>
              <option value="">Select die owned by {playerById(state, from)?.name}</option>
              {boardDiceOfFrom.map((l) => <option key={l} value={l}>{l} (value {state.board[l].die.value})</option>)}
            </select>
          )}
          <Btn variant="ghost" onClick={addStep} className="w-full flex items-center justify-center gap-1"><Plus size={14} /> Add step</Btn>
        </div>

        <div className="flex gap-2 mt-4">
          <Btn variant="subtle" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn variant="primary" onClick={() => onExecute(steps)} disabled={steps.length === 0} className="flex-1">Execute Trade</Btn>
        </div>
        <p className="text-[10px] text-slate-500 mt-2">All parties are trusted at the table — trades execute immediately in the order listed above. Casino tiles, risers, points, and future promises can't be traded per the rules.</p>
      </div>
    </div>
  );
}

function applyTradeSteps(state, steps) {
  let s = state;
  for (const step of steps) {
    if (step.type === "money") {
      const { state: s2, paid } = takeMoney(s, step.from, step.amount);
      s = giveMoney(s2, step.to, paid);
      s = newLog(s, `Trade: ${playerById(s, step.from).name} paid ${playerById(s, step.to).name} $${paid}m.`);
    } else if (step.type === "lot") {
      const fromP = playerById(s, step.from);
      const toP = playerById(s, step.to);
      if (!fromP.lots.includes(step.lotId)) continue;
      s = updatePlayer(s, step.from, { lots: fromP.lots.filter((l) => l !== step.lotId) });
      s = updatePlayer(s, step.to, { lots: [...playerById(s, step.to).lots, step.lotId] });
      s = { ...s, board: { ...s.board, [step.lotId]: { ...s.board[step.lotId], owner: step.to } } };
      s = newLog(s, `Trade: ${fromP.name} gave lot ${step.lotId} to ${toP.name}.`);
    } else if (step.type === "die") {
      const tile = s.board[step.lotId];
      if (!tile.die || tile.die.owner !== step.from) continue;
      s = { ...s, board: { ...s.board, [step.lotId]: { ...tile, die: { owner: step.to, value: tile.die.value } } } };
      s = resolveTies(s, getCasinoGroups(s, [step.lotId])[0] || [step.lotId]);
      s = newLog(s, `Trade: die on ${step.lotId} moved from ${playerById(s, step.from).name} to ${playerById(s, step.to).name}.`);
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// ACTION PANEL
// ---------------------------------------------------------------------------

function ActionPanel({ state, myId, selectedLot, setSelectedLot, mutateAction }) {
  const [mode, setMode] = useState(null); // 'build' | 'sprawl-from' | 'sprawl-to' | 'remodel' | 'reorganize' | 'raise' | 'gamble'
  const [sprawlFrom, setSprawlFrom] = useState(null);
  const [colorChoice, setColorChoice] = useState("purple");
  const [wager, setWager] = useState(5);
  const [err, setErr] = useState(null);

  const isMyTurn = currentPlayerId(state) === myId;
  const iAmActive = isMyTurn && state.turnStep === 6;

  const doAction = (fn) => {
    mutateAction((s) => {
      const res = fn(s);
      if (res.error) {
        setErr(res.error);
        return null;
      }
      setErr(null);
      setMode(null);
      setSelectedLot(null);
      setSprawlFrom(null);
      return res.state;
    });
  };

  useEffect(() => {
    if (!selectedLot || !mode) return;
    if (mode === "build") {
      doAction((s) => actionBuild(s, myId, selectedLot, colorChoice));
    } else if (mode === "sprawl-from") {
      setSprawlFrom(selectedLot);
      setMode("sprawl-to");
      setSelectedLot(null);
    } else if (mode === "sprawl-to" && sprawlFrom) {
      doAction((s) => actionSprawl(s, myId, sprawlFrom, selectedLot));
    } else if (mode === "remodel") {
      doAction((s) => actionRemodel(s, myId, selectedLot, colorChoice));
    } else if (mode === "reorganize") {
      doAction((s) => actionReorganize(s, myId, selectedLot, s.turnFlags));
    } else if (mode === "raise") {
      doAction((s) => actionRaise(s, myId, selectedLot, s.players.length));
    } else if (mode === "gamble") {
      doAction((s) => actionGamble(s, myId, selectedLot, Number(wager)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLot]);

  if (!iAmActive) return null;

  return (
    <div className="bg-slate-900/60 p-3 rounded-lg border border-amber-900/40 space-y-2">
      <div className="text-amber-300 text-xs font-bold tracking-widest">YOUR ACTIONS</div>
      {err && <div className="text-rose-400 text-xs">{err}</div>}
      {mode && (
        <div className="text-xs text-amber-200 bg-amber-950/40 rounded px-2 py-1">
          {mode === "build" && "Click one of your owned parking lots on the board."}
          {mode === "sprawl-from" && "Click the casino you want to sprawl from."}
          {mode === "sprawl-to" && `Sprawling from ${sprawlFrom} — click an adjacent unowned lot.`}
          {mode === "remodel" && "Click the casino you want to remodel."}
          {mode === "reorganize" && "Click a casino where you have a die."}
          {mode === "raise" && "Click the casino you want to raise."}
          {mode === "gamble" && "Click an opponent's casino to gamble at."}
        </div>
      )}
      {(mode === "build" || mode === "remodel") && (
        <select className="bg-slate-800 rounded px-2 py-1 text-slate-100 w-full text-xs" value={colorChoice} onChange={(e) => setColorChoice(e.target.value)}>
          {CASINO_COLOR_KEYS.map((c) => <option key={c} value={c}>{CASINO_COLORS[c].name} ({state.tileSupply[c]} left)</option>)}
        </select>
      )}
      {mode === "gamble" && (
        <input type="number" min="1" className="bg-slate-800 rounded px-2 py-1 text-slate-100 w-full text-xs" value={wager} onChange={(e) => setWager(e.target.value)} placeholder="Wager ($m)" />
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <Btn variant={mode === "build" ? "primary" : "ghost"} onClick={() => setMode("build")}>Build</Btn>
        <Btn variant={mode === "sprawl-from" || mode === "sprawl-to" ? "primary" : "ghost"} onClick={() => setMode("sprawl-from")}>Sprawl</Btn>
        <Btn variant={mode === "remodel" ? "primary" : "ghost"} onClick={() => setMode("remodel")}>Remodel</Btn>
        <Btn variant={mode === "reorganize" ? "primary" : "ghost"} onClick={() => setMode("reorganize")}>Reorganize</Btn>
        <Btn variant={mode === "raise" ? "primary" : "ghost"} onClick={() => setMode("raise")}>Raise</Btn>
        <Btn variant={mode === "gamble" ? "primary" : "ghost"} onClick={() => setMode("gamble")} disabled={state.turnFlags.gambleUsed}>Gamble</Btn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LOG PANEL
// ---------------------------------------------------------------------------
function LogPanel({ log }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [log]);
  return (
    <div ref={ref} className="bg-slate-900/60 p-3 rounded-lg border border-amber-900/40 h-40 overflow-y-auto text-xs text-slate-300 space-y-1">
      {log.slice().reverse().slice(0, 60).reverse().map((l, i) => <div key={i}>{l.text}</div>)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LOBBY / HOME
// ---------------------------------------------------------------------------

function Home({ onEnter }) {
  const [tab, setTab] = useState("create");
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(PLAYER_COLOR_KEYS[0]);
  const [asDirector, setAsDirector] = useState(false);

  const genCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-amber-600/40 rounded-xl p-6 shadow-2xl">
        <h1 className="text-3xl font-black text-amber-400 tracking-tight text-center mb-1">LORDS OF VEGAS</h1>
        <p className="text-slate-400 text-center text-xs mb-5 tracking-widest">REMOTE MULTIPLAYER TABLE</p>

        <div className="flex mb-4 rounded-md overflow-hidden border border-slate-700">
          <button className={`flex-1 py-2 text-sm ${tab === "create" ? "bg-amber-500 text-slate-900 font-semibold" : "bg-slate-800 text-slate-300"}`} onClick={() => setTab("create")}>Create Table</button>
          <button className={`flex-1 py-2 text-sm ${tab === "join" ? "bg-amber-500 text-slate-900 font-semibold" : "bg-slate-800 text-slate-300"}`} onClick={() => setTab("join")}>Join Table</button>
        </div>

        {tab === "join" && (
          <input className="bg-slate-800 rounded px-3 py-2 text-slate-100 w-full mb-3 text-sm tracking-widest text-center uppercase" placeholder="ROOM CODE" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} maxLength={4} />
        )}

        <label className="flex items-center gap-2 mb-3 text-xs text-slate-400">
          <input type="checkbox" checked={asDirector} onChange={(e) => setAsDirector(e.target.checked)} />
          Join as Director (spectator view for recording — no actions)
        </label>

        {!asDirector && (
          <>
            <input className="bg-slate-800 rounded px-3 py-2 text-slate-100 w-full mb-3 text-sm" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex gap-2 mb-4 justify-center">
              {PLAYER_COLOR_KEYS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 ${color === c ? "border-amber-400" : "border-transparent"}`} style={{ backgroundColor: PLAYER_COLORS[c] }} />
              ))}
            </div>
          </>
        )}

        <Btn
          className="w-full"
          onClick={() => {
            const code = tab === "create" ? genCode() : roomCode.trim();
            if (!code) return;
            onEnter({ roomCode: code, isNew: tab === "create", name: name || "Player", color, asDirector });
          }}
          disabled={tab === "join" && roomCode.trim().length === 0}
        >
          {tab === "create" ? "Create Table" : "Join Table"}
        </Btn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GAME SCREEN
// ---------------------------------------------------------------------------

function GameScreen({ roomCode, myName, myColor, myId, setMyId, isDirector }) {
  const { room, mutate } = useRoomSync(roomCode);
  const [selectedLot, setSelectedLot] = useState(null);
  const [showTrade, setShowTrade] = useState(false);
  const joinedRef = useRef(false);

  // create room if it doesn't exist yet, or join it
  useEffect(() => {
    if (!room && !joinedRef.current) {
      joinedRef.current = true;
      mutate((latest) => {
        if (latest) return null; // already exists, nothing to do — will pick up via poll
        const r = createRoom(roomCode, myName, myColor);
        setMyId(r.players[0].id);
        return r;
      });
    }
  }, [room, roomCode, myName, myColor, mutate, setMyId]);

  useEffect(() => {
    if (room && !isDirector && !myId) {
      // join as a new player if not already present under this name+color
      const existing = room.players.find((p) => p.name === myName && p.color === myColor);
      if (existing) {
        setMyId(existing.id);
      } else if (room.phase === "lobby") {
        mutate((latest) => {
          const base = latest || room;
          const already = base.players.find((p) => p.name === myName && p.color === myColor);
          if (already) {
            setMyId(already.id);
            return null;
          }
          const next = addPlayer(base, myName, myColor);
          const added = next.players.find((p) => p.name === myName && p.color === myColor);
          if (added) setMyId(added.id);
          return next;
        });
      }
    }
  }, [room, isDirector, myId, myName, myColor, mutate, setMyId]);

  if (!room) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-300">Connecting to table {roomCode}…</div>;
  }

  const copyLink = () => {
    navigator.clipboard?.writeText(roomCode);
  };

  const isMyTurn = room.phase === "playing" && currentPlayerId(room) === myId;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-amber-400 tracking-tight">LORDS OF VEGAS</h1>
            <button onClick={copyLink} className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-300 bg-slate-800 rounded px-2 py-1">
              <Copy size={12} /> Room {roomCode}
            </button>
            {isDirector && <span className="flex items-center gap-1 text-xs text-rose-300 bg-rose-950/50 rounded px-2 py-1"><Eye size={12} /> Director View</span>}
          </div>
          {room.phase === "lobby" && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Users size={14} /> {room.players.length} joined
            </div>
          )}
        </div>

        {room.phase === "lobby" && (
          <div className="bg-slate-900/60 p-4 rounded-lg border border-amber-900/40">
            <div className="text-amber-300 text-sm font-bold mb-2">Waiting for players…</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {room.players.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 bg-slate-800 rounded-full px-3 py-1 text-xs text-slate-200">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PLAYER_COLORS[p.color] }} /> {p.name}{p.isHost ? " (host)" : ""}
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-xs mb-3">Share the room code above with the other players (2–6 total). Each player opens this same link and joins with their name/color.</p>
            {!isDirector && (
              <Btn disabled={room.players.length < 2} onClick={() => mutate((latest) => startGame(latest || room))}>
                Start Game ({room.players.length}/6)
              </Btn>
            )}
          </div>
        )}

        {room.phase !== "lobby" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4">
              <div className="space-y-4">
                <Board state={room} onLotClick={(id) => setSelectedLot(id === selectedLot ? null : id)} selectedLot={selectedLot} />
                <GambleWheel />
                <ScoreTrack players={room.players} />
              </div>
              <div className="space-y-4">
                <PlayerList players={room.players} turnOrder={room.turnOrder} currentTurnIdx={room.currentTurnIdx} winner={room.winner} />

                {room.phase === "playing" && (
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-amber-900/40 text-sm">
                    <div className="text-amber-300 text-xs font-bold tracking-widest mb-1">TURN</div>
                    <div className="text-slate-200 mb-2">{playerById(room, currentPlayerId(room))?.name}'s turn</div>
                    {room.currentCard && (
                      <div className="text-xs text-slate-400 mb-2">
                        Last card: {room.currentCard.lotId} — {room.currentCard.payColor === "strip" ? "Pay the Strip" : `Pay/Score ${CASINO_COLORS[room.currentCard.payColor].name}`}
                      </div>
                    )}
                    {isMyTurn && room.turnStep !== 6 && !isDirector && (
                      <Btn className="w-full" onClick={() => mutate((latest) => drawCard(latest || room))}>Draw Property Card</Btn>
                    )}
                    {isMyTurn && room.turnStep === 6 && !isDirector && (
                      <Btn variant="subtle" className="w-full" onClick={() => mutate((latest) => {
                        const s = latest || room;
                        const nextIdx = (s.currentTurnIdx + 1) % s.turnOrder.length;
                        return newLog({ ...s, currentTurnIdx: nextIdx, turnStep: 0, currentCard: null, turnFlags: { gambleUsed: false, reorganizedDice: [] } }, `${playerById(s, s.turnOrder[nextIdx]).name}'s turn begins.`);
                      })}>End Turn</Btn>
                    )}
                  </div>
                )}

                {!isDirector && room.phase === "playing" && (
                  <ActionPanel
                    state={room}
                    myId={myId}
                    selectedLot={selectedLot}
                    setSelectedLot={setSelectedLot}
                    mutateAction={(fn) => mutate((latest) => fn(latest || room))}
                  />
                )}

                {!isDirector && room.phase === "playing" && (
                  <Btn variant="ghost" className="w-full" onClick={() => setShowTrade(true)}>Propose Trade</Btn>
                )}

                <LogPanel log={room.log} />

                {room.phase === "ended" && room.winner && (
                  <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 text-center">
                    <Crown className="mx-auto text-amber-400 mb-1" />
                    <div className="text-amber-300 font-bold">{playerById(room, room.winner)?.name} wins!</div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showTrade && (
        <TradeBuilder
          state={room}
          myId={myId}
          onClose={() => setShowTrade(false)}
          onExecute={(steps) => {
            mutate((latest) => applyTradeSteps(latest || room, steps));
            setShowTrade(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// APP ROOT
// ---------------------------------------------------------------------------

export default function App() {
  const [session, setSession] = useState(null); // { roomCode, name, color, isDirector }
  const [myId, setMyId] = useState(null);

  if (!session) {
    return (
      <Home
        onEnter={({ roomCode, name, color, asDirector }) => {
          setSession({ roomCode, name, color, isDirector: asDirector });
        }}
      />
    );
  }

  return (
    <GameScreen
      roomCode={session.roomCode}
      myName={session.name}
      myColor={session.color}
      myId={myId}
      setMyId={setMyId}
      isDirector={session.isDirector}
    />
  );
}
