"use client";

/**
 * Trade UI: propose (with optional bundled active-player actions), approve,
 * reject, cancel, and execute. One pending trade per game.
 */

import { useMemo, useState } from "react";
import type { LotId } from "@/data/boardLots";
import { BOARD_LOTS } from "@/data/boardLots";
import { CASINOS, CASINO_COLOR_KEYS, type CasinoColor } from "@/data/casinoCards";
import { diceLots, parkingLots } from "@/engine/helpers";
import type { ActionCommand, GameState, TradeStep } from "@/engine/types";
import {
  bossCasinoLots,
  buildTargets,
  gambleTargets,
  reorganizeTargets,
  sprawlTargets,
} from "@/lib/candidates";
import type { useGame } from "@/lib/useGame";

export function TradeCenter({
  state,
  meId,
  send,
}: {
  state: GameState;
  meId: string;
  send: ReturnType<typeof useGame>["send"];
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const trade = state.trade;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Trades</h2>
      {trade ? (
        <PendingTrade state={state} meId={meId} send={send} />
      ) : (
        <>
          <button
            onClick={() => setBuilderOpen(true)}
            disabled={state.phase !== "playing" || !!state.pendingChoice}
            className="w-full rounded-lg bg-sky-500/20 py-2 text-sm font-bold text-sky-300 hover:bg-sky-500/30 disabled:opacity-40"
          >
            Propose a trade
          </button>
          {builderOpen && (
            <TradeBuilder
              state={state}
              meId={meId}
              onClose={() => setBuilderOpen(false)}
              onPropose={async (steps) => {
                setBuilderOpen(false);
                await send(meId, { type: "proposeTrade", steps });
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

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

function PendingTrade({
  state,
  meId,
  send,
}: {
  state: GameState;
  meId: string;
  send: ReturnType<typeof useGame>["send"];
}) {
  const trade = state.trade!;
  const proposer = state.players.find((p) => p.id === trade.proposerId);
  const iAmParticipant = trade.participants.includes(meId);
  const iApproved = trade.approvals.includes(meId);
  const isProposer = trade.proposerId === meId;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        <span className="font-semibold text-white">{proposer?.name}</span> proposes:
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
      <div className="flex gap-2">
        {iAmParticipant && !iApproved && (
          <>
            <button
              onClick={() => send(meId, { type: "approveTrade" })}
              className="flex-1 rounded-md bg-emerald-500 py-1.5 text-xs font-bold text-black hover:brightness-110"
            >
              Approve
            </button>
            <button
              onClick={() => send(meId, { type: "rejectTrade" })}
              className="flex-1 rounded-md bg-[var(--accent-2)] py-1.5 text-xs font-bold text-black hover:brightness-110"
            >
              Reject
            </button>
          </>
        )}
        {iAmParticipant && iApproved && !isProposer && (
          <button
            onClick={() => send(meId, { type: "rejectTrade" })}
            className="flex-1 rounded-md bg-[var(--accent-2)]/60 py-1.5 text-xs font-bold text-black hover:brightness-110"
          >
            Withdraw (reject)
          </button>
        )}
        {isProposer && (
          <>
            <button
              onClick={() => send(meId, { type: "executeTrade" })}
              disabled={trade.status !== "ready"}
              className="flex-1 rounded-md bg-[var(--accent)] py-1.5 text-xs font-bold text-black hover:brightness-110 disabled:opacity-40"
            >
              {trade.status === "ready" ? "Execute trade" : "Awaiting approvals…"}
            </button>
            <button
              onClick={() => send(meId, { type: "cancelTrade" })}
              className="flex-1 rounded-md bg-white/10 py-1.5 text-xs font-bold hover:bg-white/20"
            >
              Cancel
            </button>
          </>
        )}
        {!iAmParticipant && <p className="text-xs text-muted">You aren&apos;t part of this trade.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type StepDraftKind = "money" | "lot" | "die" | "action";

const selectCls =
  "rounded-md border border-[var(--border)] bg-black/40 px-2 py-1 text-xs outline-none focus:border-[var(--accent)]";

function PlayerSelect({
  players,
  value,
  onChange,
}: {
  players: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function TradeBuilder({
  state,
  meId,
  onClose,
  onPropose,
}: {
  state: GameState;
  meId: string;
  onClose: () => void;
  onPropose: (steps: TradeStep[]) => void;
}) {
  const [steps, setSteps] = useState<TradeStep[]>([]);
  const [kind, setKind] = useState<StepDraftKind>("money");
  const players = [...state.players].sort((a, b) => a.seat - b.seat);
  const activeId = state.turn?.activePlayerId;

  // money draft
  const [mFrom, setMFrom] = useState(meId);
  const [mTo, setMTo] = useState(players.find((p) => p.id !== meId)?.id ?? meId);
  const [mAmount, setMAmount] = useState(1);
  // lot draft
  const [lFrom, setLFrom] = useState(meId);
  const [lTo, setLTo] = useState(players.find((p) => p.id !== meId)?.id ?? meId);
  const [lLot, setLLot] = useState<LotId | "">("");
  // die draft
  const [dFrom, setDFrom] = useState(meId);
  const [dTo, setDTo] = useState(players.find((p) => p.id !== meId)?.id ?? meId);
  const [dLot, setDLot] = useState<LotId | "">("");
  // action draft (always the active player)
  const [aType, setAType] = useState<ActionCommand["type"]>("build");
  const [aLot, setALot] = useState<LotId | "">("");
  const [aLot2, setALot2] = useState<LotId | "">("");
  const [aColor, setAColor] = useState<CasinoColor>("albion");
  const [aWager, setAWager] = useState(1);

  const lotOptions = useMemo(() => (lFrom ? parkingLots(state, lFrom) : []), [state, lFrom]);
  const dieOptions = useMemo(() => (dFrom ? diceLots(state, dFrom) : []), [state, dFrom]);

  const actionLotOptions = useMemo(() => {
    if (!activeId) return [];
    switch (aType) {
      case "build":
        return buildTargets(state, activeId);
      case "sprawl":
      case "remodel":
      case "raise":
        return bossCasinoLots(state, activeId);
      case "reorganize":
        return reorganizeTargets(state, activeId);
      case "gamble":
        return gambleTargets(state, activeId);
    }
  }, [state, activeId, aType]);

  const sprawlToOptions = useMemo(
    () => (aType === "sprawl" && aLot ? sprawlTargets(state, aLot) : []),
    [state, aType, aLot],
  );

  function addStep() {
    if (kind === "money") {
      if (mFrom === mTo || mAmount < 1) return;
      setSteps([...steps, { type: "money", from: mFrom, to: mTo, amount: mAmount }]);
    } else if (kind === "lot") {
      if (lFrom === lTo || !lLot) return;
      setSteps([...steps, { type: "lot", from: lFrom, to: lTo, lotId: lLot }]);
      setLLot("");
    } else if (kind === "die") {
      if (dFrom === dTo || !dLot) return;
      setSteps([...steps, { type: "die", from: dFrom, to: dTo, lotId: dLot }]);
      setDLot("");
    } else if (kind === "action" && activeId) {
      let action: ActionCommand | null = null;
      if (aType === "build" && aLot) action = { type: "build", lotId: aLot, color: aColor };
      if (aType === "sprawl" && aLot && aLot2)
        action = { type: "sprawl", fromLot: aLot, toLot: aLot2 };
      if (aType === "remodel" && aLot) action = { type: "remodel", lotId: aLot, newColor: aColor };
      if (aType === "raise" && aLot) action = { type: "raise", lotId: aLot };
      if (aType === "reorganize" && aLot) action = { type: "reorganize", lotId: aLot };
      if (aType === "gamble" && aLot) action = { type: "gamble", lotId: aLot, wager: aWager };
      if (!action) return;
      setSteps([...steps, { type: "action", player: activeId, action }]);
      setALot("");
      setALot2("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="scrollbar-thin max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold">Propose a trade</h3>
        <p className="mt-1 text-xs text-muted">
          Steps execute in order. If a step can&apos;t happen, later steps don&apos;t occur. Every
          affected player must approve.
        </p>

        {steps.length > 0 && (
          <ol className="mt-3 space-y-1 text-xs">
            {steps.map((step, i) => (
              <li key={i} className="flex items-center gap-2 rounded bg-black/25 px-2 py-1">
                <span className="flex-1">
                  {i + 1}. {describeStep(state, step)}
                </span>
                <button
                  onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                  className="text-[var(--accent-2)] hover:brightness-125"
                  aria-label="Remove step"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-4 rounded-lg border border-[var(--border)] bg-black/20 p-3">
          <div className="mb-2 grid grid-cols-4 gap-1 rounded-md bg-black/30 p-0.5">
            {(["money", "lot", "die", "action"] as StepDraftKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded px-1 py-1 text-[11px] font-bold capitalize ${
                  kind === k ? "bg-[var(--accent)] text-black" : "text-muted hover:text-white"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {kind === "money" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <PlayerSelect players={players} value={mFrom} onChange={setMFrom} />
              <span>pays</span>
              <PlayerSelect players={players} value={mTo} onChange={setMTo} />
              <span>$</span>
              <input
                type="number"
                min={1}
                value={mAmount}
                onChange={(e) => setMAmount(parseInt(e.target.value) || 1)}
                className={`${selectCls} w-16`}
              />
              <span>M</span>
            </div>
          )}

          {kind === "lot" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <PlayerSelect players={players} value={lFrom} onChange={setLFrom} />
              <span>gives lot</span>
              <select value={lLot} onChange={(e) => setLLot(e.target.value)} className={selectCls}>
                <option value="">—</option>
                {lotOptions.map((id) => (
                  <option key={id} value={id}>
                    {id} (${BOARD_LOTS[id].price}M)
                  </option>
                ))}
              </select>
              <span>to</span>
              <PlayerSelect players={players} value={lTo} onChange={setLTo} />
            </div>
          )}

          {kind === "die" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <PlayerSelect players={players} value={dFrom} onChange={setDFrom} />
              <span>gives die on</span>
              <select value={dLot} onChange={(e) => setDLot(e.target.value)} className={selectCls}>
                <option value="">—</option>
                {dieOptions.map((id) => (
                  <option key={id} value={id}>
                    {id} ({state.board[id].die?.value})
                  </option>
                ))}
              </select>
              <span>to</span>
              <PlayerSelect players={players} value={dTo} onChange={setDTo} />
            </div>
          )}

          {kind === "action" && (
            <div className="space-y-2 text-xs">
              <p className="text-muted">
                Bundled action by the active player (
                {players.find((p) => p.id === activeId)?.name ?? "—"}):
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={aType}
                  onChange={(e) => {
                    setAType(e.target.value as ActionCommand["type"]);
                    setALot("");
                    setALot2("");
                  }}
                  className={selectCls}
                >
                  {["build", "sprawl", "remodel", "raise", "reorganize", "gamble"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select value={aLot} onChange={(e) => setALot(e.target.value)} className={selectCls}>
                  <option value="">lot…</option>
                  {actionLotOptions?.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
                {aType === "sprawl" && (
                  <select
                    value={aLot2}
                    onChange={(e) => setALot2(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">into…</option>
                    {sprawlToOptions.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                )}
                {(aType === "build" || aType === "remodel") && (
                  <select
                    value={aColor}
                    onChange={(e) => setAColor(e.target.value as CasinoColor)}
                    className={selectCls}
                  >
                    {CASINO_COLOR_KEYS.map((c) => (
                      <option key={c} value={c}>
                        {CASINOS[c].name}
                      </option>
                    ))}
                  </select>
                )}
                {aType === "gamble" && (
                  <input
                    type="number"
                    min={1}
                    value={aWager}
                    onChange={(e) => setAWager(parseInt(e.target.value) || 1)}
                    className={`${selectCls} w-16`}
                  />
                )}
              </div>
            </div>
          )}

          <button
            onClick={addStep}
            className="mt-3 w-full rounded-md bg-white/10 py-1.5 text-xs font-bold hover:bg-white/20"
          >
            + Add step
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onPropose(steps)}
            disabled={steps.length === 0}
            className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
          >
            Propose ({steps.length} step{steps.length === 1 ? "" : "s"})
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-muted hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
