import { CASINOS, type CasinoColor } from "@/data/casinoCards";
import type { GameState } from "@/engine/types";

const ORDER: (CasinoColor | "strip")[] = [
  "albion",
  "sphinx",
  "vega",
  "tivoli",
  "pioneer",
  "strip",
];

export function DiscardPiles({ state }: { state: GameState }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ORDER.map((deck) => {
        const count = state.discard[deck]?.length ?? 0;
        const isStrip = deck === "strip";
        const label = isStrip ? "Strip" : CASINOS[deck as CasinoColor].name;
        const bg = isStrip ? "var(--accent)" : CASINOS[deck as CasinoColor].hex;
        const fg = isStrip ? "#1a1a1a" : CASINOS[deck as CasinoColor].textHex;
        return (
          <div
            key={deck}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: bg, color: fg }}
            title={`${label} discards: ${count}`}
          >
            {label}
            <span className="rounded-sm bg-black/25 px-1 font-mono text-white">{count}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
        Deck <span className="rounded-sm bg-black/25 px-1 font-mono">{state.deck.length}</span>
      </div>
    </div>
  );
}

export function TileSupply({ state }: { state: GameState }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(CASINOS) as CasinoColor[]).map((c) => (
        <div
          key={c}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ background: CASINOS[c].hex, color: CASINOS[c].textHex }}
          title={`${CASINOS[c].name} tiles remaining`}
        >
          {CASINOS[c].name}
          <span className="rounded-sm bg-black/25 px-1 font-mono text-white">
            {state.tileSupply[c]}
          </span>
        </div>
      ))}
    </div>
  );
}
