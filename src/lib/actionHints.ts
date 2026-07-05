import type { ActionKind } from "@/lib/candidates";

export interface ActionHint {
  summary: string;
  cost: string;
}

export const ACTION_HINTS: Record<ActionKind, ActionHint> = {
  build: {
    summary: "Place a casino tile on one of your parking lots and put a die there at the lot's printed value.",
    cost: "Lot price ($6M–$15M) + 1 casino tile from supply",
  },
  sprawl: {
    summary: "Expand a casino you boss into an adjacent empty, unmarked lot.",
    cost: "2× target lot price + $15M per riser + 1 matching tile",
  },
  remodel: {
    summary: "Change a casino you boss to a different color.",
    cost: "$5M per space + enough tiles of the new color to cover the casino",
  },
  raise: {
    summary: "Add a riser level to every tile in a casino you boss.",
    cost: "$15M per space",
  },
  reorganize: {
    summary: "Reroll all dice in a casino where you have at least one die.",
    cost: "$1M per pip on the casino's dice (once per casino per turn)",
  },
  gamble: {
    summary: "Bet at another player's casino. Roll 2d6 — 2/12 pays double, 3/4/9/10/11 wins, 5–8 House wins.",
    cost: "Your wager, up to $5M per casino tile (once per turn)",
  },
};

export function actionHintTitle(kind: ActionKind, playerCount?: number): string {
  const hint = ACTION_HINTS[kind];
  const cost =
    kind === "raise" && playerCount
      ? `${hint.cost} (max height ${playerCount})`
      : hint.cost;
  return `${hint.summary} Cost: ${cost}`;
}
