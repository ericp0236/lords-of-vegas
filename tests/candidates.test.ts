import { describe, expect, it } from "vitest";
import {
  buildTargets,
  gambleTargets,
  isActionAvailable,
  raiseTargets,
  remodelTargets,
  reorganizeTargets,
  sprawlFromTargets,
} from "@/lib/candidates";
import { inActionsPhase, startedGame, withMoney, withParking, withTile } from "./testUtils";

describe("buildTargets", () => {
  it("returns affordable parking lots only", () => {
    let s = startedGame();
    s = inActionsPhase(s, "p0");
    s = withParking(s, "C5", "p0"); // $8M
    s = withParking(s, "A2", "p0"); // $6M
    s = withMoney(s, "p0", 7);

    expect(buildTargets(s, "p0")).not.toContain("C5");
    expect(buildTargets(s, "p0")).toContain("A2");
  });

  it("returns empty when the player cannot afford any parking lot", () => {
    let s = startedGame();
    s = inActionsPhase(s, "p0");
    s = withParking(s, "C5", "p0");
    s = withMoney(s, "p0", 0);

    expect(buildTargets(s, "p0")).toEqual([]);
    expect(isActionAvailable(s, "p0", "build")).toBe(false);
  });
});

describe("sprawlFromTargets", () => {
  it("excludes boss casinos when sprawl would be unaffordable", () => {
    let s = startedGame();
    s = inActionsPhase(s, "p0");
    s = withTile(s, "C5", { color: "vega", die: { owner: "p0", value: 1 } });
    s = withMoney(s, "p0", 5);

    expect(sprawlFromTargets(s, "p0")).toEqual([]);
    expect(isActionAvailable(s, "p0", "sprawl")).toBe(false);
  });
});

describe("remodelTargets", () => {
  it("excludes casinos when remodel cost exceeds money", () => {
    let s = startedGame();
    s = inActionsPhase(s, "p0");
    s = withTile(s, "C5", { color: "vega", die: { owner: "p0", value: 1 } });
    s = withMoney(s, "p0", 4);

    expect(remodelTargets(s, "p0")).toEqual([]);
    expect(isActionAvailable(s, "p0", "remodel")).toBe(false);
  });
});

describe("raiseTargets", () => {
  it("excludes casinos when raise cost exceeds money", () => {
    let s = startedGame();
    s = inActionsPhase(s, "p0");
    s = withTile(s, "C5", { color: "vega", die: { owner: "p0", value: 1 } });
    s = withMoney(s, "p0", 10);

    expect(raiseTargets(s, "p0")).toEqual([]);
    expect(isActionAvailable(s, "p0", "raise")).toBe(false);
  });
});

describe("reorganizeTargets", () => {
  it("excludes casinos when reorganize cost exceeds money", () => {
    let s = startedGame();
    s = inActionsPhase(s, "p0");
    s = withTile(s, "C5", { color: "vega", die: { owner: "p0", value: 6 } });
    s = withMoney(s, "p0", 5);

    expect(reorganizeTargets(s, "p0")).toEqual([]);
    expect(isActionAvailable(s, "p0", "reorganize")).toBe(false);
  });
});

describe("gambleTargets", () => {
  it("returns empty when the player cannot afford a minimum bet", () => {
    let s = startedGame();
    s = inActionsPhase(s, "p0");
    s = withTile(s, "C5", { color: "vega", die: { owner: "p1", value: 1 } });
    s = withMoney(s, "p0", 0);

    expect(gambleTargets(s, "p0")).toEqual([]);
    expect(isActionAvailable(s, "p0", "gamble")).toBe(false);
  });

  it("returns empty after gamble is used this turn", () => {
    let s = startedGame();
    s = inActionsPhase(s, "p0");
    s = withTile(s, "C5", { color: "vega", die: { owner: "p1", value: 1 } });
    s = {
      ...s,
      turn: s.turn ? { ...s.turn, gambleUsed: true } : s.turn,
    };

    expect(isActionAvailable(s, "p0", "gamble")).toBe(false);
  });
});
