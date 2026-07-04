import { describe, expect, it } from "vitest";
import { allCasinos, casinoBoss, casinoGroup, casinoPoints, resolveBossTies } from "@/engine/casinos";
import { dieSequence, inActionsPhase, startedGame, withTile } from "./testUtils";

describe("casino grouping", () => {
  it("groups contiguous same-color same-height tiles", () => {
    let s = startedGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 3 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p1", value: 2 } });
    s = withTile(s, "A3", { color: "sphinx", die: { owner: "p0", value: 4 } });
    expect(casinoGroup(s.board, "A1")).toEqual(["A1", "A2"]);
    expect(casinoGroup(s.board, "A3")).toEqual(["A3"]);
  });

  it("does not merge different heights of the same color", () => {
    let s = startedGame();
    s = withTile(s, "A1", { color: "vega", risers: 1, die: { owner: "p0", value: 3 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p1", value: 2 } });
    expect(casinoGroup(s.board, "A1")).toEqual(["A1"]);
    expect(casinoGroup(s.board, "A2")).toEqual(["A2"]);
  });

  it("never groups across blocks", () => {
    let s = startedGame();
    // A3 and B1 are visually across the Strip; never adjacent
    s = withTile(s, "A3", { color: "vega", die: { owner: "p0", value: 3 } });
    s = withTile(s, "B1", { color: "vega", die: { owner: "p1", value: 2 } });
    expect(casinoGroup(s.board, "A3")).toEqual(["A3"]);
  });

  it("counts risers in casino points", () => {
    let s = startedGame();
    s = withTile(s, "A1", { color: "vega", risers: 1, die: { owner: "p0", value: 3 } });
    s = withTile(s, "A2", { color: "vega", risers: 1, die: { owner: "p1", value: 2 } });
    const group = casinoGroup(s.board, "A1");
    expect(casinoPoints(s.board, group)).toBe(4); // 2 spaces × height 2
  });
});

describe("boss determination", () => {
  it("boss is the single highest die", () => {
    let s = startedGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 5 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p1", value: 3 } });
    const boss = casinoBoss(s.board, ["A1", "A2"]);
    expect(boss).toEqual({ value: 5, owners: ["p0"] });
  });

  it("tile without a die counts for points but not for boss", () => {
    let s = startedGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 5 } });
    s = withTile(s, "A2", { color: "vega", die: null });
    expect(casinoPoints(s.board, casinoGroup(s.board, "A1"))).toBe(2);
    expect(casinoBoss(s.board, ["A1", "A2"]).owners).toEqual(["p0"]);
  });

  it("rerolls tied top dice until a single boss emerges", () => {
    let s = startedGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 5 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p1", value: 5 } });
    s = withTile(s, "A3", { color: "vega", die: { owner: "p2", value: 2 } });
    s = inActionsPhase(s, "p0");
    // First reroll: both tied dice → 4 and 6 (p1 becomes boss)
    const { board, events } = resolveBossTies(s, "A1", dieSequence(4, 6));
    expect(board.A1.die?.value).toBe(4);
    expect(board.A2.die?.value).toBe(6);
    expect(board.A3.die?.value).toBe(2); // untied die untouched
    expect(events).toHaveLength(1);
    expect(casinoBoss(board, ["A1", "A2", "A3"]).owners).toEqual(["p1"]);
  });

  it("does not reroll when tied dice belong to the same player", () => {
    let s = startedGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 5 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p0", value: 5 } });
    const { board, events } = resolveBossTies(s, "A1", dieSequence(1));
    expect(events).toHaveLength(0);
    expect(board.A1.die?.value).toBe(5);
  });

  it("cascades: a third player can steal the boss seat after rerolls", () => {
    let s = startedGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 5 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p1", value: 5 } });
    s = withTile(s, "A3", { color: "vega", die: { owner: "p2", value: 4 } });
    // Both 5s reroll to 3 and 3 → now p2's 4 is highest, no more rerolls
    const { board } = resolveBossTies(s, "A1", dieSequence(3, 3));
    expect(casinoBoss(board, ["A1", "A2", "A3"]).owners).toEqual(["p2"]);
  });

  it("allCasinos finds every distinct group", () => {
    let s = startedGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 3 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p1", value: 2 } });
    s = withTile(s, "E1", { color: "pioneer", die: { owner: "p2", value: 1 } });
    expect(allCasinos(s.board)).toHaveLength(2);
  });
});
