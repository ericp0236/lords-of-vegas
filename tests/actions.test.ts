import { describe, expect, it } from "vitest";
import { applyCommand } from "@/engine/engine";
import { diceOnBoard } from "@/engine/helpers";
import type { GameState } from "@/engine/types";
import {
  constantDie,
  dieSequence,
  inActionsPhase,
  startedGame,
  withMoney,
  withParking,
  withTile,
} from "./testUtils";

function actionsGame(): GameState {
  let s = startedGame();
  s = inActionsPhase(s, "p0");
  s = withMoney(s, "p0", 100);
  return s;
}

describe("build", () => {
  it("builds on an owned parking lot: pays price, places die at printed value", () => {
    let s = actionsGame();
    s = withParking(s, "C5", "p0"); // $8M, printed die 1
    const r = applyCommand(s, "p0", {
      type: "action",
      action: { type: "build", lotId: "C5", color: "vega" },
    });
    if (!r.ok) throw new Error(r.error);
    const t = r.state.board.C5;
    expect(t.built).toBe(true);
    expect(t.color).toBe("vega");
    expect(t.die).toEqual({ owner: "p0", value: 1 });
    expect(t.parkingOwner).toBeNull();
    expect(r.state.players[0].money).toBe(92);
    expect(r.state.tileSupply.vega).toBe(8);
  });

  it("rejects building on someone else's lot or without money", () => {
    let s = actionsGame();
    s = withParking(s, "C5", "p1");
    expect(
      applyCommand(s, "p0", { type: "action", action: { type: "build", lotId: "C5", color: "vega" } }).ok,
    ).toBe(false);
    let s2 = actionsGame();
    s2 = withParking(s2, "C5", "p0");
    s2 = withMoney(s2, "p0", 7);
    expect(
      applyCommand(s2, "p0", { type: "action", action: { type: "build", lotId: "C5", color: "vega" } }).ok,
    ).toBe(false);
  });

  it("rejects building when the color supply is exhausted", () => {
    let s = actionsGame();
    s = withParking(s, "C5", "p0");
    s = { ...s, tileSupply: { ...s.tileSupply, vega: 0 } };
    const r = applyCommand(s, "p0", {
      type: "action",
      action: { type: "build", lotId: "C5", color: "vega" },
    });
    expect(r.ok).toBe(false);
  });

  it("merges with an adjacent same-color casino and resolves the boss tie", () => {
    let s = actionsGame();
    s = withTile(s, "C4", { color: "vega", die: { owner: "p1", value: 1 } }); // C5's printed die is 1 → tie
    s = withParking(s, "C5", "p0");
    // reroll: p1 → 2, p0 → 6 (order by lot within group: C4 then C5)
    const r = applyCommand(
      s,
      "p0",
      { type: "action", action: { type: "build", lotId: "C5", color: "vega" } },
      dieSequence(2, 6),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.state.board.C4.die?.value).toBe(2);
    expect(r.state.board.C5.die?.value).toBe(6);
  });

  it("enforces dice exhaustion: must vacate one of your dice", () => {
    let s = actionsGame();
    // Put 12 p0 dice on the board
    const lots = ["A1", "A2", "A3", "A4", "A5", "A6", "B1", "B2", "B3", "B4", "B5", "B6"];
    for (const lot of lots) s = withTile(s, lot, { color: "sphinx", die: { owner: "p0", value: 2 } });
    s = withParking(s, "C5", "p0");
    expect(diceOnBoard(s, "p0")).toBe(12);

    const noChoice = applyCommand(s, "p0", {
      type: "action",
      action: { type: "build", lotId: "C5", color: "vega" },
    });
    expect(noChoice.ok).toBe(false);

    const r = applyCommand(s, "p0", {
      type: "action",
      action: { type: "build", lotId: "C5", color: "vega", vacateDieLot: "A1" },
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.board.A1.die).toBeNull();
    expect(r.state.board.A1.built).toBe(true); // tile stays, unowned
    expect(r.state.board.C5.die).toEqual({ owner: "p0", value: 1 });
    expect(diceOnBoard(r.state, "p0")).toBe(12);
  });
});

describe("sprawl", () => {
  it("costs 2× lot price plus $15M per riser and matches height", () => {
    let s = actionsGame();
    s = withTile(s, "C4", { color: "vega", risers: 1, die: { owner: "p0", value: 6 } });
    // C5 price $8 → 16 + 15 = 31
    const r = applyCommand(
      s,
      "p0",
      { type: "action", action: { type: "sprawl", fromLot: "C4", toLot: "C5" } },
      constantDie(3),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.state.players[0].money).toBe(100 - 31);
    expect(r.state.board.C5.risers).toBe(1);
    expect(r.state.board.C5.color).toBe("vega");
    expect(r.state.board.C5.die).toEqual({ owner: "p0", value: 1 }); // printed value
  });

  it("requires being the boss and an adjacent unmarked lot", () => {
    let s = actionsGame();
    s = withTile(s, "C4", { color: "vega", die: { owner: "p1", value: 6 } });
    expect(
      applyCommand(s, "p0", { type: "action", action: { type: "sprawl", fromLot: "C4", toLot: "C5" } })
        .ok,
    ).toBe(false);

    let s2 = actionsGame();
    s2 = withTile(s2, "C4", { color: "vega", die: { owner: "p0", value: 6 } });
    s2 = withParking(s2, "C5", "p1"); // marked lot: cannot sprawl there
    expect(
      applyCommand(s2, "p0", { type: "action", action: { type: "sprawl", fromLot: "C4", toLot: "C5" } })
        .ok,
    ).toBe(false);

    let s3 = actionsGame();
    s3 = withTile(s3, "C4", { color: "vega", die: { owner: "p0", value: 6 } });
    expect(
      applyCommand(s3, "p0", { type: "action", action: { type: "sprawl", fromLot: "C4", toLot: "C12" } })
        .ok,
    ).toBe(false); // not adjacent
  });
});

describe("remodel", () => {
  it("changes color for $5M per space and exchanges supply", () => {
    let s = actionsGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 5 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p1", value: 3 } });
    const r = applyCommand(s, "p0", {
      type: "action",
      action: { type: "remodel", lotId: "A1", newColor: "pioneer" },
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.board.A1.color).toBe("pioneer");
    expect(r.state.board.A2.color).toBe("pioneer");
    expect(r.state.players[0].money).toBe(90);
    expect(r.state.tileSupply.vega).toBe(11); // 9 + 2 returned
    expect(r.state.tileSupply.pioneer).toBe(7);
  });

  it("remodel-merge triggers a boss-tie reroll", () => {
    let s = actionsGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 5 } });
    s = withTile(s, "A2", { color: "pioneer", die: { owner: "p1", value: 5 } });
    const r = applyCommand(
      s,
      "p0",
      { type: "action", action: { type: "remodel", lotId: "A1", newColor: "pioneer" } },
      dieSequence(2, 4),
    );
    if (!r.ok) throw new Error(r.error);
    // merged into one casino; tie rerolled
    expect(r.state.board.A1.die?.value).toBe(2);
    expect(r.state.board.A2.die?.value).toBe(4);
  });
});

describe("raise", () => {
  it("adds a riser per tile for $15M each, capped at player count", () => {
    let s = actionsGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 5 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p0", value: 3 } });
    const r = applyCommand(s, "p0", { type: "action", action: { type: "raise", lotId: "A1" } });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.board.A1.risers).toBe(1);
    expect(r.state.board.A2.risers).toBe(1);
    expect(r.state.players[0].money).toBe(70);

    // 3-player game: height 3 max. Raise twice more → second should fail.
    const s2 = withMoney(r.state, "p0", 100);
    const r2 = applyCommand(s2, "p0", { type: "action", action: { type: "raise", lotId: "A1" } });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.state.board.A1.risers).toBe(2);
    const r3 = applyCommand(r2.state, "p0", {
      type: "action",
      action: { type: "raise", lotId: "A1" },
    });
    expect(r3.ok).toBe(false);
  });
});

describe("gamble", () => {
  function gambleSetup(): GameState {
    let s = actionsGame();
    s = withTile(s, "A1", { color: "vega", risers: 1, die: { owner: "p1", value: 5 } });
    s = withTile(s, "A2", { color: "vega", risers: 1, die: { owner: "p1", value: 3 } });
    s = withMoney(s, "p1", 15);
    return s;
  }

  it("win on 9 (4+5): boss pays the wager", () => {
    const r = applyCommand(
      gambleSetup(),
      "p0",
      { type: "action", action: { type: "gamble", lotId: "A1", wager: 10 } },
      dieSequence(4, 5),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.state.players[0].money).toBe(110);
    expect(r.state.players[1].money).toBe(5);
  });

  it("2 pays double but is capped by the boss's money", () => {
    const r = applyCommand(
      gambleSetup(),
      "p0",
      { type: "action", action: { type: "gamble", lotId: "A1", wager: 10 } },
      dieSequence(1, 1),
    );
    if (!r.ok) throw new Error(r.error);
    // double = 20, boss only has 15
    expect(r.state.players[0].money).toBe(115);
    expect(r.state.players[1].money).toBe(0);
  });

  it("house wins on 7: boss takes the bet", () => {
    const r = applyCommand(
      gambleSetup(),
      "p0",
      { type: "action", action: { type: "gamble", lotId: "A1", wager: 10 } },
      dieSequence(3, 4),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.state.players[0].money).toBe(90);
    expect(r.state.players[1].money).toBe(25);
  });

  it("caps the bet at $5M per tile including risers", () => {
    // 2 spaces × height 2 = 4 tiles → max 20
    const r = applyCommand(gambleSetup(), "p0", {
      type: "action",
      action: { type: "gamble", lotId: "A1", wager: 21 },
    });
    expect(r.ok).toBe(false);
  });

  it("only once per turn and never at your own casino", () => {
    const first = applyCommand(
      gambleSetup(),
      "p0",
      { type: "action", action: { type: "gamble", lotId: "A1", wager: 1 } },
      dieSequence(3, 4),
    );
    if (!first.ok) throw new Error(first.error);
    const second = applyCommand(first.state, "p0", {
      type: "action",
      action: { type: "gamble", lotId: "A1", wager: 1 },
    });
    expect(second.ok).toBe(false);

    let own = actionsGame();
    own = withTile(own, "A1", { color: "vega", die: { owner: "p0", value: 5 } });
    expect(
      applyCommand(own, "p0", { type: "action", action: { type: "gamble", lotId: "A1", wager: 1 } })
        .ok,
    ).toBe(false);
  });
});

describe("reorganize", () => {
  it("costs $1M per pip, rerolls all dice, and blocks repeats this turn", () => {
    let s = actionsGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 2 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p1", value: 5 } });
    // reroll: A1 → 6, A2 → 3 (single die each → auto-placed)
    const r = applyCommand(
      s,
      "p0",
      { type: "action", action: { type: "reorganize", lotId: "A1" } },
      dieSequence(6, 3),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.state.players[0].money).toBe(93); // paid 7
    expect(r.state.board.A1.die?.value).toBe(6);
    expect(r.state.board.A2.die?.value).toBe(3);
    expect(r.state.pendingChoice).toBeNull();

    const again = applyCommand(r.state, "p0", {
      type: "action",
      action: { type: "reorganize", lotId: "A2" },
    });
    expect(again.ok).toBe(false);
  });

  it("requires a die in the casino", () => {
    let s = actionsGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p1", value: 2 } });
    expect(
      applyCommand(s, "p0", { type: "action", action: { type: "reorganize", lotId: "A1" } }).ok,
    ).toBe(false);
  });

  it("players with multiple dice choose placement; boss ties settle after", () => {
    let s = actionsGame();
    s = withTile(s, "A1", { color: "vega", die: { owner: "p0", value: 2 } });
    s = withTile(s, "A2", { color: "vega", die: { owner: "p0", value: 3 } });
    s = withTile(s, "A3", { color: "vega", die: { owner: "p1", value: 4 } });
    // rerolls in lot order: p0 gets 6 and 1, p1's single die → 4
    const r = applyCommand(
      s,
      "p0",
      { type: "action", action: { type: "reorganize", lotId: "A1" } },
      dieSequence(6, 1, 4),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.state.pendingChoice?.kind).toBe("reorgPlacement");
    // p1's single die placed immediately
    expect(r.state.board.A3.die).toEqual({ owner: "p1", value: 4 });
    // p0's dice await placement
    expect(r.state.board.A1.die).toBeNull();
    expect(r.state.board.A2.die).toBeNull();

    // Wrong values rejected
    const bad = applyCommand(r.state, "p0", {
      type: "chooseReorgPlacement",
      playerId: "p0",
      placements: { A1: 5, A2: 1 },
    });
    expect(bad.ok).toBe(false);

    // Place the 6 on A2 (protecting it from a takeover on A1's card, say)
    const placed = applyCommand(r.state, "p0", {
      type: "chooseReorgPlacement",
      playerId: "p0",
      placements: { A2: 6, A1: 1 },
    });
    if (!placed.ok) throw new Error(placed.error);
    expect(placed.state.pendingChoice).toBeNull();
    expect(placed.state.board.A2.die).toEqual({ owner: "p0", value: 6 });
    expect(placed.state.board.A1.die).toEqual({ owner: "p0", value: 1 });
  });
});
