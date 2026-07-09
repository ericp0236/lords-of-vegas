"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";
import {
  CASINOS,
  type CasinoColor,
  type PayTarget,
  type PropertyCard,
} from "@/data/casinoCards";
import { playSound } from "@/lib/sound/SoundManager";
import { AnimatedNumber } from "./ui/AnimatedNumber";

export const CARD_BACK = "/cards/card-back.png";

/** Night-time building illustrations shown on drawn property cards. */
export const CASINO_CARD_ART: Record<PayTarget, string> = {
  albion: "/art/cards/albion.webp",
  sphinx: "/art/cards/sphinx.webp",
  vega: "/art/cards/vega.webp",
  tivoli: "/art/cards/tivoli.webp",
  pioneer: "/art/cards/pioneer.webp",
  strip: "/art/cards/strip.webp",
};

const FLIP_TRANSITION = { duration: 0.38, ease: [0.4, 0, 0.2, 1] as const };

const FACE_VISIBLE = { rotateY: 0, opacity: 1, scale: 1 };
const FACE_HIDDEN = { rotateY: -88, opacity: 0, scale: 0.94 };
const BACK_VISIBLE = { rotateY: 0, opacity: 1, scale: 1 };
const BACK_HIDDEN = { rotateY: 88, opacity: 0, scale: 0.94 };

function deckLabel(pays: PayTarget): string {
  return pays === "strip" ? "The Strip" : CASINOS[pays].name;
}

export function PropertyCardFace({ card }: { card: PropertyCard }) {
  const isStrip = card.pays === "strip";
  const casino = !isStrip ? CASINOS[card.pays as CasinoColor] : null;
  const bg = isStrip ? "var(--accent)" : casino!.hex;
  const dark = isStrip ? "#a67c00" : casino!.darkHex;
  const fg = isStrip ? "#1a1408" : casino!.textHex;
  const label = deckLabel(card.pays);

  return (
    <div
      className={`deck-card-face deck-card-face--${isStrip ? "strip" : card.pays}`}
      style={{
        "--card-bg": bg,
        "--card-dark": dark,
        "--card-fg": fg,
      } as CSSProperties}
    >
      <span className="deck-card-face__corner deck-card-face__corner--tl" aria-hidden="true" />
      <span className="deck-card-face__corner deck-card-face__corner--tr" aria-hidden="true" />
      <span className="deck-card-face__corner deck-card-face__corner--bl" aria-hidden="true" />
      <span className="deck-card-face__corner deck-card-face__corner--br" aria-hidden="true" />

      {card.isGameOver ? (
        <div className="deck-card-face__game-over">
          <span className="deck-card-face__game-over-icon" aria-hidden="true">
            ★
          </span>
          <span className="deck-card-face__game-over-title">Game Over</span>
          <span className="deck-card-face__game-over-sub">Final scoring</span>
        </div>
      ) : (
        <>
          <div className="deck-card-face__body">
            <span className="deck-card-face__lot">{card.lotId}</span>
            <div className="deck-card-face__glyph-panel deck-card-face__glyph-panel--art">
              <Image
                src={CASINO_CARD_ART[card.pays]}
                alt=""
                fill
                sizes="200px"
                className="deck-card-face__art"
                aria-hidden
              />
            </div>
          </div>

          <footer className="deck-card-face__footer">
            <span className="deck-card-face__pays">{label} pays</span>
          </footer>
        </>
      )}
    </div>
  );
}

function CardBack({ ready }: { ready: boolean }) {
  return (
    <div className={`deck-column__card ${ready ? "deck-column__card--ready" : ""}`}>
      <Image
        src={CARD_BACK}
        alt=""
        width={120}
        height={168}
        className="deck-column__card-art"
        priority
      />
      {ready && <span className="deck-column__draw-hint">Draw</span>}
    </div>
  );
}

export function PropertyDeckCard({
  drawnCard,
  canDraw,
  deckCount,
  onDraw,
  compact = false,
}: {
  drawnCard: PropertyCard | null;
  canDraw: boolean;
  deckCount: number;
  onDraw?: () => void;
  compact?: boolean;
}) {
  /** Persists through the hide animation after drawnCard clears on end turn. */
  const [faceCard, setFaceCard] = useState<PropertyCard | null>(drawnCard);
  const isRevealed = !!drawnCard;

  useEffect(() => {
    if (drawnCard) setFaceCard(drawnCard);
  }, [drawnCard]);

  // Safety net if onAnimationComplete doesn't fire (e.g. reduced motion).
  useEffect(() => {
    if (!drawnCard && faceCard) {
      const t = window.setTimeout(() => setFaceCard(null), 450);
      return () => window.clearTimeout(t);
    }
  }, [drawnCard, faceCard]);

  const showFace = !!faceCard;
  const clickable = canDraw && !drawnCard && !!onDraw;

  const cardSlot = (
    <div className="deck-card-slot">
      <AnimatePresence mode="wait" initial={false}>
        {showFace ? (
          <motion.div
            key={faceCard!.id}
            className="deck-card-slot__layer"
            initial={BACK_HIDDEN}
            animate={isRevealed ? FACE_VISIBLE : FACE_HIDDEN}
            exit={FACE_HIDDEN}
            transition={FLIP_TRANSITION}
            style={{ transformPerspective: 900 }}
            onAnimationComplete={() => {
              if (!drawnCard) setFaceCard(null);
            }}
          >
            <div className="deck-column__card deck-column__card--face">
              <PropertyCardFace card={faceCard!} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="back"
            className="deck-card-slot__layer"
            initial={BACK_HIDDEN}
            animate={BACK_VISIBLE}
            exit={BACK_HIDDEN}
            transition={FLIP_TRANSITION}
            style={{ transformPerspective: 900 }}
          >
            <CardBack ready={clickable} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="deck-column">
      <div
        className={`deck-column__draw-btn ${clickable ? "deck-column__draw-btn--ready" : ""}`}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-label={clickable ? `Draw a property card (${deckCount} left in deck)` : undefined}
        title={!clickable ? `${deckCount} cards in deck` : undefined}
        onClick={
          clickable
            ? () => {
                playSound("cardDraw");
                onDraw!();
              }
            : undefined
        }
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  playSound("cardDraw");
                  onDraw!();
                }
              }
            : undefined
        }
      >
        {cardSlot}
      </div>

      {!compact && (
        <div className="deck-discards__count-panel">
          <span className="deck-discards__count-rule" aria-hidden="true" />
          <div className="deck-discards__count-inner">
            <AnimatedNumber value={deckCount} className="deck-discards__count-value" />
            <span className="deck-discards__count-label">cards in deck</span>
          </div>
          <span className="deck-discards__count-rule" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
