import { describe, expect, it } from "vitest";
import { applyCommand } from "@/engine/engine";
import { buildDeckWithGameOver, MIN_PLAYERS } from "@/engine/setup";
import { BOARD_LOTS } from "@/data/boardLots";
import { LOT_CARDS } from "@/data/casinoCards";
import { lobbyWith, startedGame } from "./testUtils";

describe("lobby", () => {
  it("host approval flow adds players in seat order", () => {
    const state = lobbyWith(4);
    expect(state.players).toHaveLength(4);
    expect(state.players.map((p) => p.seat)).toEqual([0, 1, 2, 3]);
    expect(state.players[0].isHost).toBe(true);
  });

  it("blocks duplicate names and colors", () => {
    const state = lobbyWith(2);
    const dupName = applyCommand(state, "px", {
      type: "requestJoin",
      request: { id: "px", token: "tx", name: "player1", color: "black" },
    });
    expect(dupName.ok).toBe(false);
    const dupColor = applyCommand(state, "py", {
      type: "requestJoin",
      request: { id: "py", token: "ty", name: "Fresh", color: "red" },
    });
    expect(dupColor.ok).toBe(false);
  });

  it("only the host can approve or start", () => {
    let state = lobbyWith(2);
    const req = applyCommand(state, "p9", {
      type: "requestJoin",
      request: { id: "p9", token: "t9", name: "Nine", color: "black" },
    });
    if (!req.ok) throw new Error(req.error);
    state = req.state;
    expect(applyCommand(state, "p1", { type: "approveJoin", requestId: "p9" }).ok).toBe(false);
    expect(applyCommand(state, "p1", { type: "startGame" }).ok).toBe(false);
  });

  it(`requires at least ${MIN_PLAYERS} players to start`, () => {
    const state = lobbyWith(2);
    const r = applyCommand(state, "p0", { type: "startGame" });
    expect(r.ok).toBe(false);
  });
});

describe("game setup", () => {
  it("deals 2 lots per player and computes starting money as $20M − die sum", () => {
    const state = startedGame();
    for (const p of state.players) {
      const lots = Object.values(state.board).filter(
        (t) => !t.built && t.parkingOwner === p.id,
      );
      expect(lots).toHaveLength(2);
      const dieSum = lots.reduce((sum, t) => sum + BOARD_LOTS[t.lotId].printedDie, 0);
      expect(p.money).toBe(20 - dieSum);
    }
  });

  it("discards dealt cards to their property slots", () => {
    const state = startedGame();
    const discarded = Object.values(state.discard).flat();
    expect(discarded).toHaveLength(6); // 3 players × 2 cards
  });

  it("puts the Game Over card at the top of the 4th stack", () => {
    const remaining = LOT_CARDS.slice(0, 42); // simulate 3 players dealt
    const deck = buildDeckWithGameOver(remaining);
    expect(deck).toHaveLength(43);
    // 42 cards → stacks of 11,11,10,10; game over after the first three (32)
    const idx = deck.findIndex((c) => c.isGameOver);
    expect(idx).toBe(32);
  });

  it("starts with a draw-phase turn for the first player", () => {
    const state = startedGame();
    expect(state.phase).toBe("playing");
    expect(state.turn?.phase).toBe("draw");
    expect(state.players.some((p) => p.id === state.turn?.activePlayerId)).toBe(true);
  });

  it("deck + discards + dealt add up to 49 cards", () => {
    const state = startedGame();
    const discarded = Object.values(state.discard).flat().length;
    expect(state.deck.length + discarded).toBe(49 - 6 + 6); // 43 deck + 6 discard
  });
});

describe("replay", () => {
  function endedGame(): GameState {
    let state = startedGame();
    state = {
      ...state,
      phase: "ended",
      winnerId: "p0",
      turn: null,
      trade: null,
      pendingChoice: null,
      players: state.players.map((p, i) => ({
        ...p,
        trackIndex: 3 - i,
        money: 50 - i * 10,
      })),
    };
    return state;
  }

  it("only the host can replay after game over", () => {
    const state = endedGame();
    expect(applyCommand(state, "p1", { type: "replayGame" }).ok).toBe(false);
  });

  it("replays with the same players and fresh setup", () => {
    const ended = endedGame();
    const r = applyCommand(ended, "p0", { type: "replayGame" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.phase).toBe("playing");
    expect(r.state.winnerId).toBeNull();
    expect(r.state.players.map((p) => p.id)).toEqual(ended.players.map((p) => p.id));
    expect(r.state.players.every((p) => p.trackIndex === 0)).toBe(true);
    expect(r.state.turn?.phase).toBe("draw");
    expect(r.state.log[0]?.message).toMatch(/rematch/i);
    for (const p of r.state.players) {
      const lots = Object.values(r.state.board).filter(
        (t) => !t.built && t.parkingOwner === p.id,
      );
      expect(lots).toHaveLength(2);
    }
  });
});
