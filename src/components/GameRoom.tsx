"use client";

/**
 * The player-facing room: join/reconnect gate → lobby → gameplay → game over.
 */

import Link from "next/link";
import { useState } from "react";
import type { PlayerColor } from "@/data/playerColors";
import { PLAYER_COLORS } from "@/data/playerColors";
import { SCORE_TRACK } from "@/data/scoreTrack";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { generateId } from "@/lib/gameApi";
import { loadIdentity, saveIdentity, type StoredIdentity } from "@/lib/identity";
import { useGame } from "@/lib/useGame";
import { ColorPicker } from "./ColorPicker";
import { GamePlay } from "./GamePlay";
import { LogPanel, stateLogLines } from "./LogPanel";
import { PlayersPanel } from "./PlayersPanel";

export function GameRoom({ roomCode }: { roomCode: string }) {
  const game = useGame(roomCode);
  const [identity, setIdentity] = useState<StoredIdentity | null>(() =>
    typeof window === "undefined" ? null : loadIdentity(roomCode),
  );

  if (game.loading) {
    return <CenteredNote title="Shuffling in…" body={`Connecting to table ${roomCode}.`} />;
  }
  if (game.notFound || !game.state) {
    return (
      <CenteredNote
        title="Table not found"
        body={`No game exists with room code ${roomCode}.`}
        showHome
      />
    );
  }

  const state = game.state;
  const me = identity ? state.players.find((p) => p.id === identity.playerId) ?? null : null;
  const myRequest = identity
    ? state.joinRequests.find((r) => r.id === identity.playerId) ?? null
    : null;

  if (!me && state.phase !== "lobby") {
    // Reconnect by name for players who lost local storage.
    return (
      <ReconnectByName
        state={state}
        roomCode={roomCode}
        onAdopt={(id) => setIdentity(id)}
      />
    );
  }

  if (!me && !myRequest) {
    return (
      <JoinForm
        state={state}
        roomCode={roomCode}
        onSubmitted={(id) => setIdentity(id)}
        send={game.send}
        error={game.error}
      />
    );
  }

  if (!me && myRequest) {
    return (
      <CenteredNote
        title="Waiting for the host"
        body={`${myRequest.name}, your request to join table ${roomCode} is waiting for host approval. This page will update automatically.`}
      />
    );
  }

  if (state.phase === "lobby") {
    return <Lobby state={state} meId={me!.id} send={game.send} error={game.error} />;
  }

  if (state.phase === "ended") {
    return <GameOver state={state} roomCode={roomCode} />;
  }

  return <GamePlay state={state} meId={me!.id} send={game.send} error={game.error} />;
}

// ---------------------------------------------------------------------------

function CenteredNote({
  title,
  body,
  showHome = false,
}: {
  title: string;
  body: string;
  showHome?: boolean;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="marquee text-3xl">{title}</h1>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {showHome && (
        <Link href="/" className="mt-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black">
          Back to the lobby
        </Link>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

function JoinForm({
  state,
  roomCode,
  onSubmitted,
  send,
  error,
}: {
  state: GameState;
  roomCode: string;
  onSubmitted: (identity: StoredIdentity) => void;
  send: ReturnType<typeof useGame>["send"];
  error: string | null;
}) {
  const taken = [
    ...state.players.map((p) => p.color),
    ...state.joinRequests.map((r) => r.color),
  ];
  const firstFree = (Object.keys(PLAYER_COLORS) as PlayerColor[]).find(
    (c) => !taken.includes(c),
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState<PlayerColor>(firstFree ?? "red");
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleJoin() {
    const trimmed = name.trim();
    if (!trimmed) return setLocalError("Enter your display name.");

    // Reconnect: same name as an existing player resumes that seat.
    const existing = state.players.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      const identity = { playerId: existing.id, token: existing.token, name: existing.name };
      saveIdentity(roomCode, identity);
      onSubmitted(identity);
      return;
    }

    setBusy(true);
    setLocalError(null);
    const playerId = generateId();
    const token = generateId();
    const okSent = await send(playerId, {
      type: "requestJoin",
      request: { id: playerId, token, name: trimmed, color },
    });
    if (okSent) {
      const identity = { playerId, token, name: trimmed };
      saveIdentity(roomCode, identity);
      onSubmitted(identity);
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="marquee text-3xl">Join table {roomCode}</h1>
      <div className="mt-6 w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Your name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            placeholder="Returning player? Use your same name."
          />
        </label>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Your color
          </span>
          <ColorPicker value={color} onChange={setColor} taken={taken} />
        </div>
        <button
          onClick={handleJoin}
          disabled={busy}
          className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Requesting…" : "Request to join"}
        </button>
        {(localError || error) && (
          <p className="text-sm text-[var(--accent-2)]">{localError ?? error}</p>
        )}
        <p className="text-xs text-muted">The host approves every join request.</p>
      </div>
    </main>
  );
}

function ReconnectByName({
  state,
  roomCode,
  onAdopt,
}: {
  state: GameState;
  roomCode: string;
  onAdopt: (identity: StoredIdentity) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleReconnect() {
    const player = state.players.find(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (!player) {
      setError("No player with that name at this table.");
      return;
    }
    const identity = { playerId: player.id, token: player.token, name: player.name };
    saveIdentity(roomCode, identity);
    onAdopt(identity);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="marquee text-3xl">Reconnect to {roomCode}</h1>
      <p className="mt-2 text-sm text-muted">The game is in progress. Enter your player name to resume.</p>
      <div className="mt-6 w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="Your player name"
          className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={handleReconnect}
          className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-bold text-black hover:brightness-110"
        >
          Resume playing
        </button>
        {error && <p className="text-sm text-[var(--accent-2)]">{error}</p>}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

function Lobby({
  state,
  meId,
  send,
  error,
}: {
  state: GameState;
  meId: string;
  send: ReturnType<typeof useGame>["send"];
  error: string | null;
}) {
  const isHost = state.hostId === meId;
  const canStart = state.players.length >= MIN_PLAYERS && state.players.length <= MAX_PLAYERS;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="marquee text-4xl">Lords of Vegas</h1>
        <p className="mt-2 text-sm text-muted">
          Room code{" "}
          <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-lg font-bold tracking-[0.3em] text-[var(--accent)]">
            {state.roomCode}
          </span>{" "}
          — share it with your players.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Players ({state.players.length}/{MAX_PLAYERS})
        </h2>
        <PlayersPanel state={state} viewerId={meId} />
      </section>

      {state.joinRequests.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            Join requests
          </h2>
          <div className="space-y-2">
            {state.joinRequests.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-black/20 p-2.5"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-white/30"
                  style={{ background: PLAYER_COLORS[r.color].hex }}
                />
                <span className="text-sm font-semibold">{r.name}</span>
                {isHost ? (
                  <span className="ml-auto flex gap-2">
                    <button
                      onClick={() => send(meId, { type: "approveJoin", requestId: r.id })}
                      className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-bold text-black hover:brightness-110"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => send(meId, { type: "rejectJoin", requestId: r.id })}
                      className="rounded-md bg-[var(--accent-2)] px-3 py-1 text-xs font-bold text-black hover:brightness-110"
                    >
                      Decline
                    </button>
                  </span>
                ) : (
                  <span className="ml-auto text-xs text-muted">waiting for host</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {isHost ? (
        <button
          onClick={() => send(meId, { type: "startGame" })}
          disabled={!canStart}
          className="rounded-xl bg-[var(--accent)] py-3 text-base font-bold text-black hover:brightness-110 disabled:opacity-40"
        >
          {canStart
            ? "Start the game"
            : `Need ${MIN_PLAYERS}–${MAX_PLAYERS} players to start (${state.players.length} seated)`}
        </button>
      ) : (
        <p className="text-center text-sm text-muted">Waiting for the host to start the game…</p>
      )}

      {error && <p className="text-center text-sm text-[var(--accent-2)]">{error}</p>}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Table talk</h2>
        <LogPanel lines={stateLogLines(state.log)} className="max-h-48" />
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------

function GameOver({ state, roomCode }: { state: GameState; roomCode: string }) {
  const winner = state.players.find((p) => p.id === state.winnerId);
  const standings = [...state.players].sort(
    (a, b) => SCORE_TRACK[b.trackIndex] - SCORE_TRACK[a.trackIndex] || b.money - a.money,
  );
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center gap-6 px-4 py-10">
      <h1 className="marquee text-5xl">Game Over</h1>
      {winner && (
        <p className="text-lg">
          <span className="font-bold" style={{ color: PLAYER_COLORS[winner.color].hex }}>
            {winner.name}
          </span>{" "}
          wins with {SCORE_TRACK[winner.trackIndex]} points!
        </p>
      )}
      <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Final standings</h2>
        <ol className="space-y-2">
          {standings.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 text-sm">
              <span className="w-5 text-right font-mono text-muted">{i + 1}.</span>
              <span
                className="h-3 w-3 rounded-full border border-white/30"
                style={{ background: PLAYER_COLORS[p.color].hex }}
              />
              <span className="font-semibold">{p.name}</span>
              <span className="ml-auto font-mono">
                {SCORE_TRACK[p.trackIndex]} pts · ${p.money}M
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Game log</h2>
        <LogPanel lines={stateLogLines(state.log)} className="max-h-72" autoScroll={false} />
      </section>
      <Link
        href="/"
        className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-black hover:brightness-110"
      >
        Host another game
      </Link>
      <p className="text-xs text-muted">Room {roomCode}</p>
    </main>
  );
}
