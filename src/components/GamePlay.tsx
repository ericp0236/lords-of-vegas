"use client";

/**
 * In-game player view, organized around the decision loop:
 *   - mobile: compact player chips under the header
 *   - score track: narrow leftmost column, full height
 *   - info rail (desktop): standings table, tiles left, game log
 *   - center: the board + a slim status strip (hints / turn)
 *   - right rail (desktop): deck & discards, your stats, actions, trades
 *   - phones/tablets: actions stay in the bottom dock; reference panels use
 *     slide-up sheets.
 * All state changes go through `send` → engine `applyCommand` → CAS write.
 */

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BOARD_LOTS, type LotId } from "@/data/boardLots";
import type { CasinoColor } from "@/data/casinoCards";
import { PLAYER_COLORS, type PlayerColor } from "@/data/playerColors";
import { bossOf, casinoGroup, casinoPoints } from "@/engine/casinos";
import {
  GAMBLE_PAYOUT_TIERS,
  gambleDoublePayout,
  gambleWinPayout,
} from "@/lib/gambleRules";
import { diceExhausted, parkingLots } from "@/engine/helpers";
import type { ActionCommand, Command, GameState } from "@/engine/types";
import { actionHintTitle } from "@/lib/actionHints";
import {
  buildTargets,
  gambleTargets,
  isActionAvailable,
  raiseTargets,
  remodelTargets,
  reorganizeTargets,
  sprawlFromTargets,
  sprawlTargets,
  vacateDieCandidates,
  type ActionKind,
} from "@/lib/candidates";
import { playSound } from "@/lib/sound/SoundManager";
import { useGameFeedback } from "@/lib/useGameFeedback";
import { useReorgRollPhase } from "@/lib/useReorgRollPhase";
import type { useGame } from "@/lib/useGame";
import { Board, type BoardOverlayDie } from "./Board";
import { CasinoColorBar } from "./CasinoColorBar";
import { RollingDie } from "./DieFace";
import { DiscardPiles } from "./DiscardPiles";
import { GambleResultOverlay } from "./GambleResultOverlay";
import { TilesLeftPanel } from "./TilesLeftPanel";
import { LogPanel, stateLogLines } from "./LogPanel";
import { MyStatsPanel } from "./MyStatsPanel";
import { PlayerChips, PlayerStandingsTable } from "./PlayerChips";
import { ScoreTrackPanel } from "./ScoreTrackPanel";
import { TradeBuilderBar, TradeCenter } from "./TradeCenter";
import { Button } from "./ui/Button";
import { ActionBarButton, ActionTileButton, EndTurnButton, type ActionTileKind } from "./ui/ActionTileButton";
import { Modal } from "./ui/Modal";
import { Panel } from "./ui/Panel";
import { Sheet } from "./ui/Sheet";
import { SoundToggle } from "./ui/SoundToggle";

type Mode =
  | { kind: "idle" }
  | { kind: "build"; lotId?: LotId; color?: CasinoColor }
  | { kind: "sprawl-from" }
  | { kind: "sprawl-to"; fromLot: LotId }
  | { kind: "remodel-casino" }
  | { kind: "remodel-color"; lotId: LotId }
  | { kind: "raise-casino" }
  | { kind: "reorganize-casino" }
  | { kind: "gamble-casino" }
  | { kind: "gamble-wager"; lotId: LotId }
  | { kind: "vacate-die"; pending: ActionCommand }
  | { kind: "trade-builder" };

type SheetKind = "log" | "trades" | "score" | "supply" | null;

interface ReorgDraft {
  slots: LotId[];
  remaining: number[];
  placements: Record<LotId, number>;
}

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
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [wager, setWager] = useState(1);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [reorgDraft, setReorgDraft] = useState<ReorgDraft | null>(null);
  const [selectedReorgIdx, setSelectedReorgIdx] = useState<number | null>(null);
  const [selectedReorgLot, setSelectedReorgLot] = useState<LotId | null>(null);
  const [reorgSessionKey, setReorgSessionKey] = useState<string | null>(null);

  useGameFeedback(state, meId);

  const { inRollPhase, rollOverlays } = useReorgRollPhase(
    state.pendingChoice,
    state.players,
    state.turn?.reorgReveal,
  );

  const me = state.players.find((p) => p.id === meId)!;
  const isMyTurn = state.turn?.activePlayerId === meId;
  const inActions = isMyTurn && state.turn?.phase === "actions";
  const pending = state.pendingChoice;
  const active = state.players.find((p) => p.id === state.turn?.activePlayerId);

  useEffect(() => {
    if (error) playSound("error");
  }, [error]);

  // Close the trade builder if a trade becomes pending, a choice interrupts,
  // or the game leaves the playing phase (mirrors the propose-button rules).
  const tradeBuilderBlocked =
    !!state.trade || !!state.pendingChoice || state.phase !== "playing";
  useEffect(() => {
    if (tradeBuilderBlocked && modeRef.current.kind === "trade-builder") {
      setMode({ kind: "idle" });
    }
  }, [tradeBuilderBlocked]);

  // ------------------------------------------------------- pending choices
  const myPendingRemoveDie = pending?.kind === "removeDie" && pending.playerId === meId;
  const myPendingVacateLot = pending?.kind === "vacateLot" && pending.playerId === meId;
  const myPendingReorg =
    pending?.kind === "reorgPlacement" && pending.waiting[meId] !== undefined;
  const canDraw = isMyTurn && state.turn?.phase === "draw" && !pending;

  const pendingReorgKey = useMemo(() => {
    if (!myPendingReorg || pending?.kind !== "reorgPlacement") return null;
    const slots = pending.slots[meId];
    const values = pending.waiting[meId];
    if (!slots || !values) return null;
    return `${slots.join(",")}:${values.join(",")}`;
  }, [myPendingReorg, pending, meId]);

  // Init draft once per reorg pending choice — do not reset on unrelated realtime ticks.
  useLayoutEffect(() => {
    if (pendingReorgKey === reorgSessionKey) return;
    setReorgSessionKey(pendingReorgKey);
    setSelectedReorgIdx(null);
    setSelectedReorgLot(null);
    if (pendingReorgKey && pending?.kind === "reorgPlacement") {
      setReorgDraft({
        slots: pending.slots[meId],
        remaining: [...pending.waiting[meId]],
        placements: {},
      });
    } else {
      setReorgDraft(null);
    }
  }, [pendingReorgKey, reorgSessionKey, pending, meId]);

  const reorgComplete =
    !!reorgDraft &&
    reorgDraft.remaining.length === 0 &&
    reorgDraft.slots.every((lot) => reorgDraft.placements[lot] !== undefined);

  const reorgOverlayDice = useMemo((): Partial<Record<LotId, BoardOverlayDie>> => {
    if (!reorgDraft) return {};
    const overlays: Partial<Record<LotId, BoardOverlayDie>> = {};
    for (const [lot, value] of Object.entries(reorgDraft.placements)) {
      overlays[lot as LotId] = { value, color: me.color };
    }
    return overlays;
  }, [reorgDraft, me.color]);

  const boardOverlayDice = useMemo(() => {
    if (inRollPhase) return rollOverlays;
    return reorgOverlayDice;
  }, [inRollPhase, rollOverlays, reorgOverlayDice]);

  // ------------------------------------------------------- eligible lots
  const { eligibleLots, clickableLots } = useMemo(() => {
    if (myPendingReorg && reorgDraft && !inRollPhase) {
      const slots = reorgDraft.slots;
      const unplaced = slots.filter((lot) => reorgDraft.placements[lot] === undefined);
      return {
        eligibleLots: unplaced.length > 0 ? new Set(unplaced) : new Set<LotId>(),
        clickableLots: new Set(slots),
      };
    }
    if (myPendingRemoveDie && pending?.kind === "removeDie") {
      const lots = new Set(vacateDieCandidates(state, meId, pending.targetLot));
      return { eligibleLots: lots, clickableLots: lots };
    }
    if (myPendingVacateLot) {
      const lots = new Set(parkingLots(state, meId));
      return { eligibleLots: lots, clickableLots: lots };
    }
    if (!inActions || pending) {
      return { eligibleLots: new Set<LotId>(), clickableLots: new Set<LotId>() };
    }
    const lots = (() => {
      switch (mode.kind) {
        case "build":
          return new Set(buildTargets(state, meId));
        case "sprawl-from":
          return new Set(sprawlFromTargets(state, meId));
        case "remodel-casino":
          return new Set(remodelTargets(state, meId));
        case "remodel-color":
          return new Set([mode.lotId]);
        case "raise-casino":
          return new Set(raiseTargets(state, meId));
        case "sprawl-to":
          return new Set(sprawlTargets(state, mode.fromLot, meId));
        case "reorganize-casino":
          return new Set(reorganizeTargets(state, meId));
        case "gamble-casino":
          return new Set(gambleTargets(state, meId));
        case "vacate-die":
          return new Set(vacateDieCandidates(state, meId));
        default:
          return new Set<LotId>();
      }
    })();
    const clickableLots =
      mode.kind === "remodel-color" ? new Set<LotId>() : lots;
    return { eligibleLots: lots, clickableLots };
  }, [
    state,
    meId,
    mode,
    inActions,
    pending,
    myPendingRemoveDie,
    myPendingVacateLot,
    myPendingReorg,
    reorgDraft,
    inRollPhase,
  ]);

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

  function placeReorgDie(lotId: LotId, dieIdx: number) {
    if (!reorgDraft || dieIdx < 0 || dieIdx >= reorgDraft.remaining.length) return;
    const value = reorgDraft.remaining[dieIdx];
    setReorgDraft({
      ...reorgDraft,
      placements: { ...reorgDraft.placements, [lotId]: value },
      remaining: reorgDraft.remaining.filter((_, i) => i !== dieIdx),
    });
    setSelectedReorgIdx(null);
    setSelectedReorgLot(null);
    playSound("diceLand");
  }

  function autoReorgDieIdx(draft: ReorgDraft): number | null {
    if (draft.remaining.length === 0) return null;
    const v = draft.remaining[0];
    if (draft.remaining.every((x) => x === v)) return 0;
    if (draft.remaining.length === 1) return 0;
    return null;
  }

  /** When every remaining die shows the same value, placement doesn't matter — fill all slots. */
  useEffect(() => {
    if (inRollPhase || !myPendingReorg || !reorgDraft) return;
    const { remaining, slots, placements } = reorgDraft;
    if (remaining.length === 0 || remaining.length !== slots.filter((lot) => placements[lot] === undefined).length) {
      return;
    }
    const v = remaining[0];
    if (!remaining.every((x) => x === v)) return;
    const newPlacements = { ...placements };
    for (const lot of slots) {
      if (newPlacements[lot] === undefined) newPlacements[lot] = v;
    }
    setReorgDraft({ ...reorgDraft, placements: newPlacements, remaining: [] });
    setSelectedReorgIdx(null);
    setSelectedReorgLot(null);
    playSound("diceLand");
  }, [inRollPhase, myPendingReorg, reorgDraft]);

  function handleReorgDieSelect(idx: number) {
    if (!reorgDraft) return;
    playSound("chip");

    if (selectedReorgLot !== null) {
      placeReorgDie(selectedReorgLot, idx);
      return;
    }

    setSelectedReorgLot(null);
    setSelectedReorgIdx(selectedReorgIdx === idx ? null : idx);
  }

  function handleBuildColorPick(color: CasinoColor) {
    const m = modeRef.current;
    if (m.kind !== "build") return;
    if (m.lotId) {
      sendAction({ type: "build", lotId: m.lotId, color });
      return;
    }
    setMode({ kind: "build", color: m.color === color ? undefined : color, lotId: m.lotId });
  }

  function handleLotClick(lotId: LotId) {
    playSound("chip");
    if (myPendingRemoveDie) return void dispatch({ type: "chooseRemoveDie", lotId });
    if (myPendingVacateLot) return void dispatch({ type: "chooseVacateLot", lotId });
    if (myPendingReorg && reorgDraft) {
      if (!reorgDraft.slots.includes(lotId)) return;

      const placed = reorgDraft.placements[lotId];
      if (placed !== undefined) {
        const { [lotId]: removed, ...rest } = reorgDraft.placements;
        setReorgDraft({
          ...reorgDraft,
          placements: rest,
          remaining: [...reorgDraft.remaining, removed],
        });
        setSelectedReorgIdx(null);
        setSelectedReorgLot(null);
        return;
      }

      if (selectedReorgIdx !== null) {
        placeReorgDie(lotId, selectedReorgIdx);
        return;
      }

      const autoIdx = autoReorgDieIdx(reorgDraft);
      if (autoIdx !== null) {
        placeReorgDie(lotId, autoIdx);
        return;
      }

      setSelectedReorgIdx(null);
      setSelectedReorgLot(selectedReorgLot === lotId ? null : lotId);
      return;
    }
    switch (modeRef.current.kind) {
      case "build": {
        const m = modeRef.current;
        const nextLot = m.lotId === lotId ? undefined : lotId;
        if (m.color && nextLot) {
          return sendAction({ type: "build", lotId: nextLot, color: m.color });
        }
        return setMode({ kind: "build", lotId: nextLot, color: m.color });
      }
      case "sprawl-from":
        return setMode({ kind: "sprawl-to", fromLot: lotId });
      case "sprawl-to":
        return sendAction({ type: "sprawl", fromLot: modeRef.current.fromLot, toLot: lotId });
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
        const withVacate = { ...modeRef.current.pending, vacateDieLot: lotId } as ActionCommand;
        return sendAction(withVacate);
      }
    }
  }

  // Stable identity so memoized board cells don't re-render on every
  // state snapshot; the ref always points at the latest closure.
  const lotClickRef = useRef(handleLotClick);
  useLayoutEffect(() => {
    lotClickRef.current = handleLotClick;
  });
  const onLotClick = useCallback((lotId: LotId) => lotClickRef.current(lotId), []);

  const modeHint: string | null = (() => {
    if (myPendingRemoveDie)
      return "All 12 of your dice are on the board — tap one of your dice to move it to the new tile.";
    if (myPendingVacateLot)
      return "All 10 of your lot markers are placed — tap a lot to vacate its marker.";
    if (inRollPhase && (pending?.kind === "reorgPlacement" || state.turn?.reorgReveal?.length)) {
      return "Dice rerolling…";
    }
    if (myPendingReorg && reorgDraft) {
      if (reorgComplete) return "All dice placed — tap Confirm below.";
      if (selectedReorgIdx !== null)
        return "Tap a highlighted tile to place the selected die.";
      if (selectedReorgLot !== null)
        return `Tap a die below to place on ${selectedReorgLot}.`;
      const autoIdx = autoReorgDieIdx(reorgDraft);
      if (autoIdx !== null) return "Tap a highlighted tile on the board to place a die.";
      return "Select a die or a tile first — then select the other.";
    }
    switch (mode.kind) {
      case "build":
        if (mode.lotId) return "Choose a casino color below.";
        if (mode.color) return "Tap one of your parking lots to build on.";
        return "Pick a casino color below or tap one of your parking lots.";
      case "remodel-color":
        return "Choose a new casino color below.";
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
      case "trade-builder":
        return "Compose trade steps below — every affected player must approve.";
      default:
        return null;
    }
  })();

  const waitingOnOthers =
    pending && !myPendingRemoveDie && !myPendingVacateLot && !myPendingReorg;

  const buildFocusedLots =
    mode.kind === "build" && mode.lotId ? new Set([mode.lotId]) : undefined;

  return (
    <main className="city-backdrop mx-auto flex h-dvh max-h-dvh w-full max-w-[1600px] flex-col gap-1.5 overflow-hidden px-2 pb-2 pt-1.5 sm:px-3">
      {/* ------------------------------------------------ header */}
      <header className="relative flex shrink-0 items-center gap-2.5">
        {isMyTurn && state.phase === "playing" && <YourTurnBadge color={me.color} />}
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
            Spectator ↗
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
        <aside className="scrollbar-thin hidden w-64 shrink-0 flex-col gap-2 self-stretch overflow-y-auto lg:flex">
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

        <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto] gap-1.5">
          <Board
            state={state}
            eligibleLots={eligibleLots}
            clickableLots={clickableLots}
            focusedLots={buildFocusedLots ?? (selectedReorgLot ? new Set([selectedReorgLot]) : undefined)}
            overlayDice={boardOverlayDice}
            onLotClick={onLotClick}
            className="min-h-0 min-w-0 overflow-hidden"
          />

          <div className="relative z-20 min-h-0 overflow-hidden">
            <AnimatePresence initial={false}>
              {mode.kind === "build" && (
                <motion.div
                  key="build"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="overflow-hidden"
                >
                  <CasinoColorBar
                    lotId={mode.lotId}
                    selectedColor={mode.color}
                    action="build"
                    priceLabel={mode.lotId ? `$${BOARD_LOTS[mode.lotId].price}M` : "Select lot"}
                    state={state}
                    minTiles={1}
                    onPick={handleBuildColorPick}
                    onClose={() => setMode({ kind: "idle" })}
                  />
                </motion.div>
              )}
              {mode.kind === "remodel-color" && (
                <motion.div
                  key={`remodel-${mode.lotId}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="overflow-hidden"
                >
                  <CasinoColorBar
                    lotId={mode.lotId}
                    action="remodel"
                    priceLabel="$5M/space"
                    state={state}
                    minTiles={casinoGroup(state.board, mode.lotId).length}
                    exclude={state.board[mode.lotId].color ?? undefined}
                    onPick={(color) =>
                      sendAction({ type: "remodel", lotId: mode.lotId, newColor: color })
                    }
                    onClose={() => setMode({ kind: "idle" })}
                  />
                </motion.div>
              )}
              {mode.kind === "trade-builder" && (
                <motion.div
                  key="trade-builder"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="overflow-hidden"
                >
                  <TradeBuilderBar
                    state={state}
                    meId={meId}
                    onClose={() => setMode({ kind: "idle" })}
                    onPropose={async (steps) => {
                      setMode({ kind: "idle" });
                      await send(meId, { type: "proposeTrade", steps });
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {myPendingReorg && reorgDraft && pending?.kind === "reorgPlacement" && !inRollPhase && (
              <ReorgPlacementBar
                playerColor={me.color}
                remaining={reorgDraft.remaining}
                selectedIdx={selectedReorgIdx}
                selectedLot={selectedReorgLot}
                onSelectDie={handleReorgDieSelect}
                complete={reorgComplete}
                onConfirm={() =>
                  dispatch({
                    type: "chooseReorgPlacement",
                    playerId: meId,
                    placements: reorgDraft.placements,
                  })
                }
              />
            )}
          </div>

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
            myPendingChoice={myPendingRemoveDie || myPendingVacateLot || myPendingReorg}
            dispatch={dispatch}
            openSheet={setSheet}
          />
        </div>

        {/* -------------------------------------------- right rail */}
        <aside className="scrollbar-thin hidden w-[320px] shrink-0 flex-col gap-2 overflow-y-auto lg:flex">
          <Panel bodyClassName="p-2 pt-1">
            <DiscardPiles
              state={state}
              drawnCard={state.turn?.drawnCard ?? null}
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
            myPendingChoice={myPendingRemoveDie || myPendingVacateLot || myPendingReorg}
            dispatch={dispatch}
            openSheet={setSheet}
          />
          <TradeCenter
            state={state}
            meId={meId}
            send={send}
            onOpenBuilder={() => setMode({ kind: "trade-builder" })}
          />
        </aside>
      </div>

      {/* ------------------------------------------------ overlays */}
      <TurnBanner isMyTurn={isMyTurn && state.phase === "playing"} color={me.color} />
      <GambleResultOverlay
        log={state.log}
        meId={meId}
        players={state.players}
        onRevealRoll={(gambleAt) => void send(meId, { type: "revealGambleRoll", gambleAt })}
        onStopRoll={(gambleAt) => void send(meId, { type: "stopGambleRoll", gambleAt })}
      />

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
            <TradeCenter
              state={state}
              meId={meId}
              send={send}
              onOpenBuilder={() => {
                setSheet(null);
                setMode({ kind: "trade-builder" });
              }}
            />
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
              <DiscardPiles
                state={state}
                drawnCard={state.turn?.drawnCard ?? null}
                canDraw={canDraw}
                onDraw={() => void dispatch({ type: "drawCard" })}
              />
              <div>
                <TilesLeftPanel state={state} />
              </div>
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------ modals */}
      <AnimatePresence>
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
      </AnimatePresence>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Action dock
// ---------------------------------------------------------------------------

const ACTIONS: { label: string; mode: Mode["kind"]; start: Mode }[] = [
  { label: "Build", mode: "build", start: { kind: "build" } },
  { label: "Sprawl", mode: "sprawl-from", start: { kind: "sprawl-from" } },
  { label: "Remodel", mode: "remodel-casino", start: { kind: "remodel-casino" } },
  { label: "Raise", mode: "raise-casino", start: { kind: "raise-casino" } },
  { label: "Reorganize", mode: "reorganize-casino", start: { kind: "reorganize-casino" } },
  { label: "Gamble", mode: "gamble-casino", start: { kind: "gamble-casino" } },
];

function isActionActive(a: (typeof ACTIONS)[number], mode: Mode): boolean {
  if (a.mode === "build") return mode.kind === "build";
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

const ACTION_AVAILABILITY: Record<(typeof ACTIONS)[number]["label"], ActionKind> = {
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
  const drawPhase = state.turn?.phase === "draw";
  const isSidebar = placement === "sidebar";

  const waitingLabel = !isMyTurn ? (
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
  ) : null;

  const showActions = isMyTurn && !hasPending;

  const isActionDisabled = (a: (typeof ACTIONS)[number]) =>
    !isActionAvailable(state, meId, ACTION_AVAILABILITY[a.label]);

  const renderActionButton = (a: (typeof ACTIONS)[number], className: string) => (
    <Button
      key={a.label}
      variant={isActionActive(a, mode) ? "gold" : "subtle"}
      size="sm"
      disabled={isActionDisabled(a)}
      title={actionHintTitle(ACTION_AVAILABILITY[a.label], state.players.length)}
      onClick={() => setMode(isActionActive(a, mode) ? { kind: "idle" } : a.start)}
      className={className}
    >
      {a.label}
    </Button>
  );

  const actionHint = modeHint ?? (waitingOnOthers ? "Waiting for another player's choice…" : null);
  const actionHintTone = modeHint ? "accent" : "pending";

  const sidebarActionGrid = showActions && (
    <>
      <div className="grid grid-cols-3 gap-2">
        {drawPhase ? (
          <p className="col-span-3 rounded-md bg-[var(--accent)]/10 px-2 py-2 text-center text-[11px] font-medium text-[var(--accent)]">
            Tap the deck to draw →
          </p>
        ) : (
          ACTIONS.map((a, i) => (
            <ActionTileButton
              key={a.label}
              kind={ACTION_TILE_KIND[a.label]}
              active={isActionActive(a, mode)}
              disabled={isActionDisabled(a)}
              playerCount={state.players.length}
              hintAlign={i % 3 === 0 ? "start" : i % 3 === 2 ? "end" : "center"}
              onClick={() => setMode(isActionActive(a, mode) ? { kind: "idle" } : a.start)}
            />
          ))
        )}
      </div>

      {!drawPhase && (
        <>
          <div className="action-dock-hint" aria-live="polite">
            <AnimatePresence mode="wait">
              {actionHint && (
                <motion.p
                  key={actionHint}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className={`action-dock-hint__text action-dock-hint__text--${actionHintTone}`}
                >
                  {actionHint}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="action-dock-footer">
            {mode.kind !== "idle" && (
              <ActionBarButton
                variant="ghost"
                sound="close"
                onClick={() => setMode({ kind: "idle" })}
              >
                Cancel
              </ActionBarButton>
            )}
            <EndTurnButton onClick={() => dispatch({ type: "endTurn" })} />
          </div>
        </>
      )}
    </>
  );

  const bottomActionControls = showActions && (
    drawPhase ? (
      <Button
        variant="gold"
        size="md"
        sound="open"
        onClick={() => openSheet("supply")}
        className="flex-1 sm:min-w-[220px] sm:flex-none"
      >
        Draw from deck →
      </Button>
    ) : (
      <>
        {ACTIONS.map((a) => renderActionButton(a, "min-h-[36px]"))}
        <div className="action-dock-hint action-dock-hint--compact w-full" aria-live="polite">
          <AnimatePresence mode="wait">
            {actionHint && (
              <motion.p
                key={actionHint}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className={`action-dock-hint__text action-dock-hint__text--${actionHintTone}`}
              >
                {actionHint}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="action-dock-footer action-dock-footer--inline w-full">
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
            className="min-h-[40px] flex-1"
          />
        </div>
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
        {waitingLabel && (
          <div className="flex flex-wrap items-center gap-2">{waitingLabel}</div>
        )}

        {sidebarActionGrid}

        {isMyTurn && myPendingChoice && !actionHint && (
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
      <div className="flex flex-wrap items-center gap-1.5">
        {waitingLabel && (
          <div className="flex items-center gap-2">{waitingLabel}</div>
        )}

        {bottomActionControls && (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">{bottomActionControls}</div>
        )}

        {isMyTurn && myPendingChoice && !actionHint && (
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
// Turn indicator
// ---------------------------------------------------------------------------

function YourTurnBadge({ color }: { color: keyof typeof PLAYER_COLORS }) {
  const meta = PLAYER_COLORS[color];
  return (
    <span className="turn-marquee absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <span className="turn-marquee__die" aria-hidden>
        ⚄
      </span>
      <span className="turn-marquee__label">Your Turn</span>
      <span
        className="relative flex h-1.5 w-1.5 shrink-0"
        title={`Player color: ${color}`}
      >
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ background: meta.hex }}
        />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: meta.hex }} />
      </span>
    </span>
  );
}

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
// Modals
// ---------------------------------------------------------------------------

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
  const group = casinoGroup(state.board, lotId);
  const maxBet = Math.min(casinoPoints(state.board, group) * 5, myMoney);
  const clamped = Math.min(Math.max(1, wager), Math.max(1, maxBet));

  const bossId = bossOf(state.board, group);
  const boss = state.players.find((p) => p.id === bossId);
  const bossMoney = boss?.money ?? 0;
  const bossMeta = boss ? PLAYER_COLORS[boss.color] : null;

  const winPayout = gambleWinPayout(clamped, bossMoney);
  const doublePayout = gambleDoublePayout(clamped, bossMoney);
  const capped = clamped > bossMoney || clamped * 2 > bossMoney;

  return (
    <Modal onClose={onClose} title={`Gamble at ${lotId}`}>
      <p className="mt-1 text-xs text-muted">
        Maximum bet ${maxBet}M ·{" "}
        {GAMBLE_PAYOUT_TIERS.map((t) => `${t.rolls} ${t.result.toLowerCase()}`).join(
          " · ",
        )}
        .
      </p>

      {boss && bossMeta ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-black/25 px-3 py-2 text-xs">
          <p className="text-muted">
            <span className="font-semibold" style={{ color: bossMeta.hex }}>
              {boss.name}
            </span>{" "}
            (the House) has{" "}
            <span className="font-mono font-bold text-[var(--money)]">
              ${bossMoney}M
            </span>{" "}
            available for payouts.
          </p>
          <div className="mt-1.5 flex gap-4 text-muted">
            <span>
              Win (3,4,9–11):{" "}
              <span className="font-mono font-bold text-[var(--money)]">
                ${winPayout}M
              </span>
            </span>
            <span>
              Double (2/12):{" "}
              <span className="font-mono font-bold text-[var(--money)]">
                ${doublePayout}M
              </span>
            </span>
          </div>
          {capped && (
            <p className="mt-1.5 font-semibold text-amber-400">
              {boss.name} can only pay ${bossMoney}M — a winning bet above that
              won&apos;t be fully paid.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-[var(--border)] bg-black/25 px-3 py-2 text-xs text-muted">
          This casino has no single House boss, so a winning bet pays nothing.
        </p>
      )}

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

function ReorgPlacementBar({
  playerColor,
  remaining,
  selectedIdx,
  selectedLot,
  onSelectDie,
  complete,
  onConfirm,
}: {
  playerColor: PlayerColor;
  remaining: number[];
  selectedIdx: number | null;
  selectedLot: LotId | null;
  onSelectDie: (idx: number) => void;
  complete: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="reorg-placement-bar shrink-0 rounded-xl border border-[var(--accent)]/35 bg-black/50 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
            Place rerolled dice
          </p>
          {selectedLot && (
            <p className="text-xs font-medium text-white">
              Tile <span className="font-mono text-[var(--accent)]">{selectedLot}</span> selected —
              tap a die below
            </p>
          )}
          {selectedIdx !== null && !selectedLot && (
            <p className="text-xs font-medium text-white">
              Die showing{" "}
              <span className="font-mono text-[var(--accent)]">{remaining[selectedIdx]}</span>{" "}
              selected — tap a highlighted tile
            </p>
          )}
          {!selectedLot && selectedIdx === null && remaining.length > 0 && (
            <p className="text-xs text-muted">Tap a tile on the board or a die below — either first.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {remaining.length === 0 ? (
              <span className="text-xs text-muted">All dice on the board</span>
            ) : (
              remaining.map((value, idx) => (
                <button
                  key={`${idx}-${value}`}
                  type="button"
                  onClick={() => onSelectDie(idx)}
                  className={`focus-ring rounded-lg border p-1 transition-all ${
                    selectedIdx === idx
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 ring-2 ring-[var(--accent)]/40"
                      : "border-white/15 bg-black/30 hover:border-white/30"
                  }`}
                  aria-label={`Select die showing ${value}`}
                  aria-pressed={selectedIdx === idx}
                >
                  <RollingDie value={value} color={playerColor} size={36} />
                </button>
              ))
            )}
          </div>
        </div>
        {complete && (
          <Button variant="gold" size="md" sound="diceLand" onClick={onConfirm} className="shrink-0">
            Confirm placement
          </Button>
        )}
      </div>
    </div>
  );
}
