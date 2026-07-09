"use client";

import { type PayTarget, type PropertyCard } from "@/data/casinoCards";
import type { GameState } from "@/engine/types";
import { PropertyDeckCard } from "./PropertyDeckCard";
import { AnimatedNumber } from "./ui/AnimatedNumber";

const ORDER: PayTarget[] = [
  "albion",
  "sphinx",
  "vega",
  "tivoli",
  "pioneer",
  "strip",
];

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
          <AnimatedNumber value={state.deck.length} className="deck-discards__count-value" />
          <span className="deck-discards__count-label">cards in deck</span>
        </div>
      )}
    </div>
  );
}

function DiscardRow({ deck, count }: { deck: PayTarget; count: number }) {
  const label = ROW_LABELS[deck];
  return (
    <div
      className={`discard-row discard-row--${deck}`}
      title={`${label}: ${count} discarded`}
    >
      <span className="discard-row__name">{label}</span>
      <DiscardCountBadge count={count} />
    </div>
  );
}

function DiscardCountBadge({ count }: { count: number }) {
  return (
    <div
      className={`discard-count-badge${count === 0 ? " discard-count-badge--empty" : ""}`}
      aria-label={`${count} cards discarded`}
    >
      <span className="discard-count-badge__back" aria-hidden="true" />
      <span className="discard-count-badge__front" aria-hidden="true">
        <AnimatedNumber value={count} />
      </span>
    </div>
  );
}
