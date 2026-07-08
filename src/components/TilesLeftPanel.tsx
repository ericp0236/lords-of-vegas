"use client";

import { CASINOS, CASINO_COLOR_KEYS, TILES_PER_COLOR, type CasinoColor } from "@/data/casinoCards";
import type { GameState } from "@/engine/types";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import { Panel } from "./ui/Panel";

export function TilesLeftPanel({
  state,
  className = "",
}: {
  state: GameState;
  className?: string;
}) {
  return (
    <Panel title="Tiles Left" className={className} bodyClassName="p-0 pt-0">
      <ul className="tiles-left-panel__rows">
        {CASINO_COLOR_KEYS.map((key) => (
          <TileSupplyRow key={key} casino={key} remaining={state.tileSupply[key]} />
        ))}
      </ul>

      <footer className="tiles-left-panel__footer">
        <span className="tiles-left-panel__footer-icon" aria-hidden="true">
          ◆
        </span>
        Higher numbers mean more tiles remaining
      </footer>
    </Panel>
  );
}

/** Compact inline supply — used in modals / pickers. */
export function TileSupply({
  state,
  className = "",
}: {
  state: GameState;
  className?: string;
}) {
  return <TilesLeftPanel state={state} className={className} />;
}

function TileSupplyRow({
  casino,
  remaining,
}: {
  casino: CasinoColor;
  remaining: number;
}) {
  const meta = CASINOS[casino];

  return (
    <li className={`tiles-left-row tiles-left-row--${casino}`} title={`${meta.name}: ${remaining} tiles left`}>
      <div className="tiles-left-row__emblem" aria-hidden="true">
        <CasinoEmblem casino={casino} />
      </div>

      <div className="tiles-left-row__copy">
        <span className="tiles-left-row__name">{meta.name}</span>
        <span className="tiles-left-row__tagline">{meta.tagline}</span>
      </div>

      <div className="tiles-left-row__track" aria-hidden="true">
        {Array.from({ length: TILES_PER_COLOR }, (_, i) => (
          <span
            key={i}
            className={`tiles-left-diamond${i < remaining ? " tiles-left-diamond--lit" : ""}`}
          />
        ))}
      </div>

      <div className="tiles-left-row__count">
        <AnimatedNumber value={remaining} />
      </div>
    </li>
  );
}

function CasinoEmblem({ casino }: { casino: CasinoColor }) {
  switch (casino) {
    case "albion":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="13" r="6.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M8.5 11.5c1-2.5 2.8-3.8 3.5-3.8s2.5 1.3 3.5 3.8"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path d="M10 8.5l1-2.2M14 8.5l-1-2.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M9 14.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "sphinx":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M6 17c0-4 2.5-7 6-7s6 3 6 7"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M8.5 10.5c.8-2.2 2-3.5 3.5-3.5s2.7 1.3 3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path d="M10 7.5h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="10.5" cy="11" r="0.7" fill="currentColor" />
          <circle cx="13.5" cy="11" r="0.7" fill="currentColor" />
        </svg>
      );
    case "vega":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M12 4l2.2 6.8H21l-5.5 4 2.1 6.7L12 17.4 6.4 21.5l2.1-6.7L3 10.8h6.8L12 4z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "tivoli":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M8 17V8h8v9" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M7 8h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M9.5 8V6.5h5V8" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M10 11h1.2M13 11h1.2M10 14h1.2M13 14h1.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );
    case "pioneer":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="5" y="11" width="12" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 11V9.5h3.5l1.5-2h2l1.5 2H17V11" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="8.5" cy="17" r="1.3" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="15.5" cy="17" r="1.3" stroke="currentColor" strokeWidth="1.1" />
          <path d="M5 13.5H4M20 13.5h-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );
  }
}
