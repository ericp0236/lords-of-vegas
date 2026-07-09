/**
 * Shared gamble payout tiers and payout math. Mirrors the caps applied in the
 * engine (`actionGamble` in src/engine/actions.ts) so the wager modal and the
 * result overlay stay in sync with actual outcomes.
 */

export type GambleOutcome = "double" | "win" | "house";

export interface GamblePayoutTier {
  outcome: GambleOutcome;
  /** Human-readable dice rolls, e.g. "2 or 12". */
  rolls: string;
  /** Short description of what happens. */
  result: string;
}

/** The three payout tiers, in display order. */
export const GAMBLE_PAYOUT_TIERS: GamblePayoutTier[] = [
  { outcome: "double", rolls: "2 or 12", result: "Pays double" },
  { outcome: "win", rolls: "3, 4, 9, 10, 11", result: "Pays your bet" },
  { outcome: "house", rolls: "5, 6, 7, 8", result: "House wins" },
];

/** Category for a 2d6 gamble roll. */
export function gambleOutcome(roll: number): GambleOutcome {
  if (roll === 2 || roll === 12) return "double";
  if (roll >= 5 && roll <= 8) return "house";
  return "win";
}

/** Payout on a normal win (3,4,9,10,11), capped by the boss's available cash. */
export function gambleWinPayout(wager: number, bossMoney: number): number {
  return Math.min(wager, bossMoney);
}

/** Payout on a 2/12 double, capped by the boss's available cash. */
export function gambleDoublePayout(wager: number, bossMoney: number): number {
  return Math.min(wager * 2, bossMoney);
}
