/**
 * Property card decks — source of truth: lords-of-vegas-updated-data/casino-cards.json
 * 5 casino companies × 9 cards + The Strip deck (3 lot cards + Game Over) = 49 cards.
 * F7 is Vega Alliance (not Strip).
 */

import type { LotId } from "./boardLots";

export type CasinoColor = "albion" | "sphinx" | "vega" | "tivoli" | "pioneer";
export type PayTarget = CasinoColor | "strip";

export interface PropertyCard {
  /** Unique card id, e.g. "card-A2" or "card-game-over" */
  id: string;
  /** The lot this card corresponds to; null for the Game Over card */
  lotId: LotId | null;
  /** Which casinos pay & score when this card is drawn */
  pays: PayTarget;
  isGameOver: boolean;
}

export interface CasinoMeta {
  key: CasinoColor;
  name: string;
  /** Short flavor line for supply panel */
  tagline: string;
  /** Primary tile color */
  hex: string;
  /** Darker shade for borders/edges */
  darkHex: string;
  /** Readable text color on the tile */
  textHex: string;
  /** Optional artwork for built tiles on the board (`/public` path) */
  tileImage?: string;
}

export const CASINOS: Record<CasinoColor, CasinoMeta> = {
  albion: {
    key: "albion",
    name: "Albion",
    tagline: "Royal Empire",
    hex: "#8b3fa8",
    darkHex: "#5a2870",
    textHex: "#ffffff",
    tileImage: "/casinos/albion-tile.png",
  },
  sphinx: {
    key: "sphinx",
    name: "Sphinx",
    tagline: "Desert Crown",
    hex: "#d4a72c",
    darkHex: "#8a6e10",
    textHex: "#1a1a1a",
    tileImage: "/casinos/sphinx-tile.png",
  },
  vega: {
    key: "vega",
    name: "Vega",
    tagline: "Star Alliance",
    hex: "#1f8a68",
    darkHex: "#125942",
    textHex: "#ffffff",
    tileImage: "/casinos/vega-tile.png",
  },
  tivoli: {
    key: "tivoli",
    name: "Tivoli",
    tagline: "Grand Arcade",
    hex: "#9aa5b1",
    darkHex: "#5f6871",
    textHex: "#1a1a1a",
    tileImage: "/casinos/tivoli-tile.png",
  },
  pioneer: {
    key: "pioneer",
    name: "Pioneer",
    tagline: "Frontier Line",
    hex: "#a05c2c",
    darkHex: "#5c3b21",
    textHex: "#ffffff",
    tileImage: "/casinos/pioneer-tile.png",
  },
};

export const CASINO_COLOR_KEYS = Object.keys(CASINOS) as CasinoColor[];

/** Number of casino tiles per color in the supply */
export const TILES_PER_COLOR = 9;

const DECKS: Record<PayTarget, LotId[]> = {
  strip: ["A6", "D5", "F8"],
  albion: ["A2", "B3", "B4", "C3", "C8", "D6", "D7", "E2", "F1"],
  sphinx: ["A4", "B1", "C2", "C7", "C12", "D8", "E6", "F3", "F4"],
  vega: ["A3", "B5", "C5", "C10", "D3", "D4", "E3", "F6", "F7"],
  tivoli: ["A5", "B2", "C1", "C6", "C11", "D1", "E4", "F2", "F9"],
  pioneer: ["A1", "B6", "C4", "C9", "D2", "D9", "E1", "E5", "F5"],
};

/** All 48 lot cards (excludes the Game Over card) */
export const LOT_CARDS: PropertyCard[] = (
  Object.entries(DECKS) as [PayTarget, LotId[]][]
).flatMap(([pays, lots]) =>
  lots.map((lotId) => ({ id: `card-${lotId}`, lotId, pays, isGameOver: false })),
);

export const GAME_OVER_CARD: PropertyCard = {
  id: "card-game-over",
  lotId: null,
  pays: "strip",
  isGameOver: true,
};

/** Which deck a given lot's card belongs to (for discard pile display) */
export const LOT_TO_DECK: Record<LotId, PayTarget> = Object.fromEntries(
  LOT_CARDS.map((c) => [c.lotId!, c.pays]),
) as Record<LotId, PayTarget>;
