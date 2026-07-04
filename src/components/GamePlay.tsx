"use client";

/**
 * In-game player view: board, action state machine, pending choices, trades.
 * All state changes go through `send` → engine `applyCommand` → CAS write.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { BOARD_LOTS, type LotId } from "@/data/boardLots";
import { CASINOS, CASINO_COLOR_KEYS, type CasinoColor } from "@/data/casinoCards";
import { PLAYER_COLORS } from "@/data/playerColors";
import { casinoGroup, casinoPoints } from "@/engine/casinos";
import { diceExhausted, parkingLots } from "@/engine/helpers";
import type { ActionCommand, Command, GameState } from "@/engine/types";
import {
  bossCasinoLots,
  buildTargets,
  gambleTargets,
  reorganizeTargets,
  sprawlTargets,
  vacateDieCandidates,
} from "@/lib/candidates";
import type { useGame } from "@/lib/useGame";
import { Board } from "./Board";
import { DiscardPiles, TileSupply } from "./DiscardPiles";
import { LogPanel, stateLogLines } from "./LogPanel";
import { PlayersPanel } from "./PlayersPanel";
import { TradeCenter } from "./TradeCenter";

type Mode =
  | { kind: "idle" }
  | { kind: "build-lot" }
  | { kind: "build-color"; lotId: LotId }
  | { kind: "sprawl-from" }
  | { kind: "sprawl-to"; fromLot: LotId }
  | { kind: "remodel-casino" }
  | { kind: "remodel-color"; lotId: LotId }
  | { kind: "raise-casino" }
  | { kind: "reorganize-casino" }
  | { kind: "gamble-casino" }
  | { kind: "gamble-wager"; lotId: LotId }
  | { kind: "vacate-die"; pending: ActionCommand };

export function GamePlay({
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
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [wager, setWager] = useState(1);

  const me = state.players.find((p) => p.id === meId)!;
  const isMyTurn = state.turn?.activePlayerId === meId;
  const inActions = isMyTurn && state.turn?.phase === "actions";
  const pending = state.pendingChoice;
  const active = state.players.find((p) => p.id === state.turn?.activePlayerId);

  // ------------------------------------------------------- pending choices
  const myPendingRemoveDie = pending?.kind === "removeDie" && pending.playerId === meId;
  const myPendingVacateLot = pending?.kind === "vacateLot" && pending.playerId === meId;
  const myPendingReorg =
    pending?.kind === "reorgPlacement" && pending.waiting[meId] !== undefined;

  // ------------------------------------------------------- eligible lots
  const eligibleLots = useMemo(() => {
    if (myPendingRemoveDie && pending?.kind === "removeDie") {
      return new Set(vacateDieCandidates(state, meId, pending.targetLot));
    }
    if (myPendingVacateLot) return new Set(parkingLots(state, meId));
    if (!inActions || pending) return new Set<LotId>();
    switch (mode.kind) {
      case "build-lot":
        return new Set(buildTargets(state, meId));
      case "sprawl-from":
      case "remodel-casino":
      case "raise-casino":
        return new Set(bossCasinoLots(state, meId));
      case "sprawl-to":
        return new Set(sprawlTargets(state, mode.fromLot));
      case "reorganize-casino":
        return new Set(reorganizeTargets(state, meId));
      case "gamble-casino":
        return new Set(gambleTargets(state, meId));
      case "vacate-die":
        return new Set(vacateDieCandidates(state, meId));
      default:
        return new Set<LotId>();
    }
  }, [state, meId, mode, inActions, pending, myPendingRemoveDie, myPendingVacateLot]);

  // ------------------------------------------------------- helpers
  async function dispatch(command: Command) {
    setMode({ kind: "idle" });
    await send(meId, command);
  }

  function sendAction(action: ActionCommand) {
    // Build/sprawl place a die: if the player is at 12 dice, they must first
    // choose which die to move.
    if (
      (action.type === "build" || action.type === "sprawl") &&
      diceExhausted(state, meId) &&
      !action.vacateDieLot
    ) {
      setMode({ kind: "vacate-die", pending: action });
      return;
    }
    void dispatch({ type: "action", action });
  }

  function onLotClick(lotId: LotId) {
    if (myPendingRemoveDie) return void dispatch({ type: "chooseRemoveDie", lotId });
    if (myPendingVacateLot) return void dispatch({ type: "chooseVacateLot", lotId });
    switch (mode.kind) {
      case "build-lot":
        return setMode({ kind: "build-color", lotId });
      case "sprawl-from":
        return setMode({ kind: "sprawl-to", fromLot: lotId });
      case "sprawl-to":
        return sendAction({ type: "sprawl", fromLot: mode.fromLot, toLot: lotId });
      case "remodel-casino":
        return setMode({ kind: "remodel-color", lotId });
      case "raise-casino":
        return sendAction({ type: "raise", lotId });
      case "reorganize-casino":
        return sendAction({ type: "reorganize", lotId });
      case "gamble-casino":
        setWager(1);
        return setMode({ kind: "gamble-wager", lotId });
      case "vacate-die": {
        const withVacate = { ...mode.pending, vacateDieLot: lotId } as ActionCommand;
        return sendAction(withVacate);
      }
    }
  }

  const modeHint: string | null = (() => {
    if (myPendingRemoveDie)
      return "All 12 of your dice are on the board — click one of your dice to move it to the new tile.";
    if (myPendingVacateLot)
      return "All 10 of your lot markers are placed — click a lot to vacate its marker.";
    switch (mode.kind) {
      case "build-lot":
        return "Click one of your parking lots to build on.";
      case "sprawl-from":
        return "Click a casino you boss to sprawl from.";
      case "sprawl-to":
        return "Click the adjacent empty lot to sprawl into (2× lot price + $15M per riser).";
      case "remodel-casino":
        return "Click a casino you boss to remodel ($5M per space).";
      case "raise-casino":
        return `Click a casino you boss to raise ($15M per space, max height ${state.players.length}).`;
      case "reorganize-casino":
        return "Click a casino with your dice to reorganize ($1M per pip — all dice reroll).";
      case "gamble-casino":
        return "Click another boss's casino to gamble there.";
      case "vacate-die":
        return "You're out of dice — click one of your dice on the board to move it.";
      default:
        return null;
    }
  })();

  const waitingOnOthers =
    pending &&
    !myPendingRemoveDie &&
    !myPendingVacateLot &&
    !myPendingReorg;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-3 px-3 py-3 lg:flex-row">
      {/* Left: board + status */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <header className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
          <h1 className="marquee text-lg leading-none">Lords of Vegas</h1>
          <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-sm font-bold tracking-[0.2em] text-[var(--accent)]">
            {state.roomCode}
          </span>
          <span className="text-xs text-muted">Turn {state.turn?.number}</span>
          {active && (
            <span className="text-xs">
              <span
                className="font-semibold"
                style={{ color: PLAYER_COLORS[active.color].hex }}
              >
                {active.name}
              </span>{" "}
              {state.turn?.phase === "draw" ? "is drawing" : "is acting"}
            </span>
          )}
          <Link
            href={`/director/${state.roomCode}`}
            target="_blank"
            className="ml-auto rounded-md border border-[var(--border)] px-2 py-1 text-xs text-muted hover:text-white"
          >
            Director view ↗
          </Link>
        </header>

        <Board state={state} eligibleLots={eligibleLots} onLotClick={onLotClick} />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
          <DiscardPiles state={state} />
          <TileSupply state={state} />
        </div>
      </div>

      {/* Right: control column */}
      <div className="flex w-full flex-col gap-3 lg:w-[360px]">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <PlayersPanel state={state} viewerId={meId} />
        </section>

        {/* Turn controls */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          {isMyTurn ? (
            state.turn?.phase === "draw" && !pending ? (
              <button
                onClick={() => dispatch({ type: "drawCard" })}
                className="w-full rounded-lg bg-[var(--accent)] py-3 text-base font-bold text-black hover:brightness-110"
              >
                Draw a property card
              </button>
            ) : (
              <div className="space-y-2">
                {!pending && (
                  <>
                    <div className="grid grid-cols-3 gap-1.5">
                      <ActionButton label="Build" onClick={() => setMode({ kind: "build-lot" })} active={mode.kind.startsWith("build")} />
                      <ActionButton label="Sprawl" onClick={() => setMode({ kind: "sprawl-from" })} active={mode.kind.startsWith("sprawl")} />
                      <ActionButton label="Remodel" onClick={() => setMode({ kind: "remodel-casino" })} active={mode.kind.startsWith("remodel")} />
                      <ActionButton label="Raise" onClick={() => setMode({ kind: "raise-casino" })} active={mode.kind === "raise-casino"} />
                      <ActionButton label="Reorganize" onClick={() => setMode({ kind: "reorganize-casino" })} active={mode.kind === "reorganize-casino"} />
                      <ActionButton
                        label="Gamble"
                        onClick={() => setMode({ kind: "gamble-casino" })}
                        active={mode.kind.startsWith("gamble")}
                        disabled={state.turn?.gambleUsed}
                      />
                    </div>
                    {mode.kind !== "idle" && (
                      <button
                        onClick={() => setMode({ kind: "idle" })}
                        className="w-full rounded-md border border-[var(--border)] py-1.5 text-xs text-muted hover:text-white"
                      >
                        Cancel {mode.kind.split("-")[0]}
                      </button>
                    )}
                    <button
                      onClick={() => dispatch({ type: "endTurn" })}
                      className="w-full rounded-lg bg-white/10 py-2 text-sm font-bold hover:bg-white/20"
                    >
                      End turn
                    </button>
                  </>
                )}
              </div>
            )
          ) : (
            <p className="text-center text-sm text-muted">
              {active ? `${active.name}'s turn` : "…"} — you can still propose trades.
            </p>
          )}
          {modeHint && (
            <p className="mt-2 rounded-md bg-[var(--accent)]/10 p-2 text-xs text-[var(--accent)]">
              {modeHint}
            </p>
          )}
          {waitingOnOthers && (
            <p className="mt-2 text-center text-xs text-purple-300">
              Waiting for another player&apos;s choice…
            </p>
          )}
          {error && <p className="mt-2 text-xs text-[var(--accent-2)]">{error}</p>}
        </section>

        <TradeCenter state={state} meId={meId} send={send} />

        <section className="min-h-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Game log</h2>
          <LogPanel lines={stateLogLines(state.log)} className="h-64 lg:h-[calc(100%-1.5rem)]" />
        </section>
      </div>

      {/* Modals */}
      {mode.kind === "build-color" && (
        <ColorModal
          title={`Build on ${mode.lotId} ($${BOARD_LOTS[mode.lotId].price}M)`}
          state={state}
          minTiles={1}
          onPick={(color) => sendAction({ type: "build", lotId: mode.lotId, color })}
          onClose={() => setMode({ kind: "idle" })}
        />
      )}
      {mode.kind === "remodel-color" && (
        <ColorModal
          title={`Remodel the casino at ${mode.lotId} ($5M per space)`}
          state={state}
          minTiles={casinoGroup(state.board, mode.lotId).length}
          exclude={state.board[mode.lotId].color ?? undefined}
          onPick={(color) => sendAction({ type: "remodel", lotId: mode.lotId, newColor: color })}
          onClose={() => setMode({ kind: "idle" })}
        />
      )}
      {mode.kind === "gamble-wager" && (
        <Modal onClose={() => setMode({ kind: "idle" })}>
          <h3 className="text-sm font-bold">
            Gamble at {mode.lotId} — max $
            {casinoPoints(state.board, casinoGroup(state.board, mode.lotId)) * 5}M
          </h3>
          <input
            type="number"
            min={1}
            max={Math.min(
              casinoPoints(state.board, casinoGroup(state.board, mode.lotId)) * 5,
              me.money,
            )}
            value={wager}
            onChange={(e) => setWager(parseInt(e.target.value) || 1)}
            className="mt-3 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <p className="mt-2 text-xs text-muted">
            2 or 12 pays double · 3, 4, 9, 10, 11 pays your bet · 5–8 the House wins.
          </p>
          <button
            onClick={() => sendAction({ type: "gamble", lotId: mode.lotId, wager })}
            className="mt-3 w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-bold text-black hover:brightness-110"
          >
            Roll the dice (${wager}M)
          </button>
        </Modal>
      )}
      {myPendingReorg && pending?.kind === "reorgPlacement" && (
        <ReorgPlacementModal
          state={state}
          lots={pending.slots[meId]}
          values={pending.waiting[meId]}
          onSubmit={(placements) =>
            dispatch({ type: "chooseReorgPlacement", playerId: meId, placements })
          }
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

function ActionButton({
  label,
  onClick,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2 py-2 text-xs font-bold transition ${
        active
          ? "bg-[var(--accent)] text-black"
          : "bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
      }`}
    >
      {label}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        <button
          onClick={onClose}
          className="mt-3 w-full rounded-md border border-[var(--border)] py-1.5 text-xs text-muted hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ColorModal({
  title,
  state,
  minTiles,
  exclude,
  onPick,
  onClose,
}: {
  title: string;
  state: GameState;
  minTiles: number;
  exclude?: CasinoColor;
  onPick: (color: CasinoColor) => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {CASINO_COLOR_KEYS.map((c) => {
          const supply = state.tileSupply[c];
          const disabled = c === exclude || supply < minTiles;
          return (
            <button
              key={c}
              disabled={disabled}
              onClick={() => onPick(c)}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
              style={{ background: CASINOS[c].hex, color: CASINOS[c].textHex }}
            >
              {CASINOS[c].name}
              <span className="text-xs opacity-80">{supply} tiles left</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function ReorgPlacementModal({
  state,
  lots,
  values,
  onSubmit,
}: {
  state: GameState;
  lots: LotId[];
  values: number[];
  onSubmit: (placements: Record<LotId, number>) => void;
}) {
  // Assign each rerolled value to one of the player's original tiles.
  const [assignment, setAssignment] = useState<Record<LotId, number>>(() => {
    const initial: Record<LotId, number> = {};
    lots.forEach((lot, i) => (initial[lot] = values[i]));
    return initial;
  });

  const counts = (vals: number[]) => {
    const m = new Map<number, number>();
    for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  };
  const valid = (() => {
    const want = counts(values);
    const got = counts(Object.values(assignment));
    if (want.size !== got.size) return false;
    for (const [v, n] of want) if (got.get(v) !== n) return false;
    return true;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
        <h3 className="text-sm font-bold">Place your rerolled dice</h3>
        <p className="mt-1 text-xs text-muted">
          Your dice were rerolled to{" "}
          <span className="font-mono font-bold text-white">{values.join(", ")}</span>. Choose which
          tile each value returns to.
        </p>
        <div className="mt-3 space-y-2">
          {lots.map((lot) => (
            <div key={lot} className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">
                {lot}{" "}
                <span className="text-xs text-muted">
                  ({CASINOS[state.board[lot].color!]?.name})
                </span>
              </span>
              <select
                value={assignment[lot]}
                onChange={(e) =>
                  setAssignment({ ...assignment, [lot]: parseInt(e.target.value) })
                }
                className="rounded-md border border-[var(--border)] bg-black/40 px-2 py-1 text-sm"
              >
                {[...new Set(values)].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {!valid && (
          <p className="mt-2 text-xs text-[var(--accent-2)]">
            Use each rerolled value exactly once.
          </p>
        )}
        <button
          disabled={!valid}
          onClick={() => onSubmit(assignment)}
          className="mt-4 w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
        >
          Place dice
        </button>
      </div>
    </div>
  );
}
