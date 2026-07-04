import { describe, expect, it } from "vitest";
import { ALL_LOT_IDS, BOARD_LOTS, STRIP_ADJACENT_LOTS } from "@/data/boardLots";
import { GAME_OVER_CARD, LOT_CARDS, LOT_TO_DECK } from "@/data/casinoCards";
import { advanceTrack, SCORE_TRACK } from "@/data/scoreTrack";

describe("board data", () => {
  it("has exactly 48 lots", () => {
    expect(ALL_LOT_IDS).toHaveLength(48);
  });

  it("has confirmed prices and die values for spot-checked lots", () => {
    expect(BOARD_LOTS.C12.price).toBe(15);
    expect(BOARD_LOTS.C12.printedDie).toBe(5);
    expect(BOARD_LOTS.D4.price).toBe(12);
    expect(BOARD_LOTS.D4.printedDie).toBe(4);
    expect(BOARD_LOTS.D5.price).toBe(8);
    expect(BOARD_LOTS.D5.printedDie).toBe(1);
    expect(BOARD_LOTS.A6.price).toBe(20);
    expect(BOARD_LOTS.A6.printedDie).toBe(6);
  });

  it("computes 16 strip-adjacent lots", () => {
    expect(STRIP_ADJACENT_LOTS.sort()).toEqual(
      ["A3", "A6", "B1", "B4", "C3", "C6", "C9", "C12", "D1", "D4", "D7", "E3", "E6", "F1", "F4", "F7"].sort(),
    );
  });

  it("adjacency is symmetric and within-block only", () => {
    for (const id of ALL_LOT_IDS) {
      for (const n of BOARD_LOTS[id].neighbors) {
        expect(BOARD_LOTS[n].block).toBe(BOARD_LOTS[id].block);
        expect(BOARD_LOTS[n].neighbors).toContain(id);
      }
    }
    // spot checks
    expect(BOARD_LOTS.A1.neighbors.sort()).toEqual(["A2", "A4"]);
    expect(BOARD_LOTS.C5.neighbors.sort()).toEqual(["C2", "C4", "C6", "C8"]);
  });
});

describe("card data", () => {
  it("has 48 lot cards covering every lot exactly once, plus Game Over", () => {
    expect(LOT_CARDS).toHaveLength(48);
    const lots = LOT_CARDS.map((c) => c.lotId).sort();
    expect(lots).toEqual([...ALL_LOT_IDS].sort());
    expect(GAME_OVER_CARD.isGameOver).toBe(true);
  });

  it("assigns F7 to Vega (not Strip) and the Strip deck to A6/D5/F8", () => {
    expect(LOT_TO_DECK.F7).toBe("vega");
    expect(LOT_TO_DECK.A6).toBe("strip");
    expect(LOT_TO_DECK.D5).toBe("strip");
    expect(LOT_TO_DECK.F8).toBe("strip");
  });

  it("gives each casino deck 9 cards", () => {
    for (const deck of ["albion", "sphinx", "vega", "tivoli", "pioneer"]) {
      expect(LOT_CARDS.filter((c) => c.pays === deck)).toHaveLength(9);
    }
    expect(LOT_CARDS.filter((c) => c.pays === "strip")).toHaveLength(3);
  });
});

describe("score track", () => {
  it("ends at 90 with the documented break structure", () => {
    expect(SCORE_TRACK[SCORE_TRACK.length - 1]).toBe(90);
    expect(SCORE_TRACK).toContain(9);
    expect(SCORE_TRACK).toContain(10);
    expect(SCORE_TRACK).not.toContain(11);
  });

  it("advances 1 point per space below 10", () => {
    // trackIndex 8 = 8 points; +1 → 9
    expect(SCORE_TRACK[advanceTrack(8, 1)]).toBe(9);
  });

  it("loses excess points at breaks", () => {
    const at10 = SCORE_TRACK.indexOf(10);
    // 1 point at 10 cannot clear the 2-point break
    expect(advanceTrack(at10, 1)).toBe(at10);
    // 3 points at 10 clears to 12 and loses 1
    expect(SCORE_TRACK[advanceTrack(at10, 3)]).toBe(12);
  });

  it("scores multiple small casinos individually without pooling", () => {
    const at8 = SCORE_TRACK.indexOf(8);
    // two separate 1-point scores: 8 → 9 → stuck before 10? No: 9→10 gap is 1.
    let idx = advanceTrack(at8, 1); // 9
    idx = advanceTrack(idx, 1); // 10
    expect(SCORE_TRACK[idx]).toBe(10);
    // but a third 1-point score can't clear the 10→12 break
    expect(SCORE_TRACK[advanceTrack(idx, 1)]).toBe(10);
  });
});
