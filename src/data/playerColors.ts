/** Fixed player colors matching the physical game. */
export type PlayerColor = "black" | "blue" | "green" | "purple" | "red" | "yellow";

export interface PlayerColorMeta {
  key: PlayerColor;
  name: string;
  hex: string;
  /** Text color that reads well on the player color */
  textHex: string;
}

export const PLAYER_COLORS: Record<PlayerColor, PlayerColorMeta> = {
  black: { key: "black", name: "Black", hex: "#27272a", textHex: "#ffffff" },
  blue: { key: "blue", name: "Blue", hex: "#2563eb", textHex: "#ffffff" },
  green: { key: "green", name: "Green", hex: "#16a34a", textHex: "#ffffff" },
  purple: { key: "purple", name: "Purple", hex: "#9333ea", textHex: "#ffffff" },
  red: { key: "red", name: "Red", hex: "#dc2626", textHex: "#ffffff" },
  yellow: { key: "yellow", name: "Yellow", hex: "#eab308", textHex: "#1a1a1a" },
};

export const PLAYER_COLOR_KEYS = Object.keys(PLAYER_COLORS) as PlayerColor[];

/** Per-player component limits from the physical game */
export const DICE_PER_PLAYER = 12;
export const LOT_MARKERS_PER_PLAYER = 10;
