"use client";

/**
 * The Las Vegas board: 6 blocks flanking The Strip on a casino-felt surface.
 * Renders purely from game state; interaction is delegated via `onLotClick`
 * with eligible lots highlighted by the parent.
 *
 * Cells are memoized on their own slice of state so a snapshot update only
 * re-renders the lots that actually changed.
 */

import { memo, useMemo } from "react";
import { motion } from "motion/react";
import { BLOCKS, BOARD_LOTS, lotsInBlock, type BlockId, type LotId } from "@/data/boardLots";
import { CASINOS } from "@/data/casinoCards";
import { PLAYER_COLORS, type PlayerColor } from "@/data/playerColors";
import { allCasinos, bossOf } from "@/engine/casinos";
import type { GameState, TileState } from "@/engine/types";
import { RollingDie } from "./DieFace";
import { PlayerCarMarker } from "./ui/MiniIcons";
import { ParkingLotMarkings } from "./ParkingLotMarkings";

export interface BoardOverlayDie {
  value: number;
  color: PlayerColor;
  /** When set, die animates from this pip count to `value` (reorganize reveal). */
  fromValue?: number;
}

export interface BoardProps {
  state: GameState;
  /** Lots that pulse as valid drop targets */
  eligibleLots?: Set<LotId>;
  /** Lots that accept clicks (defaults to eligibleLots when omitted) */
  clickableLots?: Set<LotId>;
  /** Preview dice drawn on top of lots (e.g. reorg placement draft) */
  overlayDice?: Partial<Record<LotId, BoardOverlayDie>>;
  /** Lots with a stronger focus ring (e.g. reorg tile picked first) */
  focusedLots?: Set<LotId>;
  onLotClick?: (lotId: LotId) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Boss-colored casino group outlines
// ---------------------------------------------------------------------------

interface EdgeMask {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

interface BossOutline {
  /** CSS color for the perimeter stroke */
  color: string;
  edges: EdgeMask;
}

/** Black is too dark on tiles/felt; use a light stone so the ring still reads. */
function bossOutlineColor(playerColor: PlayerColor | null): string {
  if (!playerColor) return "rgba(255, 255, 255, 0.4)";
  if (playerColor === "black") return "rgba(212, 212, 216, 0.85)";
  const hex = PLAYER_COLORS[playerColor].hex;
  return `${hex}cc`;
}

function externalEdges(lotId: LotId, group: Set<LotId>): EdgeMask {
  const { row, col, block } = BOARD_LOTS[lotId];
  const geo = BLOCKS[block];
  const at = (r: number, c: number): LotId | null => {
    if (r < 0 || c < 0 || r >= geo.rows || c >= geo.cols) return null;
    return `${block}${r * geo.cols + c + 1}`;
  };
  const inGroup = (id: LotId | null) => id !== null && group.has(id);
  return {
    n: !inGroup(at(row - 1, col)),
    s: !inGroup(at(row + 1, col)),
    w: !inGroup(at(row, col - 1)),
    e: !inGroup(at(row, col + 1)),
  };
}

function computeBossOutlines(state: GameState): Partial<Record<LotId, BossOutline>> {
  const playersById = new Map(state.players.map((p) => [p.id, p]));
  const result: Partial<Record<LotId, BossOutline>> = {};
  for (const group of allCasinos(state.board)) {
    const groupSet = new Set(group);
    const bossId = bossOf(state.board, group);
    const boss = bossId ? playersById.get(bossId) : null;
    const color = bossOutlineColor(boss?.color ?? null);
    for (const lotId of group) {
      result[lotId] = { color, edges: externalEdges(lotId, groupSet) };
    }
  }
  return result;
}

function bossOutlineShadow(outline: BossOutline): string {
  const { color, edges } = outline;
  const parts: string[] = [];
  // Soft outer halo so the ring reads on busy tile art.
  if (edges.n) parts.push(`0 -1px 0 0 ${color}`, `inset 0 2px 0 0 ${color}`);
  if (edges.s) parts.push(`0 1px 0 0 ${color}`, `inset 0 -2px 0 0 ${color}`);
  if (edges.w) parts.push(`-1px 0 0 0 ${color}`, `inset 2px 0 0 0 ${color}`);
  if (edges.e) parts.push(`1px 0 0 0 ${color}`, `inset -2px 0 0 0 ${color}`);
  return parts.join(", ");
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
  clickable: boolean;
  focused: boolean;
  overlayDie: BoardOverlayDie | null;
  bossOutline: BossOutline | null;
  longRoll: boolean;
  onClick?: (lotId: LotId) => void;
}

/** Re-render a cell only when its visible content or interactivity changes.
 * Snapshots arrive as fresh JSON (new object identities), so we compare the
 * fields that matter rather than references. */
function lotCellPropsEqual(a: LotCellProps, b: LotCellProps): boolean {
  return (
    a.lotId === b.lotId &&
    a.eligible === b.eligible &&
    a.clickable === b.clickable &&
    a.focused === b.focused &&
    a.onClick === b.onClick &&
    a.dieOwnerColor === b.dieOwnerColor &&
    a.parkingOwnerColor === b.parkingOwnerColor &&
    a.parkingOwnerName === b.parkingOwnerName &&
    a.overlayDie?.value === b.overlayDie?.value &&
    a.overlayDie?.color === b.overlayDie?.color &&
    a.overlayDie?.fromValue === b.overlayDie?.fromValue &&
    a.longRoll === b.longRoll &&
    a.bossOutline?.color === b.bossOutline?.color &&
    a.bossOutline?.edges.n === b.bossOutline?.edges.n &&
    a.bossOutline?.edges.e === b.bossOutline?.edges.e &&
    a.bossOutline?.edges.s === b.bossOutline?.edges.s &&
    a.bossOutline?.edges.w === b.bossOutline?.edges.w &&
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
  clickable: isClickable,
  focused,
  overlayDie,
  bossOutline,
  longRoll,
  onClick,
}: LotCellProps) {
  const lot = BOARD_LOTS[lotId];
  const clickable = isClickable && !!onClick;
  const displayDie = overlayDie ?? (tile.die && dieOwnerColor ? { value: tile.die.value, color: dieOwnerColor } : null);

  let content: React.ReactNode;
  let style: React.CSSProperties = {};

  if (tile.built && tile.color) {
    const casino = CASINOS[tile.color];
    const height = 1 + tile.risers;
    const tileArt = casino.tileImage;
    // Raised casinos read as stacked tiles via layered edge shadows.
    const stack =
      tile.risers > 0
        ? Array.from({ length: Math.min(tile.risers, 4) })
            .map((_, i) => `${(i + 1) * 1.5}px ${(i + 1) * 1.5}px 0 rgba(0,0,0,${0.32 - i * 0.05})`)
            .join(", ") + ","
        : "";
    style = tileArt
      ? {
          backgroundImage: `url(${tileArt})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: `${stack}0 1px 4px rgba(0,0,0,0.45)`,
        }
      : {
          background: `linear-gradient(155deg, ${casino.hex} 0%, ${casino.darkHex} 115%)`,
          boxShadow: `${stack}inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 1px ${casino.darkHex}`,
        };
    content = (
      <motion.div
        key={`built-${tile.color}`}
        initial={{ scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 17 }}
        className={`relative flex h-full w-full flex-col items-center justify-center ${
          tileArt ? "casino-tile casino-tile--art" : ""
        }`}
      >
        <span
          className={`absolute top-0.5 left-1 text-[8px] font-bold tracking-wide ${
            tileArt ? "rounded-sm bg-black/55 px-0.5 text-white/90" : "opacity-75"
          }`}
          style={tileArt ? undefined : { color: casino.textHex }}
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
        {displayDie ? (
          <motion.div
            key={overlayDie ? `overlay-${displayDie.value}` : "board-die"}
            initial={{ y: -14, scale: 1.3, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 16 }}
            className={overlayDie ? "reorg-preview-die" : undefined}
          >
            <RollingDie
              value={displayDie.value}
              color={displayDie.color}
              size={30}
              longRoll={longRoll || displayDie.fromValue !== undefined}
              fromValue={displayDie.fromValue}
              rollOnMount={displayDie.fromValue !== undefined}
            />
          </motion.div>
        ) : (
          <span
            className={`rounded-sm px-1 text-[8px] font-semibold uppercase tracking-wider ${
              tileArt ? "bg-black/50 text-white/80" : "opacity-70"
            }`}
            style={tileArt ? undefined : { color: casino.textHex, background: "rgba(0,0,0,0.22)" }}
          >
            no die
          </span>
        )}
      </motion.div>
    );
  } else {
    content = (
      <div className="parking-lot__inner">
        <ParkingLotMarkings className="parking-lot__markings" />
        <div className="parking-lot__meta">
          <span className="parking-lot__id">{lotId}</span>
          <span className="parking-lot__price">${lot.price}M</span>
          <span className="parking-lot__die">{lot.printedDie}</span>
        </div>
        {parkingOwnerColor && (
          <motion.span
            key={parkingOwnerColor}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="parking-lot__marker"
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

  const isParking = !tile.built;

  return (
    <motion.button
      type="button"
      disabled={!clickable}
      onClick={clickable ? () => onClick!(lotId) : undefined}
      whileHover={clickable ? { scale: 1.06, zIndex: 20 } : undefined}
      whileTap={clickable ? { scale: 0.97 } : undefined}
      className={`focus-ring relative h-full w-full select-none ${
        isParking ? "parking-lot" : "rounded-[3px]"
      } ${eligible ? "eligible-pulse z-10" : ""} ${focused ? "reorg-slot-focused z-10" : ""} ${
        clickable ? "cursor-pointer" : "cursor-default"
      }`}
      style={isParking ? undefined : style}
      aria-label={`Lot ${lotId}${eligible ? " (selectable)" : ""}`}
    >
      {content}
      {bossOutline && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] rounded-[3px]"
          style={{ boxShadow: bossOutlineShadow(bossOutline) }}
        />
      )}
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
  clickableLots,
  overlayDice,
  focusedLots,
  bossOutlines,
  reorganizedLots,
  onLotClick,
}: {
  state: GameState;
  block: BlockId;
  eligibleLots?: Set<LotId>;
  clickableLots?: Set<LotId>;
  overlayDice?: Partial<Record<LotId, BoardOverlayDie>>;
  focusedLots?: Set<LotId>;
  bossOutlines: Partial<Record<LotId, BossOutline>>;
  reorganizedLots: Set<LotId>;
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
            clickable={clickableLots?.has(lotId) ?? eligibleLots?.has(lotId) ?? false}
            focused={focusedLots?.has(lotId) ?? false}
            overlayDie={overlayDice?.[lotId] ?? null}
            bossOutline={bossOutlines[lotId] ?? null}
            longRoll={reorganizedLots.has(lotId)}
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
      <span className="board-street__palm board-street__palm--left" aria-hidden="true" />
      <span className="board-street__label neon-flicker">{name}</span>
      <span className="board-street__palm board-street__palm--right" aria-hidden="true" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export function Board({
  state,
  eligibleLots,
  clickableLots,
  overlayDice,
  focusedLots,
  onLotClick,
  className = "",
}: BoardProps) {
  const bossOutlines = useMemo(
    () => computeBossOutlines(state),
    [state.board, state.players],
  );
  const reorganizedLots = useMemo(
    () => new Set(state.turn?.reorganizedLots ?? []),
    [state.turn?.reorganizedLots],
  );

  // All sizes are expressed in fr units of one lot cell so every cell on the
  // board renders at exactly the same size: 3 cells per side column, 8 cell
  // rows per column, streets 0.35 and the Strip 0.65 of a cell. The fixed
  // aspect ratio keeps the cells square regardless of container size.
  return (
    <div className={`flex h-full min-h-0 items-center justify-center ${className}`}>
      <div
        className="board-vegas gold-rail grid h-full max-h-full w-auto max-w-full grid-cols-[3fr_0.65fr_3fr] overflow-visible rounded-xl p-2"
        style={{ aspectRatio: "6.65 / 8.7" }}
      >
        {/* Left column: A (2 rows), C (4 rows), E (2 rows) */}
        <div className="z-10 grid min-h-0 grid-rows-[2fr_0.35fr_4fr_0.35fr_2fr]">
          <Block
            state={state}
            block="A"
            eligibleLots={eligibleLots}
            clickableLots={clickableLots}
            overlayDice={overlayDice}
            focusedLots={focusedLots}
            bossOutlines={bossOutlines}
            reorganizedLots={reorganizedLots}
            onLotClick={onLotClick}
          />
          <Street name="Sahara Ave" connect="strip-right" />
          <Block
            state={state}
            block="C"
            eligibleLots={eligibleLots}
            clickableLots={clickableLots}
            overlayDice={overlayDice}
            focusedLots={focusedLots}
            bossOutlines={bossOutlines}
            reorganizedLots={reorganizedLots}
            onLotClick={onLotClick}
          />
          <Street name="Flamingo Rd" connect="strip-right" />
          <Block
            state={state}
            block="E"
            eligibleLots={eligibleLots}
            clickableLots={clickableLots}
            overlayDice={overlayDice}
            focusedLots={focusedLots}
            bossOutlines={bossOutlines}
            reorganizedLots={reorganizedLots}
            onLotClick={onLotClick}
          />
        </div>
        {/* The Strip */}
        <div className="strip-column relative z-0 flex min-h-0 items-center justify-center overflow-hidden rounded-md">
          <span className="strip-column__lights strip-column__lights--left" aria-hidden="true" />
          <div
            className="strip-neon absolute inset-y-2 left-1/2 w-px -translate-x-1/2"
            style={{
              background:
                "repeating-linear-gradient(to bottom, var(--accent) 0 10px, transparent 10px 22px)",
              opacity: 0.85,
            }}
          />
          <span className="strip-column__label neon-flicker">The Strip</span>
          <span className="strip-column__lights strip-column__lights--right" aria-hidden="true" />
        </div>
        {/* Right column: B (2 rows), D (3 rows), F (3 rows) */}
        <div className="z-10 grid min-h-0 grid-rows-[2fr_0.35fr_3fr_0.35fr_3fr]">
          <Block
            state={state}
            block="B"
            eligibleLots={eligibleLots}
            clickableLots={clickableLots}
            overlayDice={overlayDice}
            focusedLots={focusedLots}
            bossOutlines={bossOutlines}
            reorganizedLots={reorganizedLots}
            onLotClick={onLotClick}
          />
          <Street name="Sahara Ave" connect="strip-left" />
          <Block
            state={state}
            block="D"
            eligibleLots={eligibleLots}
            clickableLots={clickableLots}
            overlayDice={overlayDice}
            focusedLots={focusedLots}
            bossOutlines={bossOutlines}
            reorganizedLots={reorganizedLots}
            onLotClick={onLotClick}
          />
          <Street name="Harmon Ave" connect="strip-left" />
          <Block
            state={state}
            block="F"
            eligibleLots={eligibleLots}
            clickableLots={clickableLots}
            overlayDice={overlayDice}
            focusedLots={focusedLots}
            bossOutlines={bossOutlines}
            reorganizedLots={reorganizedLots}
            onLotClick={onLotClick}
          />
        </div>
      </div>
    </div>
  );
}
