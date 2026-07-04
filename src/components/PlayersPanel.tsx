import { PLAYER_COLORS } from "@/data/playerColors";
import { SCORE_TRACK } from "@/data/scoreTrack";
import { diceOnBoard, markersOnBoard } from "@/engine/helpers";
import type { GameState } from "@/engine/types";

export function PlayersPanel({
  state,
  viewerId,
}: {
  state: GameState;
  viewerId?: string;
}) {
  const activeId = state.turn?.activePlayerId;
  const ordered = [...state.players].sort((a, b) => a.seat - b.seat);
  return (
    <div className="space-y-2">
      {ordered.map((p) => {
        const meta = PLAYER_COLORS[p.color];
        const isActive = p.id === activeId && state.phase === "playing";
        return (
          <div
            key={p.id}
            className={`rounded-lg border p-2.5 ${
              isActive
                ? "border-[var(--accent)] bg-[var(--surface-2)]"
                : "border-[var(--border)] bg-[var(--surface)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 rounded-full border border-white/30"
                style={{ background: meta.hex }}
              />
              <span className="text-sm font-semibold">
                {p.name}
                {p.id === viewerId && <span className="text-muted"> (you)</span>}
              </span>
              {p.isHost && (
                <span className="rounded bg-white/10 px-1 text-[10px] uppercase tracking-wide text-muted">
                  host
                </span>
              )}
              {isActive && (
                <span className="ml-auto rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">
                  turn
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
              <span className="font-mono text-sm font-bold text-emerald-400">${p.money}M</span>
              <span>
                <span className="font-bold text-[var(--accent)]">{SCORE_TRACK[p.trackIndex]}</span> pts
              </span>
              <span title="Dice remaining">🎲 {12 - diceOnBoard(state, p.id)}</span>
              <span title="Lot markers remaining">🚗 {10 - markersOnBoard(state, p.id)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
