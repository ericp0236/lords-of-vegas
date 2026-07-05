"use client";

import { motion } from "motion/react";
import { CASINOS, type CasinoColor } from "@/data/casinoCards";
import type { GameState } from "@/engine/types";
import { playSound } from "@/lib/sound/SoundManager";
import { AnimatedNumber } from "./ui/AnimatedNumber";

const ORDER: (CasinoColor | "strip")[] = [
  "albion",
  "sphinx",
  "vega",
  "tivoli",
  "pioneer",
  "strip",
];

export function DiscardPiles({
  state,
  canDraw = false,
  onDraw,
  compact = false,
}: {
  state: GameState;
  /** When true, the card back becomes the draw button. */
  canDraw?: boolean;
  onDraw?: () => void;
  /** Stack pills vertically without the card (Director view). */
  compact?: boolean;
}) {
  return (
    <div className={`deck-discards ${compact ? "deck-discards--compact" : ""}`}>
      <div className="deck-discards__list">
        {ORDER.map((deck) => {
          const count = state.discard[deck]?.length ?? 0;
          const isStrip = deck === "strip";
          const label = isStrip ? "Strip" : CASINOS[deck as CasinoColor].name;
          const tone = isStrip ? "strip" : deck;
          return (
            <div
              key={deck}
              className={`discard-pill discard-pill--${tone}`}
              title={`${label} discards: ${count}`}
            >
              <span>{label}</span>
              <AnimatedNumber value={count} className="discard-pill__count" />
            </div>
          );
        })}
        {compact && (
          <div className="discard-pill discard-pill--deck" title={`Cards remaining: ${state.deck.length}`}>
            <span>Deck</span>
            <AnimatedNumber value={state.deck.length} className="discard-pill__count" />
          </div>
        )}
      </div>

      {!compact && (
        <DeckCardBack canDraw={canDraw} deckCount={state.deck.length} onDraw={onDraw} />
      )}
    </div>
  );
}

function DeckCardBack({
  canDraw,
  deckCount,
  onDraw,
}: {
  canDraw: boolean;
  deckCount: number;
  onDraw?: () => void;
}) {
  const inner = (
    <>
      <CardBackArt />
      <AnimatedNumber value={deckCount} className="deck-card-back__count" />
      {canDraw && <span className="deck-card-back__hint">Draw</span>}
    </>
  );

  if (canDraw && onDraw) {
    return (
      <div className="deck-card-slot deck-card-slot--ready">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 24 }}
          onClick={() => {
            playSound("cardDraw");
            onDraw();
          }}
          className="deck-card-back deck-card-back--interactive focus-ring"
          aria-label={`Draw a property card (${deckCount} left in deck)`}
        >
          {inner}
        </motion.button>
      </div>
    );
  }

  return (
    <div className="deck-card-slot" title={`${deckCount} cards in deck`}>
      <div className="deck-card-back">{inner}</div>
    </div>
  );
}

function CardBackArt() {
  return (
    <>
      <svg className="deck-card-back__filigree" viewBox="0 0 100 140" aria-hidden="true">
        <circle cx="50" cy="70" r="34" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.35" />
        <circle cx="50" cy="70" r="26" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.28" />
        <circle cx="50" cy="70" r="18" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.22" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 50 70)`}>
            <path
              d="M50 38c2 0 3.5 1.5 3.5 3.5s-1.5 3.5-3.5 3.5-3.5-1.5-3.5-3.5 1.5-3.5 3.5-3.5z"
              fill="currentColor"
              opacity="0.35"
            />
          </g>
        ))}
      </svg>
      <div className="deck-card-back__title">
        <span>Lords</span>
        <span>Vegas</span>
      </div>
    </>
  );
}

export function TileSupply({
  state,
  className = "flex-wrap",
}: {
  state: GameState;
  className?: string;
}) {
  return (
    <div className={`flex gap-1.5 ${className}`}>
      {(Object.keys(CASINOS) as CasinoColor[]).map((c) => (
        <div
          key={c}
          className="flex items-center justify-between gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
          style={{ background: CASINOS[c].hex, color: CASINOS[c].textHex }}
          title={`${CASINOS[c].name} tiles remaining`}
        >
          {CASINOS[c].name}
          <AnimatedNumber
            value={state.tileSupply[c]}
            className="rounded-sm bg-black/25 px-1 font-mono text-white"
          />
        </div>
      ))}
    </div>
  );
}
