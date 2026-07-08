"use client";

import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { actionHintTitle, ACTION_HINTS } from "@/lib/actionHints";
import { playSound } from "@/lib/sound/SoundManager";
import { ActionHintPopover, type HintAlign } from "./ActionHintPopover";

const HINT_HOVER_DELAY_MS = 850;

export type ActionTileKind =
  | "build"
  | "sprawl"
  | "remodel"
  | "raise"
  | "reorganize"
  | "gamble";

const LABELS: Record<ActionTileKind, string> = {
  build: "Build",
  sprawl: "Sprawl",
  remodel: "Remodel",
  raise: "Raise",
  reorganize: "Reorganize",
  gamble: "Gamble",
};

export function ActionTileButton({
  kind,
  active = false,
  disabled = false,
  playerCount,
  hintAlign = "center",
  onClick,
  className = "",
}: {
  kind: ActionTileKind;
  active?: boolean;
  disabled?: boolean;
  /** Used to show max raise height in the hover hint. */
  playerCount?: number;
  /** Horizontal alignment of the hover hint relative to the button. */
  hintAlign?: HintAlign;
  onClick: () => void;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [useNativeHintTitle, setUseNativeHintTitle] = useState(false);
  const hint = ACTION_HINTS[kind];
  const costLabel =
    kind === "raise" && playerCount
      ? `${hint.cost} (max height ${playerCount})`
      : hint.cost;

  function clearHintTimer() {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }

  function scheduleHint() {
    clearHintTimer();
    hintTimerRef.current = setTimeout(() => setHintOpen(true), HINT_HOVER_DELAY_MS);
  }

  function hideHint() {
    clearHintTimer();
    setHintOpen(false);
  }

  function handleFocus(e: FocusEvent<HTMLButtonElement>) {
    // Clicks focus the button but shouldn't surface the hover tip.
    if (e.target.matches(":focus-visible")) scheduleHint();
  }

  useEffect(() => () => clearHintTimer(), []);

  // Native title tooltips duplicate the custom popover on hover-capable devices.
  useEffect(() => {
    setUseNativeHintTitle(!window.matchMedia("(hover: hover)").matches);
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`action-hint-wrap ${className}`}
      onMouseEnter={scheduleHint}
      onMouseLeave={hideHint}
    >
      <motion.button
        type="button"
        whileTap={disabled ? undefined : { scale: 0.96 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        disabled={disabled}
        onFocus={handleFocus}
        onBlur={hideHint}
        onClick={() => {
          hideHint();
          if (disabled) return;
          playSound("click");
          onClick();
        }}
        aria-pressed={active}
        aria-label={LABELS[kind]}
        title={useNativeHintTitle ? actionHintTitle(kind, playerCount) : undefined}
        className={`action-tile action-tile--${kind} focus-ring ${active ? "action-tile--active" : ""}`}
      >
        <span className="action-tile__icon" aria-hidden="true">
          <ActionIcon kind={kind} />
        </span>
        <span className="action-tile__label">{LABELS[kind]}</span>
      </motion.button>
      <ActionHintPopover
        anchorRef={wrapRef}
        open={hintOpen}
        summary={hint.summary}
        costLabel={costLabel}
        align={hintAlign}
      />
    </div>
  );
}

export function ActionBarButton({
  children,
  onClick,
  variant = "default",
  className = "",
  sound = "click",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "default" | "ghost";
  className?: string;
  sound?: "click" | "close" | null;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      onClick={() => {
        if (sound) playSound(sound);
        onClick();
      }}
      className={`action-bar-btn action-bar-btn--${variant} focus-ring ${className}`}
    >
      <span className="action-bar-btn__label">{children}</span>
    </motion.button>
  );
}

/** Full-width gold-framed End Turn bar (sidebar + mobile dock). */
export function EndTurnButton({
  onClick,
  disabled = false,
  className = "",
  staticDisplay = false,
}: {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** Read-only preview (Director view). */
  staticDisplay?: boolean;
}) {
  const content = (
    <>
      <span className="end-turn-btn__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M5.5 12.5l4.2 4.2L18.5 8"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="end-turn-btn__label">End Turn</span>
    </>
  );

  if (staticDisplay) {
    return (
      <div
        className={`end-turn-btn end-turn-btn--static ${className}`}
        aria-hidden="true"
      >
        {content}
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        playSound("click");
        onClick?.();
      }}
      className={`end-turn-btn focus-ring ${className}`}
      aria-label="End turn"
    >
      {content}
    </motion.button>
  );
}

function ActionIcon({ kind }: { kind: ActionTileKind }) {
  switch (kind) {
    case "build":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M6 20V9l6-4 6 4v11"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M9 20v-5h6v5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M10 11h1.2M13 11h1.2M10 14h1.2M13 14h1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "sprawl":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 12V6M12 12l-3.5-3.5M12 12l3.5-3.5M12 12v6M12 12l-3.5 3.5M12 12l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 4.5l1.2 1.2M12 4.5l-1.2 1.2M19.5 12l-1.2 1.2M19.5 12l-1.2-1.2M12 19.5l1.2-1.2M12 19.5l-1.2-1.2M4.5 12l1.2 1.2M4.5 12l1.2-1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "remodel":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M5.5 18.5l8.5-8.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M12.5 7.5l4.5-4.5 2.5 2.5-4.5 4.5z"
            fill="currentColor"
            fillOpacity="0.45"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M16 4l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "raise":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5l-6 8h4v6h4v-6h4L12 5z"
            fill="currentColor"
            fillOpacity="0.35"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "reorganize":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M18 8a6 6 0 10-2.2 4.6M6 16a6 6 0 102.2-4.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M16 4h2v4h-4M8 20H6v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "gamble":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="6.5" cy="8" r="0.9" fill="currentColor" />
          <circle cx="8.8" cy="10.2" r="0.9" fill="currentColor" />
          <rect x="12.5" y="11" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="15.5" cy="14" r="0.9" fill="currentColor" />
          <circle cx="17.8" cy="16.2" r="0.9" fill="currentColor" />
        </svg>
      );
  }
}
