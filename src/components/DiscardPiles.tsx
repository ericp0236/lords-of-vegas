"use client";

import Image from "next/image";
import { type PayTarget, type PropertyCard } from "@/data/casinoCards";
import type { GameState } from "@/engine/types";
import { CARD_BACK, CASINO_GLYPHS, PropertyDeckCard } from "./PropertyDeckCard";
import { AnimatedNumber } from "./ui/AnimatedNumber";

const ORDER: PayTarget[] = [
  "albion",
  "sphinx",
  "vega",
  "tivoli",
  "pioneer",
  "strip",
];

/** Max discard slots shown per deck row (matches physical deck sizes). */
const SLOT_COUNTS: Record<PayTarget, number> = {
  albion: 9,
  sphinx: 9,
  vega: 9,
  tivoli: 9,
  pioneer: 9,
  strip: 4,
};

const ROW_LABELS: Record<PayTarget, string> = {
  albion: "Albion",
  sphinx: "Sphinx",
  vega: "Vega",
  tivoli: "Tivoli",
  pioneer: "Pioneer",
  strip: "The Strip",
};

export function DiscardPiles({
  state,
  drawnCard = null,
  canDraw = false,
  onDraw,
  compact = false,
  showHeader = true,
}: {
  state: GameState;
  drawnCard?: PropertyCard | null;
  canDraw?: boolean;
  onDraw?: () => void;
  /** Smaller card slots for tight layouts. */
  compact?: boolean;
  /** Ornate section title (omit when a parent already provides one). */
  showHeader?: boolean;
}) {
  return (
    <div className={`deck-discards ${compact ? "deck-discards--compact" : ""}`}>
      {showHeader && (
        <header className="deck-discards__header">
          <span className="deck-discards__header-diamond" aria-hidden="true" />
          <h3 className="deck-discards__title">Deck &amp; Discards</h3>
          <span className="deck-discards__header-diamond" aria-hidden="true" />
        </header>
      )}

      <div className="deck-discards__body">
        <div className="deck-discards__rows">
          {ORDER.map((deck) => (
            <DiscardRow
              key={deck}
              deck={deck}
              count={state.discard[deck]?.length ?? 0}
              slots={SLOT_COUNTS[deck]}
            />
          ))}
        </div>

        {!compact && (
          <PropertyDeckCard
            drawnCard={drawnCard}
            canDraw={canDraw}
            deckCount={state.deck.length}
            onDraw={onDraw}
          />
        )}
      </div>

      {compact && (
        <div className="deck-discards__compact-count">
          <span className="deck-discards__count-label">Cards in deck</span>
          <AnimatedNumber value={state.deck.length} className="deck-discards__count-value" />
        </div>
      )}
    </div>
  );
}

function DiscardRow({
  deck,
  count,
  slots,
}: {
  deck: PayTarget;
  count: number;
  slots: number;
}) {
  const label = ROW_LABELS[deck];
  return (
    <div
      className={`discard-row discard-row--${deck}`}
      title={`${label}: ${count} discarded`}
    >
      <div className="discard-row__icon-wrap">
        <Image
          src={CASINO_GLYPHS[deck]}
          alt=""
          width={40}
          height={40}
          className="discard-row__icon"
          aria-hidden
        />
      </div>
      <span className="discard-row__name">{label}</span>
      <div className="discard-row__slots" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
        {Array.from({ length: slots }, (_, i) => (
          <div
            key={i}
            className={`discard-slot ${i < count ? "discard-slot--filled" : "discard-slot--empty"}`}
          >
            {i < count && (
              <Image
                src={CARD_BACK}
                alt=""
                width={24}
                height={34}
                className="discard-slot__card"
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
