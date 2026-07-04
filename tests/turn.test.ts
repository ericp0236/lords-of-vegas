import { describe, expect, it } from "vitest";
import { applyCommand } from "@/engine/engine";
import { diceOnBoard, markersOnBoard } from "@/engine/helpers";
import { GAME_OVER_CARD, LOT_CARDS } from "@/data/casinoCards";
import { SCORE_TRACK } from "@/data/scoreTrack";
import type { GameState } from "@/engine/types";
import {
  constantDie,
  startedGame,
  withMoney,
  withParking,
  withTile,
} from "./testUtils";

function cardFor(lotId: string) {
  return LOT_CARDS.find((c) => c.lotId === lotId)!;
}

/** Fresh game where p0 is on the draw phase with a rigged deck. */
function drawGame(topLot: string): GameState {
  let s = startedGame();
  s = {
    ...s,
    // Clear dealt parking lots so tests fully control the board.
    board: Object.fromEntries(
      Object.entries(s.board).map(([id, t]) => [id, { ...t, parkingOwner: null }]),
    ),
    deck: [cardFor(topLot), ...s.deck.filter((c) => c.lotId !== topLot)],
    turn: { ...s.turn!, activePlayerId: "p0", phase: "draw" },
  };
  return withMoney(s, "p0", 50);
}

describe("draw step 1 — take over the lot", () => {
  it("unowned empty lot: the drawer places a lot marker", () => {
    const r = applyCommand(drawGame("C5"), "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.board.C5.parkingOwner).toBe("p0");
    expect(r.state.turn?.phase).toBe("actions");
  });

  it("lot owned by another player: nothing happens", () => {
    let s = drawGame("C5");
    s = withParking(s, "C5", "p1");
    const r = applyCommand(s, "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.board.C5.parkingOwner).toBe("p1");
  });

  it("built tile with another player's die: drawer takes it over at the same value", () => {
    let s = drawGame("C5");
    s = withTile(s, "C5", { color: "vega", die: { owner: "p1", value: 4 } });
    const r = applyCommand(s, "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.board.C5.die).toEqual({ owner: "p0", value: 4 });
  });

  it("built tile with no die: drawer places a die at the printed value", () => {
    let s = drawGame("C5");
    s = withTile(s, "C5", { color: "vega", die: null });
    const r = applyCommand(s, "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.board.C5.die).toEqual({ owner: "p0", value: 1 }); // C5 printed die = 1
  });

  it("lot marker exhaustion: pending choice to vacate, then steps continue", () => {
    let s = drawGame("C5");
    const lots = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5"];
    for (const lot of lots) s = withParking(s, lot, "p0");
    expect(markersOnBoard(s, "p0")).toBe(10);

    const r = applyCommand(s, "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.pendingChoice?.kind).toBe("vacateLot");
    expect(r.state.turn?.phase).toBe("draw"); // steps paused

    // Can't act while pending
    expect(applyCommand(r.state, "p0", { type: "endTurn" }).ok).toBe(false);

    const choice = applyCommand(r.state, "p0", { type: "chooseVacateLot", lotId: "A1" });
    if (!choice.ok) throw new Error(choice.error);
    expect(choice.state.board.A1.parkingOwner).toBeNull();
    expect(choice.state.board.C5.parkingOwner).toBe("p0");
    expect(markersOnBoard(choice.state, "p0")).toBe(10);
    expect(choice.state.turn?.phase).toBe("actions"); // steps 2-5 ran
  });

  it("dice exhaustion on takeover: pending removal keeps the count at 12", () => {
    let s = drawGame("C5");
    s = withTile(s, "C5", { color: "vega", die: { owner: "p1", value: 4 } });
    const lots = ["A1", "A2", "A3", "A4", "A5", "A6", "B1", "B2", "B3", "B4", "B5", "B6"];
    for (const lot of lots) s = withTile(s, lot, { color: "sphinx", die: { owner: "p0", value: 2 } });
    expect(diceOnBoard(s, "p0")).toBe(12);

    const r = applyCommand(s, "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.pendingChoice?.kind).toBe("removeDie");

    const choice = applyCommand(r.state, "p0", { type: "chooseRemoveDie", lotId: "A1" });
    if (!choice.ok) throw new Error(choice.error);
    expect(choice.state.board.A1.die).toBeNull();
    expect(choice.state.board.A1.built).toBe(true);
    expect(choice.state.board.C5.die).toEqual({ owner: "p0", value: 4 });
    expect(diceOnBoard(choice.state, "p0")).toBe(12);
    expect(choice.state.turn?.phase).toBe("actions");
  });
});

describe("draw steps 2-4 — payouts and scoring", () => {
  it("pays $1M per parking lot to their owners", () => {
    let s = drawGame("C5");
    s = withParking(s, "A1", "p1");
    s = withParking(s, "A2", "p1");
    s = withParking(s, "B1", "p2");
    const before1 = s.players.find((p) => p.id === "p1")!.money;
    const before2 = s.players.find((p) => p.id === "p2")!.money;
    const r = applyCommand(s, "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.players.find((p) => p.id === "p1")!.money).toBe(before1 + 2);
    expect(r.state.players.find((p) => p.id === "p2")!.money).toBe(before2 + 1);
  });

  it("pays casinos of the drawn color $1M per pip and scores the boss", () => {
    // C5's card pays Vega
    let s = drawGame("C5");
    s = withTile(s, "A1", { color: "vega", die: { owner: "p1", value: 5 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p2", value: 3 } });
    s = withTile(s, "B1", { color: "sphinx", die: { owner: "p2", value: 6 } }); // not paid
    const before1 = s.players.find((p) => p.id === "p1")!.money;
    const before2 = s.players.find((p) => p.id === "p2")!.money;
    const r = applyCommand(s, "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.players.find((p) => p.id === "p1")!.money).toBe(before1 + 5);
    expect(r.state.players.find((p) => p.id === "p2")!.money).toBe(before2 + 3);
    // p1 is boss of a 2-tile casino → 2 points
    expect(SCORE_TRACK[r.state.players.find((p) => p.id === "p1")!.trackIndex]).toBe(2);
    expect(r.state.players.find((p) => p.id === "p2")!.trackIndex).toBe(0);
  });

  it("a strip card pays all strip-adjacent casinos", () => {
    // A6 is a Strip card
    let s = drawGame("A6");
    s = withTile(s, "C3", { color: "vega", die: { owner: "p1", value: 4 } }); // strip-adjacent
    s = withTile(s, "C4", { color: "sphinx", die: { owner: "p2", value: 2 } }); // interior
    const before1 = s.players.find((p) => p.id === "p1")!.money;
    const before2 = s.players.find((p) => p.id === "p2")!.money;
    const r = applyCommand(s, "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.players.find((p) => p.id === "p1")!.money).toBe(before1 + 4);
    expect(r.state.players.find((p) => p.id === "p2")!.money).toBe(before2 + 0);
  });

  it("casino without dice pays and scores nobody", () => {
    let s = drawGame("C5");
    s = withTile(s, "A1", { color: "vega", die: null });
    const r = applyCommand(s, "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.players.every((p) => p.trackIndex === 0)).toBe(true);
  });

  it("discards the card to its property slot", () => {
    const r = applyCommand(drawGame("C5"), "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.discard.vega.some((c) => c.lotId === "C5")).toBe(true);
  });
});

describe("turn flow", () => {
  it("draw then end turn advances to the next seat", () => {
    const r = applyCommand(drawGame("C5"), "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    const end = applyCommand(r.state, "p0", { type: "endTurn" });
    if (!end.ok) throw new Error(end.error);
    expect(end.state.turn?.activePlayerId).toBe("p1");
    expect(end.state.turn?.phase).toBe("draw");
    expect(end.state.turn?.number).toBe(r.state.turn!.number + 1);
  });

  it("cannot end the turn before drawing, or draw twice", () => {
    const s = drawGame("C5");
    expect(applyCommand(s, "p0", { type: "endTurn" }).ok).toBe(false);
    const r = applyCommand(s, "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(applyCommand(r.state, "p0", { type: "drawCard" }).ok).toBe(false);
  });

  it("rejects commands from non-active players", () => {
    const s = drawGame("C5");
    expect(applyCommand(s, "p1", { type: "drawCard" }).ok).toBe(false);
  });
});

describe("game over", () => {
  it("game over card: pays parking, pays & scores strip casinos, picks a winner", () => {
    let s = drawGame("C5");
    s = { ...s, deck: [GAME_OVER_CARD, ...s.deck] };
    s = withParking(s, "A1", "p1");
    s = withTile(s, "C3", { color: "vega", die: { owner: "p1", value: 4 } }); // strip casino
    s = withTile(s, "C6", { color: "vega", die: { owner: "p2", value: 6 } }); // adjacent below, p2 boss
    const r = applyCommand(s, "p0", { type: "drawCard" }, constantDie(1));
    if (!r.ok) throw new Error(r.error);
    expect(r.state.phase).toBe("ended");
    // p2 bossed the 2-tile strip casino → 2 points → winner
    expect(r.state.winnerId).toBe("p2");
    expect(SCORE_TRACK[r.state.players.find((p) => p.id === "p2")!.trackIndex]).toBe(2);
  });

  it("money breaks a points tie", () => {
    let s = drawGame("C5");
    s = { ...s, deck: [GAME_OVER_CARD, ...s.deck] };
    s = withMoney(s, "p1", 99);
    s = withMoney(s, "p2", 3);
    const r = applyCommand(s, "p0", { type: "drawCard" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.phase).toBe("ended");
    expect(r.state.winnerId).toBe("p1"); // all 0 points; p1 richest
  });
});
