import { describe, expect, it } from "vitest";
import { applyCommand } from "@/engine/engine";
import type { GameState } from "@/engine/types";
import { inActionsPhase, startedGame, withMoney, withParking } from "./testUtils";

/** A game where p0 is the active player in the actions phase. */
function actingGame(): GameState {
  return withMoney(inActionsPhase(startedGame(), "p0"), "p0", 50);
}

describe("setTurnActivity", () => {
  it("the active player can set their activity", () => {
    const r = applyCommand(actingGame(), "p0", {
      type: "setTurnActivity",
      activity: { kind: "sprawl-from" },
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.turn?.activity).toEqual({ kind: "sprawl-from" });
  });

  it("rejects a non-active player", () => {
    const r = applyCommand(actingGame(), "p1", {
      type: "setTurnActivity",
      activity: { kind: "build" },
    });
    expect(r.ok).toBe(false);
  });

  it("is a no-op when the activity is unchanged", () => {
    const first = applyCommand(actingGame(), "p0", {
      type: "setTurnActivity",
      activity: { kind: "build", lotId: "A1" },
    });
    if (!first.ok) throw new Error(first.error);
    const second = applyCommand(first.state, "p0", {
      type: "setTurnActivity",
      activity: { kind: "build", lotId: "A1" },
    });
    if (!second.ok) throw new Error(second.error);
    expect(second.state).toBe(first.state);
  });

  it("is cleared after an action commits", () => {
    let s = actingGame();
    s = withParking(s, "A1", "p0");
    const set = applyCommand(s, "p0", {
      type: "setTurnActivity",
      activity: { kind: "build", lotId: "A1", color: "pioneer" },
    });
    if (!set.ok) throw new Error(set.error);
    const built = applyCommand(set.state, "p0", {
      type: "action",
      action: { type: "build", lotId: "A1", color: "pioneer" },
    });
    if (!built.ok) throw new Error(built.error);
    expect(built.state.turn?.activity).toBeNull();
  });

  it("is cleared when the turn passes to the next player", () => {
    const set = applyCommand(actingGame(), "p0", {
      type: "setTurnActivity",
      activity: { kind: "gamble-casino" },
    });
    if (!set.ok) throw new Error(set.error);
    const ended = applyCommand(set.state, "p0", { type: "endTurn" });
    if (!ended.ok) throw new Error(ended.error);
    expect(ended.state.turn?.activity ?? null).toBeNull();
  });
});
