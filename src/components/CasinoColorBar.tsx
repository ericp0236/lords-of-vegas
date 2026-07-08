"use client";

import { useEffect, type CSSProperties } from "react";
import { motion } from "motion/react";
import type { LotId } from "@/data/boardLots";
import {
  CASINOS,
  CASINO_COLOR_KEYS,
  TILES_PER_COLOR,
  type CasinoColor,
} from "@/data/casinoCards";
import type { GameState } from "@/engine/types";
import { playSound } from "@/lib/sound/SoundManager";

/** Inline bottom bar for choosing a casino color while the board stays visible. */
export function CasinoColorBar({
  lotId,
  action,
  priceLabel,
  state,
  minTiles,
  exclude,
  onPick,
  onClose,
}: {
  lotId: LotId;
  action: "build" | "remodel";
  priceLabel: string;
  state: GameState;
  minTiles: number;
  exclude?: CasinoColor;
  onPick: (color: CasinoColor) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const heading = action === "build" ? "Build on" : "Remodel at";

  return (
    <div
      className="casino-color-bar w-full max-h-[min(42vh,220px)] shrink-0 overflow-hidden"
      role="region"
      aria-label={`${heading} ${lotId}`}
    >
      <header className="casino-color-bar__header">
        <div className="casino-color-bar__header-main">
          <ActionIcon action={action} />
          <span className="casino-color-bar__heading">
            {heading} <span className="casino-color-bar__lot">{lotId}</span>
          </span>
          <span className="casino-color-bar__price">{priceLabel}</span>
        </div>
        <button
          type="button"
          className="casino-color-bar__close focus-ring"
          aria-label="Cancel"
          onClick={() => {
            playSound("close");
            onClose();
          }}
        >
          ×
        </button>
      </header>

      <div className="casino-color-bar__cards scrollbar-thin">
        {CASINO_COLOR_KEYS.map((c, i) => {
          const meta = CASINOS[c];
          const supply = state.tileSupply[c];
          const discarded = state.discard[c]?.length ?? 0;
          const cardsRemaining = TILES_PER_COLOR - discarded;
          const disabled = c === exclude || supply < minTiles;
          const noTiles = supply < minTiles;
          const isExcluded = c === exclude;
          const needs = minTiles > 1 ? `${minTiles} tiles` : "1 tile";
          const disabledReason = isExcluded
            ? "Current casino color"
            : noTiles
              ? supply === 0
                ? "No tiles left in supply"
                : `Need ${needs}, ${supply} left`
              : undefined;

          return (
            <motion.button
              key={c}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={disabled ? undefined : { y: -2 }}
              whileTap={disabled ? undefined : { scale: 0.98 }}
              disabled={disabled}
              title={disabledReason}
              onClick={() => {
                playSound("chip");
                onPick(c);
              }}
              className={`casino-color-bar__card casino-color-bar__card--${c} focus-ring${
                disabled ? (noTiles ? " casino-color-bar__card--sold-out" : " casino-color-bar__card--disabled") : ""
              }`}
              style={
                {
                  "--casino-accent": meta.hex,
                  "--casino-accent-deep": meta.darkHex,
                  "--casino-text": meta.textHex,
                } as CSSProperties
              }
            >
              <span className="casino-color-bar__card-name">{meta.name}</span>

              <div className="casino-color-bar__card-art">
                <span className="casino-color-bar__card-glow" aria-hidden="true" />
                {meta.tileImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.tileImage}
                    alt=""
                    width={64}
                    height={64}
                    className="casino-color-bar__card-image"
                    aria-hidden
                  />
                )}
              </div>

              {isExcluded && <span className="casino-color-bar__ribbon">Current</span>}

              <div className="casino-color-bar__metrics">
                <MetricBadge kind="tile" value={supply} soldOut={noTiles && !isExcluded && supply === 0} />
                <MetricBadge kind="card" value={cardsRemaining} />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function ActionIcon({ action }: { action: "build" | "remodel" }) {
  if (action === "remodel") {
    return (
      <svg
        className="casino-color-bar__action-icon"
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M13.5 6.5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      className="casino-color-bar__action-icon"
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 18V8l4-2v12M8 6l8-3v12M16 5l4 2v10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 10h1M14 9h1M11 14h1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3 18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MetricBadge({
  kind,
  value,
  soldOut = false,
}: {
  kind: "tile" | "card";
  value: number;
  soldOut?: boolean;
}) {
  const label = kind === "tile" ? "Tiles" : "Cards";

  return (
    <div className="casino-color-bar__metric" aria-label={`${label}: ${value}`}>
      {kind === "tile" ? (
        <span
          className={`casino-color-bar__tile-badge${soldOut ? " casino-color-bar__tile-badge--sold-out" : ""}`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 32 32"
            width={34}
            height={34}
            className="casino-color-bar__tile-badge-svg"
          >
            <path
              d="M16 3 L29 16 L16 29 L3 16 Z"
              className="casino-color-bar__tile-badge-shape"
            />
          </svg>
          <span className="casino-color-bar__tile-badge-num">{value}</span>
        </span>
      ) : (
        <span className="casino-color-bar__card-badge" aria-hidden="true">
          <span className="casino-color-bar__card-badge-back" />
          <span className="casino-color-bar__card-badge-front">{value}</span>
        </span>
      )}
      <span className="casino-color-bar__metric-label">{label}</span>
    </div>
  );
}
