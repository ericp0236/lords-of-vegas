"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlayerColor } from "@/data/playerColors";
import { ColorPicker } from "@/components/ColorPicker";
import { createGameRoom, fetchGameByRoomCode } from "@/lib/gameApi";
import { saveIdentity } from "@/lib/identity";

type Tab = "create" | "join" | "director";

export default function LandingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("create");
  const [name, setName] = useState("");
  const [color, setColor] = useState<PlayerColor>("red");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return setError("Enter your display name.");
    setBusy(true);
    setError(null);
    try {
      const { row, playerId, token } = await createGameRoom({ name: name.trim(), color });
      saveIdentity(row.room_code, { playerId, token, name: name.trim() });
      router.push(`/game/${row.room_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the room.");
      setBusy(false);
    }
  }

  async function handleGo(path: "game" | "director") {
    const roomCode = code.trim().toUpperCase();
    if (roomCode.length !== 4) return setError("Room codes are 4 characters.");
    setBusy(true);
    setError(null);
    try {
      const row = await fetchGameByRoomCode(roomCode);
      if (!row) {
        setError("No table found with that code.");
        setBusy(false);
        return;
      }
      router.push(`/${path}/${roomCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the table.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <h1 className="marquee text-center text-5xl sm:text-6xl">Lords of Vegas</h1>
      <p className="mt-3 text-center text-sm text-muted">
        Build casinos. Boss the Strip. 3–6 remote players, plus a Director view for recording.
      </p>

      <div className="mt-10 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg bg-black/30 p-1">
          {(
            [
              ["create", "Host a table"],
              ["join", "Join"],
              ["director", "Director"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={`rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                tab === t ? "bg-[var(--accent)] text-black" : "text-muted hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "create" && (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Your name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="e.g. Sam"
                className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Your color
              </span>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <button
              onClick={handleCreate}
              disabled={busy}
              className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Opening table…" : "Open the table"}
            </button>
          </div>
        )}

        {(tab === "join" || tab === "director") && (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Room code
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="ABCD"
                className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-center font-mono text-lg tracking-[0.5em] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <button
              onClick={() => handleGo(tab === "join" ? "game" : "director")}
              disabled={busy}
              className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Looking up…" : tab === "join" ? "Join the table" : "Open Director view"}
            </button>
            {tab === "director" && (
              <p className="text-xs text-muted">
                The Director view is a read-only, 16:9 layout with the full game log and optional
                overlays — built for YouTube recording.
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-[var(--accent-2)]">{error}</p>}
      </div>
    </main>
  );
}
