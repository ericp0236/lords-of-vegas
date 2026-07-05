"use client";

/**
 * The Las Vegas board: 6 blocks flanking The Strip on a casino-felt surface.
 * Renders purely from game state; interaction is delegated via `onLotClick`
 * with eligible lots highlighted by the parent.
 *
 * Cells are memoized on their own slice of state so a snapshot update only
 * re-renders the lots that actually changed.
 */

import { memo } from "react";
import { motion } from "motion/react";
import { BLOCKS, BOARD_LOTS, lotsInBlock, type BlockId, type LotId } from "@/data/boardLots";
import { CASINOS } from "@/data/casinoCards";
import { PLAYER_COLORS, type PlayerColor } from "@/data/playerColors";
import type { GameState, TileState } from "@/engine/types";
import { RollingDie } from "./DieFace";
import { PlayerCarMarker } from "./ui/MiniIcons";

export interface BoardProps {
  state: GameState;
  /** Lots the current interaction can target (highlighted + clickable) */
  eligibleLots?: Set<LotId>;
  onLotClick?: (lotId: LotId) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Lot cell
// ---------------------------------------------------------------------------

interface LotCellProps {
  lotId: LotId;
  tile: TileState;
  dieOwnerColor: PlayerColor | null;
  parkingOwnerColor: PlayerColor | null;
  parkingOwnerName: string | null;
  eligible: boolean;
  onClick?: (lotId: LotId) => void;
}

/** Re-render a cell only when its visible content or interactivity changes.
 * Snapshots arrive as fresh JSON (new object identities), so we compare the
 * fields that matter rather than references. */
function lotCellPropsEqual(a: LotCellProps, b: LotCellProps): boolean {
  return (
    a.lotId === b.lotId &&
    a.eligible === b.eligible &&
    a.onClick === b.onClick &&
    a.dieOwnerColor === b.dieOwnerColor &&
    a.parkingOwnerColor === b.parkingOwnerColor &&
    a.parkingOwnerName === b.parkingOwnerName &&
    a.tile.built === b.tile.built &&
    a.tile.color === b.tile.color &&
    a.tile.risers === b.tile.risers &&
    a.tile.die?.owner === b.tile.die?.owner &&
    a.tile.die?.value === b.tile.die?.value
  );
}

const LotCellInner = memo(function LotCell({
  lotId,
  tile,
  dieOwnerColor,
  parkingOwnerColor,
  parkingOwnerName,
  eligible,
  onClick,
}: LotCellProps) {
  const lot = BOARD_LOTS[lotId];
  const clickable = eligible && !!onClick;

  let content: React.ReactNode;
  let style: React.CSSProperties = {};

  if (tile.built && tile.color) {
    const casino = CASINOS[tile.color];
    const height = 1 + tile.risers;
    // Raised casinos read as stacked tiles via layered edge shadows.
    const stack =
      tile.risers > 0
        ? Array.from({ length: Math.min(tile.risers, 4) })
            .map((_, i) => `${(i + 1) * 1.5}px ${(i + 1) * 1.5}px 0 rgba(0,0,0,${0.32 - i * 0.05})`)
            .join(", ") + ","
        : "";
    style = {
      background: `linear-gradient(155deg, ${casino.hex} 0%, ${casino.darkHex} 115%)`,
      boxShadow: `${stack}inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 1px ${casino.darkHex}`,
    };
    content = (
      <motion.div
        key={`built-${tile.color}`}
        initial={{ scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 17 }}
        className="relative flex h-full w-full flex-col items-center justify-center"
      >
        <span
          className="absolute top-0.5 left-1 text-[8px] font-bold tracking-wide opacity-75"
          style={{ color: casino.textHex }}
        >
          {lotId}
        </span>
        {tile.risers > 0 && (
          <span
            className="absolute top-0.5 right-0.5 rounded-sm bg-black/50 px-1 text-[9px] font-bold text-white shadow-sm"
            title={`Height ${height}`}
          >
            ×{height}
          </span>
        )}
        {tile.die && dieOwnerColor ? (
          <motion.div
            initial={{ y: -14, scale: 1.3, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 16 }}
          >
            <RollingDie value={tile.die.value} color={dieOwnerColor} size={30} />
          </motion.div>
        ) : (
          <span
            className="rounded-sm px-1 text-[8px] font-semibold uppercase tracking-wider opacity-70"
            style={{ color: casino.textHex, background: "rgba(0,0,0,0.22)" }}
          >
            no die
          </span>
        )}
      </motion.div>
    );
  } else {
    style = {
      background:
        "linear-gradient(160deg, #262c3b 0%, #1f2431 100%)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 -6px 12px rgba(0,0,0,0.25)",
    };
    content = (
      <div className="relative flex h-full w-full flex-col items-center justify-center">
        <span className="text-[10px] font-bold leading-tight text-white/85">{lotId}</span>
        <span className="text-[9px] leading-tight text-white/45">${lot.price}M</span>
        <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[9px] font-bold text-white/65">
          {lot.printedDie}
        </span>
        {parkingOwnerColor && (
          <motion.span
            key={parkingOwnerColor}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="absolute bottom-0 right-0 z-[1]"
          >
            <PlayerCarMarker
              color={PLAYER_COLORS[parkingOwnerColor].hex}
              size={36}
              className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]"
              title={parkingOwnerName ? `${parkingOwnerName}'s lot` : undefined}
            />
          </motion.span>
        )}
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      disabled={!clickable}
      onClick={clickable ? () => onClick!(lotId) : undefined}
      whileHover={clickable ? { scale: 1.06, zIndex: 20 } : undefined}
      whileTap={clickable ? { scale: 0.97 } : undefined}
      className={`focus-ring relative h-full w-full select-none rounded-[3px] ${
        clickable ? "eligible-pulse z-10 cursor-pointer" : "cursor-default"
      }`}
      style={style}
      aria-label={`Lot ${lotId}${eligible ? " (selectable)" : ""}`}
    >
      {content}
    </motion.button>
  );
}, lotCellPropsEqual);

// ---------------------------------------------------------------------------
// Blocks & streets
// ---------------------------------------------------------------------------

function Block({
  state,
  block,
  eligibleLots,
  onLotClick,
}: {
  state: GameState;
  block: BlockId;
  eligibleLots?: Set<LotId>;
  onLotClick?: (lotId: LotId) => void;
}) {
  const geo = BLOCKS[block];
  return (
    <div
      className="grid h-full min-h-0 gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(${geo.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${geo.rows}, minmax(0, 1fr))`,
      }}
    >
      {lotsInBlock(block).map((lotId) => {
        const tile = state.board[lotId];
        const dieOwner = tile.die
          ? state.players.find((p) => p.id === tile.die!.owner) ?? null
          : null;
        const parkingOwner =
          !tile.built && tile.parkingOwner
            ? state.players.find((p) => p.id === tile.parkingOwner) ?? null
            : null;
        return (
          <LotCellInner
            key={lotId}
            lotId={lotId}
            tile={tile}
            dieOwnerColor={dieOwner?.color ?? null}
            parkingOwnerColor={parkingOwner?.color ?? null}
            parkingOwnerName={parkingOwner?.name ?? null}
            eligible={eligibleLots?.has(lotId) ?? false}
            onClick={onLotClick}
          />
        );
      })}
    </div>
  );
}

function Street({ name, connect }: { name: string; connect?: "strip-left" | "strip-right" }) {
  return (
    <div
      className={`board-street flex min-h-0 items-center justify-center ${
        connect === "strip-right"
          ? "board-street--to-strip-right"
          : connect === "strip-left"
            ? "board-street--to-strip-left"
            : ""
      }`}
    >
      <div className="board-street__centerline" aria-hidden="true" />
      <span className="board-street__label neon-flicker">{name}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export function Board({ state, eligibleLots, onLotClick, className = "" }: BoardProps) {
  // All sizes are expressed in fr units of one lot cell so every cell on the
  // board renders at exactly the same size: 3 cells per side column, 8 cell
  // rows per column, streets 0.35 and the Strip 0.65 of a cell. The fixed
  // aspect ratio keeps the cells square regardless of container size.
  return (
    <div className={`flex min-h-0 items-center justify-center ${className}`}>
      <div
        className="felt gold-rail grid h-full max-h-full w-auto max-w-full grid-cols-[3fr_0.65fr_3fr] overflow-visible rounded-xl p-2"
        style={{ aspectRatio: "6.65 / 8.7" }}
      >
        {/* Left column: A (2 rows), C (4 rows), E (2 rows) */}
        <div className="z-10 grid min-h-0 grid-rows-[2fr_0.35fr_4fr_0.35fr_2fr]">
          <Block state={state} block="A" eligibleLots={eligibleLots} onLotClick={onLotClick} />
          <Street name="Sahara Ave" connect="strip-right" />
          <Block state={state} block="C" eligibleLots={eligibleLots} onLotClick={onLotClick} />
          <Street name="Flamingo Rd" connect="strip-right" />
          <Block state={state} block="E" eligibleLots={eligibleLots} onLotClick={onLotClick} />
        </div>
        {/* The Strip */}
        <div className="relative z-0 flex min-h-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-b from-[#12172a] via-[#1a2138] to-[#12172a] shadow-[inset_0_0_14px_rgba(0,0,0,0.55)]">
          <div
            className="strip-neon absolute inset-y-2 left-1/2 w-px -translate-x-1/2"
            style={{
              background:
                "repeating-linear-gradient(to bottom, var(--accent) 0 10px, transparent 10px 22px)",
              opacity: 0.85,
            }}
          />
          <span
            className="neon-flicker rotate-180 text-[11px] font-bold uppercase tracking-[0.4em] text-[var(--accent)]"
            style={{
              writingMode: "vertical-rl",
              textShadow: "0 0 8px rgba(245,197,66,0.8), 0 0 20px rgba(245,197,66,0.4)",
            }}
          >
            The Strip
          </span>
        </div>
        {/* Right column: B (2 rows), D (3 rows), F (3 rows) */}
        <div className="z-10 grid min-h-0 grid-rows-[2fr_0.35fr_3fr_0.35fr_3fr]">
          <Block state={state} block="B" eligibleLots={eligibleLots} onLotClick={onLotClick} />
          <Street name="Sahara Ave" connect="strip-left" />
          <Block state={state} block="D" eligibleLots={eligibleLots} onLotClick={onLotClick} />
          <Street name="Harmon Ave" connect="strip-left" />
          <Block state={state} block="F" eligibleLots={eligibleLots} onLotClick={onLotClick} />
        </div>
      </div>
    </div>
  );
}
