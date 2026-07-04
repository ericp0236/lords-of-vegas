"use client";

/**
 * The Las Vegas board: 6 blocks flanking The Strip, cleaner digital redesign.
 * Renders purely from game state; interaction is delegated via `onLotClick`
 * with eligible lots highlighted by the parent.
 */

import { BLOCKS, BOARD_LOTS, lotsInBlock, type BlockId, type LotId } from "@/data/boardLots";
import { CASINOS } from "@/data/casinoCards";
import { PLAYER_COLORS } from "@/data/playerColors";
import type { GameState } from "@/engine/types";
import { DieFace } from "./DieFace";

export interface BoardProps {
  state: GameState;
  /** Lots the current interaction can target (highlighted + clickable) */
  eligibleLots?: Set<LotId>;
  onLotClick?: (lotId: LotId) => void;
  /** Compact = director side layouts; full = player view */
  className?: string;
}

function LotCell({
  state,
  lotId,
  eligible,
  onClick,
}: {
  state: GameState;
  lotId: LotId;
  eligible: boolean;
  onClick?: (lotId: LotId) => void;
}) {
  const lot = BOARD_LOTS[lotId];
  const tile = state.board[lotId];
  const player = tile.parkingOwner
    ? state.players.find((p) => p.id === tile.parkingOwner)
    : null;
  const dieOwner = tile.die ? state.players.find((p) => p.id === tile.die!.owner) : null;

  const base =
    "relative aspect-square rounded-md flex flex-col items-center justify-center select-none transition-shadow";
  const clickable = eligible && onClick;

  let style: React.CSSProperties = {};
  let content: React.ReactNode;

  if (tile.built && tile.color) {
    const casino = CASINOS[tile.color];
    style = {
      background: `linear-gradient(160deg, ${casino.hex} 0%, ${casino.darkHex} 100%)`,
      boxShadow: eligible ? "0 0 0 2px var(--accent)" : `inset 0 0 0 1px ${casino.darkHex}`,
    };
    content = (
      <>
        <span
          className="absolute top-0.5 left-1 text-[9px] font-semibold opacity-80"
          style={{ color: casino.textHex }}
        >
          {lotId}
        </span>
        {tile.risers > 0 && (
          <span
            className="absolute top-0.5 right-1 rounded-sm px-1 text-[9px] font-bold"
            style={{ background: "rgba(0,0,0,0.4)", color: "#fff" }}
            title={`Height ${1 + tile.risers}`}
          >
            ×{1 + tile.risers}
          </span>
        )}
        {tile.die && dieOwner ? (
          <DieFace value={tile.die.value} color={dieOwner.color} size={30} />
        ) : (
          <span className="text-[9px] font-medium opacity-70" style={{ color: casino.textHex }}>
            no die
          </span>
        )}
      </>
    );
  } else {
    style = {
      background: "var(--asphalt)",
      boxShadow: eligible
        ? "0 0 0 2px var(--accent)"
        : "inset 0 0 0 1px rgba(255,255,255,0.07)",
    };
    content = (
      <>
        <span className="text-[10px] font-bold text-white/80">{lotId}</span>
        <span className="text-[9px] text-white/50">${lot.price}M</span>
        <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[9px] font-bold text-white/70">
          {lot.printedDie}
        </span>
        {player && (
          <span
            className="absolute bottom-0.5 right-0.5 h-3.5 w-5 rounded-[3px] border border-white/40"
            style={{ background: PLAYER_COLORS[player.color].hex }}
            title={`${player.name}'s lot`}
          />
        )}
      </>
    );
  }

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? () => onClick!(lotId) : undefined}
      className={`${base} ${clickable ? "cursor-pointer hover:brightness-125" : "cursor-default"}`}
      style={style}
      aria-label={`Lot ${lotId}`}
    >
      {content}
    </button>
  );
}

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
      className="grid gap-1 rounded-lg p-1.5"
      style={{
        gridTemplateColumns: `repeat(${geo.cols}, minmax(0, 1fr))`,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      {lotsInBlock(block).map((lotId) => (
        <LotCell
          key={lotId}
          state={state}
          lotId={lotId}
          eligible={eligibleLots?.has(lotId) ?? false}
          onClick={onLotClick}
        />
      ))}
    </div>
  );
}

function Street({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center py-0.5">
      <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">{name}</span>
    </div>
  );
}

export function Board({ state, eligibleLots, onLotClick, className = "" }: BoardProps) {
  return (
    <div className={`rounded-xl bg-[var(--strip)] p-3 ${className}`}>
      <div className="grid grid-cols-[1fr_44px_1fr] gap-x-1">
        {/* Left column: A, C, E */}
        <div className="flex flex-col justify-between">
          <Block state={state} block="A" eligibleLots={eligibleLots} onLotClick={onLotClick} />
          <Street name="Sahara Ave" />
          <Block state={state} block="C" eligibleLots={eligibleLots} onLotClick={onLotClick} />
          <Street name="Flamingo Rd" />
          <Block state={state} block="E" eligibleLots={eligibleLots} onLotClick={onLotClick} />
        </div>
        {/* The Strip */}
        <div className="relative mx-0.5 flex items-center justify-center rounded-md bg-gradient-to-b from-[#171d2e] via-[#1b2338] to-[#171d2e]">
          <div
            className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2"
            style={{
              background:
                "repeating-linear-gradient(to bottom, var(--accent) 0 10px, transparent 10px 22px)",
              opacity: 0.7,
            }}
          />
          <span
            className="rotate-180 text-[11px] font-bold uppercase tracking-[0.4em] text-[var(--accent)]"
            style={{ writingMode: "vertical-rl" }}
          >
            The Strip
          </span>
        </div>
        {/* Right column: B, D, F */}
        <div className="flex flex-col justify-between">
          <Block state={state} block="B" eligibleLots={eligibleLots} onLotClick={onLotClick} />
          <Street name="Sahara Ave" />
          <Block state={state} block="D" eligibleLots={eligibleLots} onLotClick={onLotClick} />
          <Street name="Harmon Ave" />
          <Block state={state} block="F" eligibleLots={eligibleLots} onLotClick={onLotClick} />
        </div>
      </div>
    </div>
  );
}
