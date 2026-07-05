"use client";

/**
 * In-game player view, organized around the decision loop:
 *   - mobile: compact player chips under the header
 *   - score track: narrow leftmost column, full height
 *   - info rail (desktop): standings table, tiles left, game log
 *   - center: the board + a slim status strip (hints / turn / drawn card)
 *   - right rail (desktop): deck & discards, your stats, actions, trades
 *   - phones/tablets: actions stay in the bottom dock; reference panels use
 *     slide-up sheets.
 * All state changes go through `send` → engine `applyCommand` → CAS write.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BOARD_LOTS, type LotId } from "@/data/boardLots";
import {
  CASINOS,
  CASINO_COLOR_KEYS,
  type CasinoColor,
  type PropertyCard,
} from "@/data/casinoCards";
import { PLAYER_COLORS } from "@/data/playerColors";
import { casinoGroup, casinoPoints } from "@/engine/casinos";
import { diceExhausted, parkingLots } from "@/engine/helpers";
import type { ActionCommand, Command, GameState, LogEvent } from "@/engine/types";
import {
  bossCasinoLots,
  buildTargets,
  gambleTargets,
  reorganizeTargets,
  sprawlTargets,
  vacateDieCandidates,
} from "@/lib/candidates";
import { playSound } from "@/lib/sound/SoundManager";
import { useGameFeedback } from "@/lib/useGameFeedback";
import type { useGame } from "@/lib/useGame";
import { Board } from "./Board";
import { HOUSE_DIE, RollingDie } from "./DieFace";
import { DiscardPiles } from "./DiscardPiles";
import { TilesLeftPanel } from "./TilesLeftPanel";
import { LogPanel, stateLogLines } from "./LogPanel";
import { MyStatsPanel } from "./MyStatsPanel";
import { PlayerChips, PlayerStandingsTable } from "./PlayerChips";
import { ScoreTrackPanel } from "./ScoreTrackPanel";
import { TradeCenter } from "./TradeCenter";
import { Button } from "./ui/Button";
import { ActionBarButton, ActionTileButton, EndTurnButton, type ActionTileKind } from "./ui/ActionTileButton";
import { Modal } from "./ui/Modal";
import { Panel } from "./ui/Panel";
import { Sheet } from "./ui/Sheet";
import { SoundToggle } from "./ui/SoundToggle";

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

type SheetKind = "log" | "trades" | "score" | "supply" | null;

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
  const [sheet, setSheet] = useState<SheetKind>(null);

  useGameFeedback(state, meId);

  const me = state.players.find((p) => p.id === meId)!;
  const isMyTurn = state.turn?.activePlayerId === meId;
  const inActions = isMyTurn && state.turn?.phase === "actions";
  const pending = state.pendingChoice;
  const active = state.players.find((p) => p.id === state.turn?.activePlayerId);

  useEffect(() => {
    if (error) playSound("error");
  }, [error]);

  // ------------------------------------------------------- pending choices
  const myPendingRemoveDie = pending?.kind === "removeDie" && pending.playerId === meId;
  const myPendingVacateLot = pending?.kind === "vacateLot" && pending.playerId === meId;
  const myPendingReorg =
    pending?.kind === "reorgPlacement" && pending.waiting[meId] !== undefined;
  const canDraw = isMyTurn && state.turn?.phase === "draw" && !pending;

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

  function handleLotClick(lotId: LotId) {
    playSound("chip");
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

  // Stable identity so memoized board cells don't re-render on every
  // state snapshot; the ref always points at the latest closure.
  const lotClickRef = useRef(handleLotClick);
  useEffect(() => {
    lotClickRef.current = handleLotClick;
  });
  const onLotClick = useCallback((lotId: LotId) => lotClickRef.current(lotId), []);

  const modeHint: string | null = (() => {
    if (myPendingRemoveDie)
      return "All 12 of your dice are on the board — tap one of your dice to move it to the new tile.";
    if (myPendingVacateLot)
      return "All 10 of your lot markers are placed — tap a lot to vacate its marker.";
    switch (mode.kind) {
      case "build-lot":
        return "Tap one of your parking lots to build on.";
      case "sprawl-from":
        return "Tap a casino you boss to sprawl from.";
      case "sprawl-to":
        return "Tap the adjacent empty lot to sprawl into (2× lot price + $15M per riser).";
      case "remodel-casino":
        return "Tap a casino you boss to remodel ($5M per space).";
      case "raise-casino":
        return `Tap a casino you boss to raise ($15M per space, max height ${state.players.length}).`;
      case "reorganize-casino":
        return "Tap a casino with your dice to reorganize ($1M per pip — all dice reroll).";
      case "gamble-casino":
        return "Tap another boss's casino to gamble there.";
      case "vacate-die":
        return "You're out of dice — tap one of your dice on the board to move it.";
      default:
        return null;
    }
  })();

  const waitingOnOthers =
    pending && !myPendingRemoveDie && !myPendingVacateLot && !myPendingReorg;

  return (
    <main className="mx-auto flex h-dvh max-h-dvh w-full max-w-[1600px] flex-col gap-1.5 overflow-hidden px-2 pb-2 pt-1.5 sm:px-3">
      {/* ------------------------------------------------ header */}
      <header className="flex shrink-0 items-center gap-2.5">
        <h1 className="marquee hidden text-lg leading-none sm:block">Lords of Vegas</h1>
        <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-xs font-bold tracking-[0.2em] text-[var(--accent)]">
          {state.roomCode}
        </span>
        <span className="text-[11px] text-muted">Turn {state.turn?.number}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <SoundToggle />
          <Link
            href={`/director/${state.roomCode}`}
            target="_blank"
            className="focus-ring rounded-md border border-[var(--border)] px-2 py-1.5 text-xs text-muted transition-colors hover:border-white/30 hover:text-white"
          >
            Director ↗
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------ scoreboard (mobile) */}
      <div className="shrink-0 lg:hidden">
        <PlayerChips state={state} viewerId={meId} />
      </div>

      {/* ------------------------------------------------ board + rails */}
      <div className="flex min-h-0 flex-1 gap-2.5">
        {/* -------------------------------------------- score track (full height) */}
        <aside className="hidden min-h-0 w-14 shrink-0 flex-col self-stretch lg:flex">
          <ScoreTrackPanel state={state} layout="column" className="min-h-0 flex-1 rounded-xl" />
        </aside>

        {/* -------------------------------------------- info rail: standings, tiles, log */}
        <aside className="scrollbar-thin hidden w-52 shrink-0 flex-col gap-2 self-stretch overflow-y-auto lg:flex">
          <Panel title="Standings" className="shrink-0">
            <PlayerStandingsTable state={state} viewerId={meId} />
          </Panel>
          <TilesLeftPanel state={state} className="shrink-0" />
          <Panel
            title="Game log"
            className="flex min-h-0 flex-1 flex-col"
            bodyClassName="flex min-h-0 flex-1 flex-col"
          >
            <LogPanel lines={stateLogLines(state.log)} className="min-h-0 flex-1" />
          </Panel>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
          <Board
            state={state}
            eligibleLots={eligibleLots}
            onLotClick={onLotClick}
            className="min-h-0 min-w-0 flex-1"
          />

          {/* -------------------------------------------- status strip (mobile: full action dock) */}
          <ActionDock
            placement="bottom"
            state={state}
            meId={meId}
            isMyTurn={isMyTurn}
            activeName={active?.name}
            mode={mode}
            setMode={setMode}
            modeHint={modeHint}
            waitingOnOthers={!!waitingOnOthers}
            hasPending={!!pending}
            myPendingChoice={myPendingRemoveDie || myPendingVacateLot}
            dispatch={dispatch}
            openSheet={setSheet}
          />
        </div>

        {/* -------------------------------------------- right rail */}
        <aside className="scrollbar-thin hidden w-[320px] shrink-0 flex-col gap-2 overflow-y-auto lg:flex">
          <Panel
            title="Deck & discards"
            titleClassName="text-[var(--accent)] tracking-[0.12em]"
            bodyClassName="pt-1"
          >
            <DiscardPiles
              state={state}
              canDraw={canDraw}
              onDraw={() => void dispatch({ type: "drawCard" })}
            />
          </Panel>
          <Panel title="Your stats" className="shrink-0">
            <MyStatsPanel state={state} playerId={meId} />
          </Panel>
          <ActionDock
            placement="sidebar"
            state={state}
            meId={meId}
            isMyTurn={isMyTurn}
            activeName={active?.name}
            mode={mode}
            setMode={setMode}
            modeHint={modeHint}
            waitingOnOthers={!!waitingOnOthers}
            hasPending={!!pending}
            myPendingChoice={myPendingRemoveDie || myPendingVacateLot}
            dispatch={dispatch}
            openSheet={setSheet}
          />
          <TradeCenter state={state} meId={meId} send={send} />
        </aside>
      </div>

      {/* ------------------------------------------------ overlays */}
      <TurnBanner isMyTurn={isMyTurn && state.phase === "playing"} color={me.color} />
      <GambleResultOverlay log={state.log} />

      <AnimatePresence>
        {error && (
          <motion.div
            key={error}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className="pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-[var(--accent-2)]/50 bg-[#2a1015]/95 px-4 py-2.5 text-sm font-semibold text-[var(--accent-2)] shadow-2xl backdrop-blur"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------ sheets (mobile) */}
      <AnimatePresence>
        {sheet === "log" && (
          <Sheet title="Game log" onClose={() => setSheet(null)}>
            <LogPanel lines={stateLogLines(state.log)} className="max-h-full" />
          </Sheet>
        )}
        {sheet === "trades" && (
          <Sheet title="Trades" onClose={() => setSheet(null)}>
            <TradeCenter state={state} meId={meId} send={send} />
          </Sheet>
        )}
        {sheet === "score" && (
          <Sheet title="Score track" onClose={() => setSheet(null)}>
            <ScoreTrackPanel state={state} />
          </Sheet>
        )}
        {sheet === "supply" && (
          <Sheet title="Deck & supply" onClose={() => setSheet(null)}>
            <div className="space-y-3 pt-1">
              <div>
                <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                  Deck & discards
                </h3>
                <DiscardPiles
                  state={state}
                  canDraw={canDraw}
                  onDraw={() => void dispatch({ type: "drawCard" })}
                />
              </div>
              <div>
                <TilesLeftPanel state={state} />
              </div>
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------ modals */}
      <AnimatePresence>
        {mode.kind === "build-color" && (
          <ColorModal
            key="build-color"
            title={`Build on ${mode.lotId} ($${BOARD_LOTS[mode.lotId].price}M)`}
            state={state}
            minTiles={1}
            onPick={(color) => sendAction({ type: "build", lotId: mode.lotId, color })}
            onClose={() => setMode({ kind: "idle" })}
          />
        )}
        {mode.kind === "remodel-color" && (
          <ColorModal
            key="remodel-color"
            title={`Remodel the casino at ${mode.lotId} ($5M per space)`}
            state={state}
            minTiles={casinoGroup(state.board, mode.lotId).length}
            exclude={state.board[mode.lotId].color ?? undefined}
            onPick={(color) => sendAction({ type: "remodel", lotId: mode.lotId, newColor: color })}
            onClose={() => setMode({ kind: "idle" })}
          />
        )}
        {mode.kind === "gamble-wager" && (
          <WagerModal
            key="gamble-wager"
            state={state}
            lotId={mode.lotId}
            wager={wager}
            setWager={setWager}
            myMoney={me.money}
            onRoll={(w) => sendAction({ type: "gamble", lotId: mode.lotId, wager: w })}
            onClose={() => setMode({ kind: "idle" })}
          />
        )}
        {myPendingReorg && pending?.kind === "reorgPlacement" && (
          <ReorgPlacementModal
            key="reorg"
            state={state}
            lots={pending.slots[meId]}
            values={pending.waiting[meId]}
            onSubmit={(placements) =>
              dispatch({ type: "chooseReorgPlacement", playerId: meId, placements })
            }
          />
        )}
      </AnimatePresence>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Action dock
// ---------------------------------------------------------------------------

const ACTIONS: { label: string; mode: Mode["kind"]; start: Mode }[] = [
  { label: "Build", mode: "build-lot", start: { kind: "build-lot" } },
  { label: "Sprawl", mode: "sprawl-from", start: { kind: "sprawl-from" } },
  { label: "Remodel", mode: "remodel-casino", start: { kind: "remodel-casino" } },
  { label: "Raise", mode: "raise-casino", start: { kind: "raise-casino" } },
  { label: "Reorganize", mode: "reorganize-casino", start: { kind: "reorganize-casino" } },
  { label: "Gamble", mode: "gamble-casino", start: { kind: "gamble-casino" } },
];

function isActionActive(a: (typeof ACTIONS)[number], mode: Mode): boolean {
  if (a.mode === "build-lot") return mode.kind.startsWith("build");
  if (a.mode === "sprawl-from") return mode.kind.startsWith("sprawl");
  if (a.mode === "remodel-casino") return mode.kind.startsWith("remodel");
  if (a.mode === "gamble-casino") return mode.kind.startsWith("gamble");
  return mode.kind === a.mode;
}

const ACTION_TILE_KIND: Record<(typeof ACTIONS)[number]["label"], ActionTileKind> = {
  Build: "build",
  Sprawl: "sprawl",
  Remodel: "remodel",
  Raise: "raise",
  Reorganize: "reorganize",
  Gamble: "gamble",
};

function ActionDock({
  placement,
  state,
  meId,
  isMyTurn,
  activeName,
  mode,
  setMode,
  modeHint,
  waitingOnOthers,
  hasPending,
  myPendingChoice,
  dispatch,
  openSheet,
}: {
  placement: "bottom" | "sidebar";
  state: GameState;
  meId: string;
  isMyTurn: boolean;
  activeName?: string;
  mode: Mode;
  setMode: (m: Mode) => void;
  modeHint: string | null;
  waitingOnOthers: boolean;
  hasPending: boolean;
  myPendingChoice: boolean;
  dispatch: (c: Command) => Promise<void>;
  openSheet: (s: SheetKind) => void;
}) {
  const me = state.players.find((p) => p.id === meId)!;
  const meta = PLAYER_COLORS[me.color];
  const drawPhase = state.turn?.phase === "draw";
  const drawnCard = state.turn?.drawnCard ?? null;
  const isSidebar = placement === "sidebar";

  const turnBadge = isMyTurn ? (
    <span
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold"
      style={{ background: meta.hex, color: meta.textHex }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white/90" />
      </span>
      Your turn
    </span>
  ) : (
    <span className="px-1 text-xs text-muted">
      {activeName ? (
        <>
          Waiting on <span className="font-semibold text-white">{activeName}</span>
          {drawPhase ? " to draw" : " to act"}
        </>
      ) : (
        "…"
      )}
    </span>
  );

  const showActions = isMyTurn && !hasPending;

  const renderActionButton = (a: (typeof ACTIONS)[number], className: string) => (
    <Button
      key={a.label}
      variant={isActionActive(a, mode) ? "gold" : "subtle"}
      size="sm"
      disabled={a.label === "Gamble" && state.turn?.gambleUsed}
      onClick={() => setMode(isActionActive(a, mode) ? { kind: "idle" } : a.start)}
      className={className}
    >
      {a.label}
    </Button>
  );

  const sidebarActionGrid = showActions && (
    <div className="grid grid-cols-3 gap-2">
      {drawPhase ? (
        <p className="col-span-3 rounded-md bg-[var(--accent)]/10 px-2 py-2 text-center text-[11px] font-medium text-[var(--accent)]">
          Tap the deck to draw →
        </p>
      ) : (
        <>
          {ACTIONS.map((a) => (
            <ActionTileButton
              key={a.label}
              kind={ACTION_TILE_KIND[a.label]}
              active={isActionActive(a, mode)}
              disabled={a.label === "Gamble" && !!state.turn?.gambleUsed}
              onClick={() => setMode(isActionActive(a, mode) ? { kind: "idle" } : a.start)}
            />
          ))}
          {mode.kind !== "idle" && (
            <ActionBarButton
              variant="ghost"
              sound="close"
              onClick={() => setMode({ kind: "idle" })}
              className="col-span-3"
            >
              Cancel
            </ActionBarButton>
          )}
          <EndTurnButton
            onClick={() => dispatch({ type: "endTurn" })}
            className="col-span-3"
          />
        </>
      )}
    </div>
  );

  const bottomActionControls = showActions && (
    drawPhase ? (
      <Button
        variant="gold"
        size="md"
        sound="cardDraw"
        onClick={() => dispatch({ type: "drawCard" })}
        className="flex-1 sm:min-w-[220px] sm:flex-none"
      >
        Draw a property card
      </Button>
    ) : (
      <>
        {ACTIONS.map((a) => renderActionButton(a, "min-h-[36px]"))}
        {mode.kind !== "idle" && (
          <Button
            variant="ghost"
            size="sm"
            sound="close"
            onClick={() => setMode({ kind: "idle" })}
            className="min-h-[36px]"
          >
            Cancel
          </Button>
        )}
        <EndTurnButton
          onClick={() => dispatch({ type: "endTurn" })}
          className="min-h-[40px] basis-full"
        />
      </>
    )
  );

  if (isSidebar) {
    return (
      <Panel
        title="Actions"
        className={`shrink-0 transition-colors ${
          isMyTurn
            ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.07] shadow-[0_0_18px_rgba(245,197,66,0.12),inset_0_0_0_1px_rgba(245,197,66,0.15)]"
            : ""
        }`}
        bodyClassName="space-y-2"
      >
        <AnimatePresence mode="wait">
          {(modeHint || waitingOnOthers) && (
            <motion.p
              key={modeHint ?? "waiting"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                modeHint
                  ? "bg-[var(--accent)]/12 text-[var(--accent)]"
                  : "bg-purple-500/10 text-purple-300"
              }`}
            >
              {modeHint ?? "Waiting for another player's choice…"}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-2">
          {turnBadge}
          <AnimatePresence>
            {drawnCard && <DrawnCardChip key={drawnCard.id} card={drawnCard} />}
          </AnimatePresence>
        </div>

        {sidebarActionGrid}

        {isMyTurn && myPendingChoice && (
          <p className="text-xs font-semibold text-[var(--accent)]">Choose on the board →</p>
        )}
      </Panel>
    );
  }

  return (
    <div
      className={`shrink-0 rounded-xl border px-2.5 py-2 transition-colors sm:px-3 lg:hidden ${
        isMyTurn
          ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.07] shadow-[0_0_18px_rgba(245,197,66,0.12),inset_0_0_0_1px_rgba(245,197,66,0.15)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <AnimatePresence mode="wait">
        {(modeHint || waitingOnOthers) && (
          <motion.p
            key={modeHint ?? "waiting"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className={`mb-1.5 rounded-md px-2 py-1 text-xs font-medium ${
              modeHint
                ? "bg-[var(--accent)]/12 text-[var(--accent)]"
                : "bg-purple-500/10 text-purple-300"
            }`}
          >
            {modeHint ?? "Waiting for another player's choice…"}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-2">
          {turnBadge}
          <AnimatePresence>
            {drawnCard && <DrawnCardChip key={drawnCard.id} card={drawnCard} />}
          </AnimatePresence>
        </div>

        {bottomActionControls && (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">{bottomActionControls}</div>
        )}

        {isMyTurn && myPendingChoice && (
          <span className="ml-auto text-xs font-semibold text-[var(--accent)]">
            Choose on the board ↑
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {(
            [
              ["trades", "Trades"],
              ["score", "Score"],
              ["supply", "Supply"],
              ["log", "Log"],
            ] as [Exclude<SheetKind, null>, string][]
          ).map(([k, label]) => {
            const needsMyApproval =
              k === "trades" &&
              !!state.trade &&
              state.trade.participants.includes(meId) &&
              !state.trade.approvals.includes(meId);
            return (
              <Button
                key={k}
                variant={needsMyApproval ? "gold" : "ghost"}
                size="xs"
                sound="open"
                onClick={() => openSheet(k)}
                className={`min-h-[32px] ${needsMyApproval ? "eligible-pulse" : ""}`}
              >
                {label}
                {needsMyApproval && <span aria-hidden="true">•</span>}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawn card chip
// ---------------------------------------------------------------------------

function DrawnCardChip({ card }: { card: PropertyCard }) {
  const isStrip = card.pays === "strip";
  const bg = isStrip ? "var(--accent)" : CASINOS[card.pays as CasinoColor].hex;
  const fg = isStrip ? "#1a1a1a" : CASINOS[card.pays as CasinoColor].textHex;
  const deckName = isStrip ? "Strip" : CASINOS[card.pays as CasinoColor].name;
  return (
    <motion.span
      initial={{ rotateY: 90, opacity: 0, scale: 0.8 }}
      animate={{ rotateY: 0, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="flex items-center gap-1.5 rounded-md border border-white/25 px-2 py-1 text-[11px] font-bold shadow-md"
      style={{ background: bg, color: fg, transformStyle: "preserve-3d" }}
      title={`Drawn card: ${card.lotId} (${deckName} pays)`}
    >
      <span className="rounded-sm bg-black/25 px-1 font-mono text-white">{card.lotId}</span>
      {deckName} pays
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// Turn banner overlay
// ---------------------------------------------------------------------------

function TurnBanner({ isMyTurn, color }: { isMyTurn: boolean; color: keyof typeof PLAYER_COLORS }) {
  const [show, setShow] = useState(false);
  const prevRef = useRef(isMyTurn);

  useEffect(() => {
    const wasMyTurn = prevRef.current;
    prevRef.current = isMyTurn;
    if (!wasMyTurn && isMyTurn) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 1900);
      return () => clearTimeout(t);
    }
  }, [isMyTurn]);

  const meta = PLAYER_COLORS[color];
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center"
        >
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className="flex w-full items-center justify-center py-5"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${meta.hex}33 18%, ${meta.hex}55 50%, ${meta.hex}33 82%, transparent 100%)`,
              backdropFilter: "blur(2px)",
            }}
          >
            <motion.span
              initial={{ y: 22, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ delay: 0.08, type: "spring", stiffness: 300, damping: 22 }}
              className="marquee text-4xl sm:text-5xl"
            >
              Your Turn
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Gamble result overlay (dice roll shown to everyone at the table)
// ---------------------------------------------------------------------------

interface GambleResult {
  key: string;
  roll: number;
  message: string;
}

function GambleResultOverlay({ log }: { log: LogEvent[] }) {
  const [result, setResult] = useState<GambleResult | null>(null);
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const keys = log.map((e) => `${e.at}:${e.message}`);
    if (!seenRef.current) {
      seenRef.current = new Set(keys);
      return;
    }
    for (let i = 0; i < log.length; i++) {
      const e = log[i];
      const k = keys[i];
      if (seenRef.current.has(k)) continue;
      seenRef.current.add(k);
      if (e.type === "action" && typeof e.data?.roll === "number") {
        setResult({ key: k, roll: e.data.roll as number, message: e.message });
      }
    }
  }, [log]);

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 4200);
    return () => clearTimeout(t);
  }, [result]);

  if (!result) return null;
  // Present the 2d6 sum as a plausible pair of faces.
  const d1 = Math.min(6, Math.max(1, Math.ceil(result.roll / 2)));
  const d2 = result.roll - d1;

  return (
    <AnimatePresence>
      <motion.div
        key={result.key}
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="pointer-events-none fixed bottom-20 left-1/2 z-[58] w-[min(92vw,480px)] -translate-x-1/2"
      >
        <div className="felt gold-rail flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl">
          <div className="flex shrink-0 gap-1.5">
            <RollingDie value={d1} palette={HOUSE_DIE} size={40} rollOnMount />
            <RollingDie value={d2} palette={HOUSE_DIE} size={40} rollOnMount />
          </div>
          <p className="text-xs font-semibold leading-snug text-white/90">{result.message}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

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
    <Modal onClose={onClose} title={title}>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {CASINO_COLOR_KEYS.map((c, i) => {
          const supply = state.tileSupply[c];
          const disabled = c === exclude || supply < minTiles;
          return (
            <motion.button
              key={c}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.045 }}
              whileTap={disabled ? undefined : { scale: 0.97 }}
              disabled={disabled}
              onClick={() => {
                playSound("chip");
                onPick(c);
              }}
              className="focus-ring flex min-h-[44px] items-center justify-between rounded-lg px-3 py-2 text-sm font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
              style={{ background: `linear-gradient(160deg, ${CASINOS[c].hex}, ${CASINOS[c].darkHex})`, color: CASINOS[c].textHex }}
            >
              {CASINOS[c].name}
              <span className="text-xs opacity-80">{supply} tiles left</span>
            </motion.button>
          );
        })}
      </div>
    </Modal>
  );
}

function WagerModal({
  state,
  lotId,
  wager,
  setWager,
  myMoney,
  onRoll,
  onClose,
}: {
  state: GameState;
  lotId: LotId;
  wager: number;
  setWager: (w: number) => void;
  myMoney: number;
  onRoll: (wager: number) => void;
  onClose: () => void;
}) {
  const maxBet = Math.min(
    casinoPoints(state.board, casinoGroup(state.board, lotId)) * 5,
    myMoney,
  );
  const clamped = Math.min(Math.max(1, wager), Math.max(1, maxBet));

  return (
    <Modal onClose={onClose} title={`Gamble at ${lotId}`}>
      <p className="mt-1 text-xs text-muted">
        Maximum bet ${maxBet}M · 2 or 12 pays double · 3, 4, 9, 10, 11 pays your bet · 5–8 the
        House wins.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={Math.max(1, maxBet)}
          value={clamped}
          onChange={(e) => setWager(parseInt(e.target.value) || 1)}
          className="focus-ring flex-1 accent-[var(--accent)]"
          aria-label="Wager amount"
        />
        <span className="w-16 rounded-md bg-black/40 px-2 py-1 text-center font-mono text-sm font-bold text-[var(--money)]">
          ${clamped}M
        </span>
      </div>
      <div className="mt-2 flex gap-1.5">
        {[1, Math.ceil(maxBet / 2), maxBet].map((v, i) => (
          <Button
            key={i}
            variant="ghost"
            size="xs"
            sound="chip"
            onClick={() => setWager(Math.max(1, v))}
            className="flex-1"
          >
            {i === 0 ? "Min" : i === 1 ? "Half" : "Max"} (${Math.max(1, v)}M)
          </Button>
        ))}
      </div>
      <Button
        variant="gold"
        size="md"
        sound="diceRoll"
        onClick={() => onRoll(clamped)}
        className="mt-4 w-full"
      >
        Roll the dice — ${clamped}M
      </Button>
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
    <Modal onClose={() => {}} showCancel={false} title="Place your rerolled dice">
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
              className="focus-ring rounded-md border border-[var(--border)] bg-black/40 px-2 py-1.5 text-sm"
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
      <Button
        variant="gold"
        size="md"
        sound="diceLand"
        disabled={!valid}
        onClick={() => onSubmit(assignment)}
        className="mt-4 w-full"
      >
        Place dice
      </Button>
    </Modal>
  );
}
