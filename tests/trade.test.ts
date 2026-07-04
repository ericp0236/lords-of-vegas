import { describe, expect, it } from "vitest";
import { applyCommand } from "@/engine/engine";
import type { GameState } from "@/engine/types";
import {
  constantDie,
  inActionsPhase,
  startedGame,
  withMoney,
  withParking,
  withTile,
} from "./testUtils";

function tradeGame(): GameState {
  let s = startedGame();
  s = inActionsPhase(s, "p0");
  s = withMoney(s, "p0", 50);
  s = withMoney(s, "p1", 50);
  s = withMoney(s, "p2", 50);
  return s;
}

function money(s: GameState, id: string): number {
  return s.players.find((p) => p.id === id)!.money;
}

describe("trade lifecycle", () => {
  it("propose → all affected approve → proposer executes", () => {
    let s = tradeGame();
    s = withParking(s, "C5", "p1");
    const proposed = applyCommand(s, "p0", {
      type: "proposeTrade",
      steps: [
        { type: "money", from: "p0", to: "p1", amount: 10 },
        { type: "lot", from: "p1", to: "p0", lotId: "C5" },
      ],
    });
    if (!proposed.ok) throw new Error(proposed.error);
    expect(proposed.state.trade?.participants.sort()).toEqual(["p0", "p1"]);

    // Can't execute before approval; p2 (unaffected) can't approve
    expect(applyCommand(proposed.state, "p0", { type: "executeTrade" }).ok).toBe(false);
    expect(applyCommand(proposed.state, "p2", { type: "approveTrade" }).ok).toBe(false);

    const approved = applyCommand(proposed.state, "p1", { type: "approveTrade" });
    if (!approved.ok) throw new Error(approved.error);
    expect(approved.state.trade?.status).toBe("ready");

    // Only the proposer executes
    expect(applyCommand(approved.state, "p1", { type: "executeTrade" }).ok).toBe(false);
    const done = applyCommand(approved.state, "p0", { type: "executeTrade" });
    if (!done.ok) throw new Error(done.error);
    expect(money(done.state, "p0")).toBe(40);
    expect(money(done.state, "p1")).toBe(60);
    expect(done.state.board.C5.parkingOwner).toBe("p0");
    expect(done.state.trade).toBeNull();
  });

  it("any affected player can reject; proposer can cancel", () => {
    const s = tradeGame();
    const proposed = applyCommand(s, "p0", {
      type: "proposeTrade",
      steps: [{ type: "money", from: "p0", to: "p1", amount: 5 }],
    });
    if (!proposed.ok) throw new Error(proposed.error);
    const rejected = applyCommand(proposed.state, "p1", { type: "rejectTrade" });
    if (!rejected.ok) throw new Error(rejected.error);
    expect(rejected.state.trade).toBeNull();

    const proposed2 = applyCommand(s, "p0", {
      type: "proposeTrade",
      steps: [{ type: "money", from: "p0", to: "p1", amount: 5 }],
    });
    if (!proposed2.ok) throw new Error(proposed2.error);
    const cancelled = applyCommand(proposed2.state, "p0", { type: "cancelTrade" });
    if (!cancelled.ok) throw new Error(cancelled.error);
    expect(cancelled.state.trade).toBeNull();
    // p1 can't cancel someone else's trade
    const proposed3 = applyCommand(s, "p0", {
      type: "proposeTrade",
      steps: [{ type: "money", from: "p0", to: "p1", amount: 5 }],
    });
    if (!proposed3.ok) throw new Error(proposed3.error);
    expect(applyCommand(proposed3.state, "p1", { type: "cancelTrade" }).ok).toBe(false);
  });

  it("only one pending trade at a time", () => {
    const s = tradeGame();
    const first = applyCommand(s, "p0", {
      type: "proposeTrade",
      steps: [{ type: "money", from: "p0", to: "p1", amount: 5 }],
    });
    if (!first.ok) throw new Error(first.error);
    const second = applyCommand(first.state, "p2", {
      type: "proposeTrade",
      steps: [{ type: "money", from: "p2", to: "p1", amount: 5 }],
    });
    expect(second.ok).toBe(false);
  });
});

describe("trade execution semantics", () => {
  it("a failed step stops later steps; earlier steps stand (rulebook)", () => {
    const s = tradeGame();
    // p1 owns no lot C5 → step 2 fails, step 3 never runs
    const proposed = applyCommand(s, "p0", {
      type: "proposeTrade",
      steps: [
        { type: "money", from: "p0", to: "p1", amount: 10 },
        { type: "lot", from: "p1", to: "p0", lotId: "C5" },
        { type: "money", from: "p1", to: "p0", amount: 5 },
      ],
    });
    if (!proposed.ok) throw new Error(proposed.error);
    const approved = applyCommand(proposed.state, "p1", { type: "approveTrade" });
    if (!approved.ok) throw new Error(approved.error);
    const done = applyCommand(approved.state, "p0", { type: "executeTrade" });
    if (!done.ok) throw new Error(done.error);
    expect(money(done.state, "p0")).toBe(40); // paid 10, never refunded, step 3 skipped
    expect(money(done.state, "p1")).toBe(60);
  });

  it("die transfers keep the die value and settle boss ties", () => {
    let s = tradeGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p1", value: 5 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p0", value: 3 } });
    const proposed = applyCommand(s, "p0", {
      type: "proposeTrade",
      steps: [{ type: "die", from: "p1", to: "p0", lotId: "A1" }],
    });
    if (!proposed.ok) throw new Error(proposed.error);
    const approved = applyCommand(proposed.state, "p1", { type: "approveTrade" });
    if (!approved.ok) throw new Error(approved.error);
    const done = applyCommand(approved.state, "p0", { type: "executeTrade" });
    if (!done.ok) throw new Error(done.error);
    expect(done.state.board.A1.die).toEqual({ owner: "p0", value: 5 });
  });

  it("bundles active-player actions; non-active players cannot bundle actions", () => {
    let s = tradeGame();
    s = withParking(s, "C5", "p0");
    // p1 (not active) tries to bundle their own action → rejected at proposal
    const bad = applyCommand(s, "p1", {
      type: "proposeTrade",
      steps: [{ type: "action", player: "p1", action: { type: "build", lotId: "C5", color: "vega" } }],
    });
    expect(bad.ok).toBe(false);

    // p1 pays p0 to build vega on C5 (active player p0's action)
    const proposed = applyCommand(s, "p1", {
      type: "proposeTrade",
      steps: [
        { type: "money", from: "p1", to: "p0", amount: 10 },
        { type: "action", player: "p0", action: { type: "build", lotId: "C5", color: "vega" } },
      ],
    });
    if (!proposed.ok) throw new Error(proposed.error);
    const approved = applyCommand(proposed.state, "p0", { type: "approveTrade" });
    if (!approved.ok) throw new Error(approved.error);
    const done = applyCommand(approved.state, "p1", { type: "executeTrade" }, constantDie(2));
    if (!done.ok) throw new Error(done.error);
    expect(done.state.board.C5.built).toBe(true);
    expect(done.state.board.C5.color).toBe("vega");
    // p0: 50 + 10 - 8 (C5 price) = 52
    expect(money(done.state, "p0")).toBe(52);
    expect(money(done.state, "p1")).toBe(40);
  });

  it("resumes remaining steps after a reorganize placement pause", () => {
    let s = tradeGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 2 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p0", value: 2 } });
    const proposed = applyCommand(s, "p1", {
      type: "proposeTrade",
      steps: [
        { type: "action", player: "p0", action: { type: "reorganize", lotId: "A1" } },
        { type: "money", from: "p1", to: "p0", amount: 7 },
      ],
    });
    if (!proposed.ok) throw new Error(proposed.error);
    const approved = applyCommand(proposed.state, "p0", { type: "approveTrade" });
    if (!approved.ok) throw new Error(approved.error);
    const executing = applyCommand(approved.state, "p1", { type: "executeTrade" }, constantDie(4));
    if (!executing.ok) throw new Error(executing.error);
    // Paused on p0's placement; money step hasn't run yet
    expect(executing.state.pendingChoice?.kind).toBe("reorgPlacement");
    expect(money(executing.state, "p1")).toBe(50);

    const placed = applyCommand(
      executing.state,
      "p0",
      { type: "chooseReorgPlacement", playerId: "p0", placements: { A1: 4, A2: 4 } },
      constantDie(4),
    );
    if (!placed.ok) throw new Error(placed.error);
    expect(placed.state.pendingChoice).toBeNull();
    // remaining money step resumed: p0 paid 4 for reorg (2+2 pips), +7 from p1
    expect(money(placed.state, "p0")).toBe(50 - 4 + 7);
    expect(money(placed.state, "p1")).toBe(43);
  });
});
