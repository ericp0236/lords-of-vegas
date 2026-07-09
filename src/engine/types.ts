/**
 * Core game state and command types for the Lords of Vegas engine.
 * This module is pure TypeScript: no React, no Supabase.
 */

import type { LotId } from "@/data/boardLots";
import type { CasinoColor, PropertyCard } from "@/data/casinoCards";
import type { PlayerColor } from "@/data/playerColors";

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export interface Player {
  id: string;
  /** Reconnect token held in the player's browser localStorage */
  token: string;
  name: string;
  color: PlayerColor;
  /** $ millions */
  money: number;
  /** Position on the scoring track (index into SCORE_TRACK) */
  trackIndex: number;
  isHost: boolean;
  /** Seat = join order; turn order proceeds by seat starting from the first player */
  seat: number;
}

export interface JoinRequest {
  id: string;
  token: string;
  name: string;
  color: PlayerColor;
  requestedAt: number;
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export interface Die {
  owner: string; // player id
  value: number; // 1-6
}

export interface TileState {
  lotId: LotId;
  /** Owner of the lot marker when the lot is an (unbuilt) parking lot */
  parkingOwner: string | null;
  built: boolean;
  color: CasinoColor | null;
  /** Risers under the tile; height = 1 + risers */
  risers: number;
  die: Die | null;
}

export type Board = Record<LotId, TileState>;

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

export type TradeStep =
  | { type: "money"; from: string; to: string; amount: number }
  | { type: "lot"; from: string; to: string; lotId: LotId }
  | { type: "die"; from: string; to: string; lotId: LotId }
  /** Only the active player may bundle their own legal actions into a trade */
  | { type: "action"; player: string; action: ActionCommand };

export interface TradeState {
  id: string;
  proposerId: string;
  steps: TradeStep[];
  /** Every affected player (all players appearing in any step + proposer) */
  participants: string[];
  /** playerIds that have approved (proposer approves implicitly) */
  approvals: string[];
  status: "pending" | "ready" | "executing";
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Pending choices (async player decisions mid-resolution)
// ---------------------------------------------------------------------------

/** What to resume once the pending choice is resolved */
export type Continuation =
  | { type: "none" }
  /** Finish draw steps 2-5 after the step-1 choice resolved */
  | { type: "drawSteps"; card: PropertyCard }
  /** Continue executing the remaining steps of a trade */
  | { type: "tradeSteps"; remaining: TradeStep[]; proposerId: string };

export type PendingChoice =
  /**
   * Player must remove one of their own dice from the board to place a new
   * one (dice exhaustion during draw step 1 takeover/inherit).
   * The vacated tile stays built with no die.
   */
  | {
      kind: "removeDie";
      playerId: string;
      /** The lot the freed die will be placed on */
      targetLot: LotId;
      /** Value the placed die must show */
      targetValue: number;
      continuation: Continuation;
    }
  /**
   * Player must vacate one of their parking lots to place a marker on a
   * newly gained lot (lot marker exhaustion).
   */
  | {
      kind: "vacateLot";
      playerId: string;
      targetLot: LotId;
      continuation: Continuation;
    }
  /**
   * After a reorganize reroll, every player with 2+ dice in the casino
   * chooses which of their original tiles each rerolled die returns to.
   */
  | {
      kind: "reorgPlacement";
      casinoLots: LotId[];
      /** playerId -> rerolled die values awaiting placement */
      waiting: Record<string, number[]>;
      /** playerId -> lots (within casinoLots) that player's dice came from */
      slots: Record<string, LotId[]>;
      /** Per-lot reroll results for UI reveal animation (optional on legacy saves) */
      rerolls?: ReorgReroll[];
      continuation: Continuation;
    };

// ---------------------------------------------------------------------------
// Turn
// ---------------------------------------------------------------------------

export interface ReorgReroll {
  lotId: LotId;
  ownerId: string;
  from: number;
  to: number;
}

export interface TurnState {
  number: number;
  activePlayerId: string;
  /** 'draw' = must draw a card; 'actions' = card resolved, free actions */
  phase: "draw" | "actions";
  drawnCard: PropertyCard | null;
  gambleUsed: boolean;
  /** Lots whose dice have been reorganized this turn */
  reorganizedLots: LotId[];
  /** Latest reorganize reroll results for UI reveal (cleared on end turn) */
  reorgReveal: ReorgReroll[] | null;
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export type GamePhase = "lobby" | "playing" | "ended";

export interface GameState {
  schemaVersion: 1;
  roomCode: string;
  phase: GamePhase;
  hostId: string;
  players: Player[];
  joinRequests: JoinRequest[];
  board: Board;
  /** Face-down deck; index 0 is the top card */
  deck: PropertyCard[];
  /** Discards grouped by deck for the physical-board card-count display */
  discard: Record<string, PropertyCard[]>;
  /** Remaining casino tiles per color (starts at 9) */
  tileSupply: Record<CasinoColor, number>;
  turn: TurnState | null;
  pendingChoice: PendingChoice | null;
  trade: TradeState | null;
  winnerId: string | null;
  /** Recent log tail kept in state for instant rendering; full log in DB */
  log: LogEvent[];
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Log / events
// ---------------------------------------------------------------------------

export type LogEventType =
  | "lobby"
  | "setup"
  | "draw"
  | "parking-payout"
  | "casino-payout"
  | "scoring"
  | "action"
  | "reroll"
  | "trade"
  | "choice"
  | "game-over"
  | "gamble-roll";

export interface LogEvent {
  type: LogEventType;
  message: string;
  turn: number;
  at: number;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** In-turn actions (step 6). vacateDieLot covers dice exhaustion up front. */
export type ActionCommand =
  | { type: "build"; lotId: LotId; color: CasinoColor; vacateDieLot?: LotId }
  | { type: "sprawl"; fromLot: LotId; toLot: LotId; vacateDieLot?: LotId }
  | { type: "remodel"; lotId: LotId; newColor: CasinoColor }
  | { type: "reorganize"; lotId: LotId }
  | { type: "raise"; lotId: LotId }
  | { type: "gamble"; lotId: LotId; wager: number };

export type Command =
  // Lobby
  | { type: "requestJoin"; request: Omit<JoinRequest, "requestedAt"> }
  | { type: "approveJoin"; requestId: string }
  | { type: "rejectJoin"; requestId: string }
  | { type: "leaveLobby"; playerId: string }
  | { type: "startGame" }
  | { type: "replayGame" }
  // Turn
  | { type: "drawCard" }
  | { type: "action"; action: ActionCommand }
  | { type: "endTurn" }
  // Pending choices
  | { type: "chooseRemoveDie"; lotId: LotId }
  | { type: "chooseVacateLot"; lotId: LotId }
  | { type: "chooseReorgPlacement"; playerId: string; placements: Record<LotId, number> }
  // Trades
  | { type: "proposeTrade"; steps: TradeStep[] }
  | { type: "approveTrade" }
  | { type: "rejectTrade" }
  | { type: "cancelTrade" }
  | { type: "executeTrade" }
  // Gamble UI sync (dice tray overlay — no game-state change)
  | { type: "revealGambleRoll"; gambleAt: number }
  | { type: "stopGambleRoll"; gambleAt: number };

// ---------------------------------------------------------------------------
// Engine result
// ---------------------------------------------------------------------------

export interface EngineOk {
  ok: true;
  state: GameState;
  events: LogEvent[];
}

export interface EngineErr {
  ok: false;
  error: string;
}

export type EngineResult = EngineOk | EngineErr;

/** Injectable randomness for testability: returns float in [0, 1) */
export type Rng = () => number;
