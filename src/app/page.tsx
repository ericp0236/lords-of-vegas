"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import type { PlayerColor } from "@/data/playerColors";
import { ColorPicker } from "@/components/ColorPicker";
import { Button } from "@/components/ui/Button";
import { createGameRoom, fetchGameByRoomCode } from "@/lib/gameApi";
import { saveIdentity } from "@/lib/identity";
import { playSound } from "@/lib/sound/SoundManager";

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
      playSound("success");
      router.push(`/game/${row.room_code}`);
    } catch (e) {
      playSound("error");
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
        playSound("error");
        setError("No table found with that code.");
        setBusy(false);
        return;
      }
      playSound("success");
      router.push(`/${path}/${roomCode}`);
    } catch (e) {
      playSound("error");
      setError(e instanceof Error ? e.message : "Couldn't reach the table.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
        className="text-center"
      >
        <h1 className="marquee neon-flicker text-center text-5xl sm:text-7xl">Lords of Vegas</h1>
        <p className="mt-4 text-center text-sm text-muted">
          Build casinos. Boss the Strip. 3–6 remote players, plus a Director view for recording.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.12, type: "spring", stiffness: 150, damping: 18 }}
        className="mt-10 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]"
      >
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
                playSound("click");
                setTab(t);
                setError(null);
              }}
              className={`focus-ring relative rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                tab === t ? "text-black" : "text-muted hover:text-white"
              }`}
            >
              {tab === t && (
                <motion.span
                  layoutId="landing-tab"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="btn-gold absolute inset-0 rounded-md"
                />
              )}
              <span className="relative">{label}</span>
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
                className="focus-ring w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
              />
            </label>
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Your color
              </span>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <Button variant="gold" size="md" onClick={handleCreate} disabled={busy} className="w-full py-2.5">
              {busy ? "Opening table…" : "Open the table"}
            </Button>
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
                autoCapitalize="characters"
                autoComplete="off"
                className="focus-ring w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2.5 text-center font-mono text-lg tracking-[0.5em] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </label>
            <Button
              variant="gold"
              size="md"
              onClick={() => handleGo(tab === "join" ? "game" : "director")}
              disabled={busy}
              className="w-full py-2.5"
            >
              {busy ? "Looking up…" : tab === "join" ? "Join the table" : "Open Director view"}
            </Button>
            {tab === "director" && (
              <p className="text-xs text-muted">
                The Director view is a read-only, 16:9 layout with the full game log and optional
                overlays — built for YouTube recording.
              </p>
            )}
          </div>
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-sm text-[var(--accent-2)]"
          >
            {error}
          </motion.p>
        )}
      </motion.div>
    </main>
  );
}
