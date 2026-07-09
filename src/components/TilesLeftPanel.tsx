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
      <span className="tiles-left-row__name">{meta.name}</span>

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
