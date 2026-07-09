"use client";

/**
 * Director view: read-only, 16:9 / 1080p-friendly layout for YouTube
 * recording. Mirrors the player board layout with full game log, optional
 * overlays, and no action controls.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CASINOS } from "@/data/casinoCards";
import { PLAYER_COLORS } from "@/data/playerColors";
import { SCORE_TRACK } from "@/data/scoreTrack";
import type { ActionCommand, GameState, TradeStep } from "@/engine/types";
import { fetchEvents, type GameEventRow } from "@/lib/gameApi";
import { supabase } from "@/lib/supabaseClient";
import { useGame } from "@/lib/useGame";
import { useGameFeedback } from "@/lib/useGameFeedback";
import { useReorgRollPhase } from "@/lib/useReorgRollPhase";
import { Board } from "./Board";
import { Confetti } from "./fx/Confetti";
import { DiscardPiles } from "./DiscardPiles";
import { TilesLeftPanel } from "./TilesLeftPanel";
import { LogPanel, type LogLine } from "./LogPanel";
import { MyStatsPanel } from "./MyStatsPanel";
import { PlayerStandingsTable } from "./PlayerChips";
import { ScoreTrackPanel } from "./ScoreTrackPanel";
import { ActionTileButton, EndTurnButton, type ActionTileKind } from "./ui/ActionTileButton";
import { Panel } from "./ui/Panel";
import { SoundToggle } from "./ui/SoundToggle";

interface Overlays {
  turnBanner: boolean;
  payouts: boolean;
  scoring: boolean;
}

const ACTION_TILES: ActionTileKind[] = [
  "build",
  "sprawl",
  "remodel",
  "raise",
  "reorganize",
  "gamble",
];

export function DirectorView({ roomCode }: { roomCode: string }) {
  const game = useGame(roomCode);
  const [overlays, setOverlays] = useState<Overlays>({
    turnBanner: true,
    payouts: true,
    scoring: true,
  });
  const [showControls, setShowControls] = useState(false);
  const events = useFullLog(game.row?.id);

  useGameFeedback(game.state);

  const { inRollPhase, rollOverlays } = useReorgRollPhase(
    game.state?.pendingChoice ?? null,
    game.state?.players ?? [],
    game.state?.turn?.reorgReveal,
  );

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

  const active = state.players.find((p) => p.id === state.turn?.activePlayerId);

  return (
    <main
      className="city-backdrop relative mx-auto flex h-screen max-h-screen w-full flex-col gap-1.5 overflow-hidden p-2 sm:p-3"
      style={{ aspectRatio: "16 / 9", maxWidth: "calc(100vh * 16 / 9)" }}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <header className="flex shrink-0 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <h1 className="marquee text-lg leading-none">Lords of Vegas</h1>
        <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-xs font-bold tracking-[0.2em] text-[var(--accent)]">
          {state.roomCode}
        </span>
        <span className="text-[11px] text-muted">Turn {state.turn?.number ?? "—"}</span>
        {overlays.turnBanner && state.phase === "playing" && active && (
          <div className="ml-auto flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold"
              style={{
                background: PLAYER_COLORS[active.color].hex,
                color: PLAYER_COLORS[active.color].textHex,
              }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white/90" />
              </span>
              {active.name}
              <span className="text-[10px] font-semibold opacity-80">
                {state.turn?.phase === "draw" ? "drawing" : "acting"}
              </span>
            </span>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 gap-2.5">
        <aside className="min-h-0 w-14 shrink-0 self-stretch">
          <ScoreTrackPanel state={state} layout="column" className="min-h-0 flex-1 rounded-xl" />
        </aside>

        <aside className="scrollbar-thin flex w-64 shrink-0 flex-col gap-2 self-stretch overflow-y-auto">
          <Panel title="Standings" className="shrink-0">
            <PlayerStandingsTable state={state} />
          </Panel>
          <TilesLeftPanel state={state} className="shrink-0" />
          <Panel
            title="Full game log"
            className="flex min-h-0 flex-1 flex-col"
            bodyClassName="flex min-h-0 flex-1 flex-col"
          >
            <LogPanel lines={events} className="min-h-0 flex-1" />
          </Panel>
        </aside>

        <Board
          state={state}
          overlayDice={inRollPhase ? rollOverlays : undefined}
          className="min-h-0 min-w-0 flex-1"
        />

        <aside className="scrollbar-thin flex w-[320px] shrink-0 flex-col gap-2 overflow-y-auto">
          <Panel bodyClassName="p-2 pt-1">
            <DiscardPiles state={state} drawnCard={state.turn?.drawnCard ?? null} />
          </Panel>
          {active && (
            <Panel title="Active player" className="shrink-0">
              <MyStatsPanel state={state} playerId={active.id} />
            </Panel>
          )}
          <DirectorTurnPanel state={state} />
          <DirectorTradesPanel state={state} />
        </aside>
      </div>

      <EventToasts events={events} overlays={overlays} />

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
// Read-only right-rail panels
// ---------------------------------------------------------------------------

function DirectorTurnPanel({ state }: { state: GameState }) {
  const active = state.players.find((p) => p.id === state.turn?.activePlayerId);
  const drawPhase = state.turn?.phase === "draw";
  const pendingNote = pendingChoiceNote(state);

  return (
    <Panel
      title="Actions"
      className={
        state.phase === "playing" && active
          ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.07] shadow-[0_0_18px_rgba(245,197,66,0.12),inset_0_0_0_1px_rgba(245,197,66,0.15)]"
          : ""
      }
      bodyClassName="space-y-2"
    >
      {pendingNote && (
        <p className="rounded-md bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-300">
          {pendingNote}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <span
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold"
            style={{
              background: PLAYER_COLORS[active.color].hex,
              color: PLAYER_COLORS[active.color].textHex,
            }}
          >
            {active.name}
            <span className="text-[10px] font-semibold opacity-85">
              {drawPhase ? "draws" : "acts"}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted">Waiting…</span>
        )}
      </div>

      {drawPhase ? (
        <p className="rounded-md bg-[var(--accent)]/10 px-2 py-2 text-center text-[11px] font-medium text-[var(--accent)]">
          Draw phase
        </p>
      ) : (
        <div className="pointer-events-none grid grid-cols-3 gap-2 opacity-80">
          {ACTION_TILES.map((kind) => (
            <ActionTileButton
              key={kind}
              kind={kind}
              disabled={kind === "gamble" && !!state.turn?.gambleUsed}
              onClick={() => {}}
            />
          ))}
          <EndTurnButton staticDisplay className="col-span-3" />
        </div>
      )}
    </Panel>
  );
}

function DirectorTradesPanel({ state }: { state: GameState }) {
  const trade = state.trade;

  return (
    <Panel title="Trades" className="shrink-0">
      {trade ? (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            <span className="font-semibold text-white">
              {state.players.find((p) => p.id === trade.proposerId)?.name ?? "?"}
            </span>{" "}
            proposes:
          </p>
          <ol className="space-y-1 text-xs">
            {trade.steps.map((step, i) => (
              <li key={i} className="rounded bg-black/25 px-2 py-1">
                {i + 1}. {describeStep(state, step)}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {trade.participants.map((id) => {
              const p = state.players.find((pl) => pl.id === id);
              const approved = trade.approvals.includes(id);
              return (
                <span
                  key={id}
                  className={`rounded px-1.5 py-0.5 font-semibold ${
                    approved ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-muted"
                  }`}
                >
                  {p?.name} {approved ? "✓" : "…"}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">No trade pending</p>
      )}
    </Panel>
  );
}

function pendingChoiceNote(state: GameState): string | null {
  const pending = state.pendingChoice;
  if (!pending) return null;
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "A player";
  switch (pending.kind) {
    case "removeDie":
      return `${name(pending.playerId)} must choose a die to move.`;
    case "vacateLot":
      return `${name(pending.playerId)} must vacate a lot marker.`;
    case "reorgPlacement":
      return "Players are placing rerolled dice.";
    default:
      return "Waiting for a player choice…";
  }
}

function describeStep(state: GameState, step: TradeStep): string {
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "?";
  switch (step.type) {
    case "money":
      return `${name(step.from)} pays ${name(step.to)} $${step.amount}M`;
    case "lot":
      return `${name(step.from)} gives lot ${step.lotId} to ${name(step.to)}`;
    case "die":
      return `${name(step.from)}'s die on ${step.lotId} goes to ${name(step.to)}`;
    case "action":
      return `${name(step.player)} performs: ${describeAction(step.action)}`;
  }
}

function describeAction(a: ActionCommand): string {
  switch (a.type) {
    case "build":
      return `build ${CASINOS[a.color].name} on ${a.lotId}`;
    case "sprawl":
      return `sprawl ${a.fromLot} → ${a.toLot}`;
    case "remodel":
      return `remodel ${a.lotId} to ${CASINOS[a.newColor].name}`;
    case "raise":
      return `raise the casino at ${a.lotId}`;
    case "reorganize":
      return `reorganize the casino at ${a.lotId}`;
    case "gamble":
      return `gamble $${a.wager}M at ${a.lotId}`;
  }
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

const TOAST_TYPES = new Set(["casino-payout", "parking-payout", "scoring", "game-over"]);

function EventToasts({ events, overlays }: { events: LogLine[]; overlays: Overlays }) {
  const [visible, setVisible] = useState<LogLine[]>([]);
  const seenRef = useRef<Set<string | number>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
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
