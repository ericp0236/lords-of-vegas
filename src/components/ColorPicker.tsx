"use client";

import { PLAYER_COLOR_KEYS, PLAYER_COLORS, type PlayerColor } from "@/data/playerColors";

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
            onClick={() => onChange(c)}
            title={isTaken ? `${meta.name} (taken)` : meta.name}
            className={`h-8 w-8 rounded-full border-2 transition ${
              value === c ? "scale-110 border-[var(--accent)]" : "border-white/20"
            } ${isTaken ? "cursor-not-allowed opacity-25" : "hover:scale-105"}`}
            style={{ background: meta.hex }}
          />
        );
      })}
    </div>
  );
}
