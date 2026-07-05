"use client";

import { PLAYER_COLOR_KEYS, PLAYER_COLORS, type PlayerColor } from "@/data/playerColors";
import { playSound } from "@/lib/sound/SoundManager";

export function ColorPicker({
  value,
  onChange,
  taken = [],
}: {
  value: PlayerColor;
  onChange: (c: PlayerColor) => void;
  taken?: PlayerColor[];
}) {
  return (
    <div className="flex gap-2">
      {PLAYER_COLOR_KEYS.map((c) => {
        const meta = PLAYER_COLORS[c];
        const isTaken = taken.includes(c);
        return (
          <button
            key={c}
            type="button"
            disabled={isTaken}
            onClick={() => {
              playSound("chip");
              onChange(c);
            }}
            title={isTaken ? `${meta.name} (taken)` : meta.name}
            aria-label={isTaken ? `${meta.name} (taken)` : meta.name}
            className={`focus-ring h-9 w-9 rounded-full border-2 transition ${
              value === c
                ? "scale-110 border-[var(--accent)] shadow-[0_0_10px_rgba(245,197,66,0.5)]"
                : "border-white/20"
            } ${isTaken ? "cursor-not-allowed opacity-25" : "hover:scale-105 active:scale-95"}`}
            style={{ background: meta.hex }}
          />
        );
      })}
    </div>
  );
}
