"use client";

/**
 * Director view: read-only, 16:9 / 1080p-friendly layout for YouTube
 * recording. Shows the full public game state, the complete game log
 * (from the game_events table), and optional overlays (on by default).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PLAYER_COLORS } from "@/data/playerColors";
import { SCORE_TRACK } from "@/data/scoreTrack";
import { diceOnBoard, markersOnBoard } from "@/engine/helpers";
import type { GameState } from "@/engine/types";
import { fetchEvents, type GameEventRow } from "@/lib/gameApi";
import { supabase } from "@/lib/supabaseClient";
import { useGame } from "@/lib/useGame";
import { useGameFeedback } from "@/lib/useGameFeedback";
import { Board } from "./Board";
import { Confetti } from "./fx/Confetti";
import { DiscardPiles, TileSupply } from "./DiscardPiles";
import { LogPanel, type LogLine } from "./LogPanel";
import { ScoreTrackPanel } from "./ScoreTrackPanel";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import { MiniDie, MiniMarker } from "./ui/MiniIcons";
import { MoneyValue } from "./ui/MoneyValue";
import { SoundToggle } from "./ui/SoundToggle";

interface Overlays {
  turnBanner: boolean;
  payouts: boolean;
  scoring: boolean;
}

export function DirectorView({ roomCode }: { roomCode: string }) {
  const game = useGame(roomCode);
  const [overlays, setOverlays] = useState<Overlays>({
    turnBanner: true,
    payouts: true,
    scoring: true,
  });
  const [showControls, setShowControls] = useState(false);
  const events = useFullLog(game.row?.id);

  // Table sounds for the recording (mute with the hover toggle if unwanted).
  useGameFeedback(game.state);

  if (game.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <h1 className="marquee text-3xl">Connecting…</h1>
      </main>
    );
  }
  if (game.notFound || !game.state) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <h1 className="marquee text-3xl">No table at {roomCode}</h1>
      </main>
    );
  }

  const state = game.state;

  if (state.phase === "lobby") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="marquee text-5xl">Lords of Vegas</h1>
        <p className="text-muted">
          Waiting for the game at{" "}
          <span className="font-mono font-bold text-[var(--accent)]">{roomCode}</span> to begin —{" "}
          {state.players.length} player{state.players.length === 1 ? "" : "s"} seated.
        </p>
      </main>
    );
  }

  return (
    <main
      className="relative mx-auto flex h-screen max-h-screen w-full flex-col gap-2 overflow-hidden p-3"
      style={{ aspectRatio: "16 / 9", maxWidth: "calc(100vh * 16 / 9)" }}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Top banner */}
      <TopBanner state={state} enabled={overlays.turnBanner} />

      <div className="flex min-h-0 flex-1 gap-3">
        {/* Left rail: deck / discards + tile supply */}
        <div className="flex w-44 shrink-0 flex-col gap-2">
          <section className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
            <h2 className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
              Deck &amp; discards
            </h2>
            <DiscardPiles state={state} compact />
          </section>
          <section className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
            <h2 className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
              Tiles left
            </h2>
            <TileSupply state={state} className="flex-col" />
          </section>
          <ScoreTrackPanel state={state} />
        </div>

        {/* Board */}
        <Board state={state} className="min-h-0 min-w-0 flex-[1.35]" />

        {/* Right rail: standings + full log */}
        <div className="flex w-[340px] shrink-0 flex-col gap-2">
          <Standings state={state} />
          <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
              Full game log
            </h2>
            <LogPanel lines={events} className="min-h-0 flex-1" />
          </section>
        </div>
      </div>

      {/* Event toasts (payouts / scoring) */}
      <EventToasts events={events} overlays={overlays} />

      {/* Director controls: only visible on hover, never recorded accidentally */}
      <div
        className={`absolute right-3 top-3 z-40 flex gap-2 rounded-lg border border-[var(--border)] bg-black/80 p-2 text-xs transition-opacity ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {(
          [
            ["turnBanner", "Turn banner"],
            ["payouts", "Payout toasts"],
            ["scoring", "Scoring toasts"],
          ] as [keyof Overlays, string][]
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-1 text-muted">
            <input
              type="checkbox"
              checked={overlays[key]}
              onChange={(e) => setOverlays({ ...overlays, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <SoundToggle className="h-6 w-6" />
      </div>

      {state.phase === "ended" && <WinnerOverlay state={state} />}
    </main>
  );
}

// ---------------------------------------------------------------------------

function useFullLog(gameId: string | undefined): LogLine[] {
  const [rows, setRows] = useState<GameEventRow[]>([]);
  const lastIdRef = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;

    async function load() {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const fresh = await fetchEvents(gameId!, lastIdRef.current);
        if (cancelled || fresh.length === 0) return;
        lastIdRef.current = fresh[fresh.length - 1].id;
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          const novel = fresh.filter((r) => !seen.has(r.id));
          return novel.length === 0 ? prev : [...prev, ...novel];
        });
      } catch {
        // retry on next poll
      } finally {
        loadingRef.current = false;
      }
    }

    load();
    const channel = supabase()
      .channel(`events:${gameId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
        () => load(),
      )
      .subscribe();
    const poll = setInterval(load, 5000);

    return () => {
      cancelled = true;
      supabase().removeChannel(channel);
      clearInterval(poll);
    };
  }, [gameId]);

  return useMemo(
    () =>
      rows.map((r) => ({
        key: r.id,
        type: r.event_type,
        message: r.message,
        turn: r.turn_number ?? 0,
      })),
    [rows],
  );
}

// ---------------------------------------------------------------------------

function TopBanner({ state, enabled }: { state: GameState; enabled: boolean }) {
  const active = state.players.find((p) => p.id === state.turn?.activePlayerId);
  return (
    <header className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2">
      <h1 className="marquee text-2xl leading-none">Lords of Vegas</h1>
      <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-sm font-bold tracking-[0.25em] text-[var(--accent)]">
        {state.roomCode}
      </span>
      {enabled && state.phase === "playing" && active && (
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted">Turn {state.turn?.number}</span>
          <span
            className="flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-bold"
            style={{
              background: PLAYER_COLORS[active.color].hex,
              color: PLAYER_COLORS[active.color].textHex,
            }}
          >
            {active.name}
            <span className="text-xs font-semibold opacity-80">
              {state.turn?.phase === "draw" ? "drawing" : "taking actions"}
            </span>
          </span>
        </div>
      )}
    </header>
  );
}

function Standings({ state }: { state: GameState }) {
  const ordered = [...state.players].sort(
    (a, b) => SCORE_TRACK[b.trackIndex] - SCORE_TRACK[a.trackIndex] || b.money - a.money,
  );
  const activeId = state.turn?.activePlayerId;
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Standings</h2>
      <div className="space-y-1.5">
        {ordered.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
              p.id === activeId && state.phase === "playing" ? "bg-white/10" : ""
            }`}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-white/30"
              style={{ background: PLAYER_COLORS[p.color].hex }}
            />
            <span className="truncate text-sm font-semibold">{p.name}</span>
            <span className="ml-auto flex shrink-0 items-center gap-2.5 font-mono text-xs">
              <span className="font-bold text-[var(--accent)]">
                <AnimatedNumber value={SCORE_TRACK[p.trackIndex]} />
                pts
              </span>
              <MoneyValue amount={p.money} />
              <span className="flex items-center gap-1 text-muted" title="dice / markers remaining">
                <MiniDie /> {12 - diceOnBoard(state, p.id)}
                <MiniMarker className="ml-0.5" /> {10 - markersOnBoard(state, p.id)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const TOAST_TYPES = new Set(["casino-payout", "parking-payout", "scoring", "game-over"]);

function EventToasts({ events, overlays }: { events: LogLine[]; overlays: Overlays }) {
  const [visible, setVisible] = useState<LogLine[]>([]);
  const seenRef = useRef<Set<string | number>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    // Skip history on first load; only toast fresh events.
    if (!initializedRef.current) {
      for (const e of events) seenRef.current.add(e.key);
      initializedRef.current = true;
      return;
    }
    const fresh = events.filter((e) => !seenRef.current.has(e.key) && TOAST_TYPES.has(e.type));
    if (fresh.length === 0) return;
    for (const e of events) seenRef.current.add(e.key);
    setVisible((prev) => [...prev, ...fresh].slice(-3));
    const timer = setTimeout(() => {
      setVisible((prev) => prev.filter((v) => !fresh.includes(v)));
    }, 7000);
    return () => clearTimeout(timer);
  }, [events]);

  const filtered = visible.filter((v) =>
    v.type === "scoring"
      ? overlays.scoring
      : v.type === "game-over"
        ? true
        : overlays.payouts,
  );
  return (
    <div className="pointer-events-none absolute bottom-16 left-1/2 z-30 flex w-full max-w-2xl -translate-x-1/2 flex-col gap-2 px-4">
      <AnimatePresence>
        {filtered.map((e) => (
          <motion.div
            key={e.key}
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className={`rounded-xl border px-4 py-2.5 text-center text-sm font-semibold shadow-2xl backdrop-blur ${
              e.type === "scoring"
                ? "border-[var(--accent)]/50 bg-[#2a2410]/95 text-[var(--accent)]"
                : e.type === "game-over"
                  ? "border-[var(--accent-2)]/60 bg-[#2a1015]/95 text-[var(--accent-2)]"
                  : "border-emerald-500/40 bg-[#0d251c]/95 text-emerald-300"
            }`}
          >
            {e.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function WinnerOverlay({ state }: { state: GameState }) {
  const winner = state.players.find((p) => p.id === state.winnerId);
  if (!winner) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm"
    >
      <Confetti pieces={90} />
      <motion.h2
        initial={{ scale: 0.6, opacity: 0, y: -30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.15 }}
        className="marquee neon-flicker text-6xl"
      >
        Game Over
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, type: "spring", stiffness: 220, damping: 20 }}
        className="text-2xl"
      >
        <span
          className="font-bold"
          style={{
            color: PLAYER_COLORS[winner.color].hex,
            textShadow: `0 0 18px ${PLAYER_COLORS[winner.color].hex}99`,
          }}
        >
          {winner.name}
        </span>{" "}
        wins with {SCORE_TRACK[winner.trackIndex]} points!
      </motion.p>
    </motion.div>
  );
}
