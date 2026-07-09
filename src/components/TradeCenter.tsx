"use client";

/**
 * Trade UI: propose (with optional bundled active-player actions), approve,
 * reject, cancel, and execute. One pending trade per game.
 */

import { useEffect, useMemo, useState } from "react";
import type { LotId } from "@/data/boardLots";
import { BOARD_LOTS } from "@/data/boardLots";
import { CASINOS } from "@/data/casinoCards";
import { PLAYER_COLORS, type PlayerColor } from "@/data/playerColors";
import { diceLots, parkingLots } from "@/engine/helpers";
import type { ActionCommand, GameState, TradeStep } from "@/engine/types";
import type { useGame } from "@/lib/useGame";
import { playSound } from "@/lib/sound/SoundManager";
import { Button } from "./ui/Button";
import { PlayerCarMarker } from "./ui/MiniIcons";
import { Panel } from "./ui/Panel";

export function TradeCenter({
  state,
  meId,
  send,
  onOpenBuilder,
}: {
  state: GameState;
  meId: string;
  send: ReturnType<typeof useGame>["send"];
  onOpenBuilder: () => void;
}) {
  const trade = state.trade;

  return (
    <Panel title="Trades">
      {trade ? (
        <PendingTrade state={state} meId={meId} send={send} />
      ) : (
        <Button
          variant="sky"
          size="sm"
          sound="open"
          onClick={onOpenBuilder}
          disabled={state.phase !== "playing" || !!state.pendingChoice}
          className="w-full"
        >
          Propose a trade
        </Button>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function playerNameNode(state: GameState, id: string) {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) return "?";
  return (
    <span style={{ color: PLAYER_COLORS[p.color].hex }} className="font-semibold">
      {p.name}
    </span>
  );
}

function StepLine({ state, step }: { state: GameState; step: TradeStep }) {
  switch (step.type) {
    case "money":
      return (
        <>
          {playerNameNode(state, step.from)} pays {playerNameNode(state, step.to)} ${step.amount}M
        </>
      );
    case "lot":
      return (
        <>
          {playerNameNode(state, step.from)} gives lot {step.lotId} to {playerNameNode(state, step.to)}
        </>
      );
    case "die":
      return (
        <>
          {playerNameNode(state, step.from)}&apos;s die on {step.lotId} goes to{" "}
          {playerNameNode(state, step.to)}
        </>
      );
    case "action":
      return (
        <>
          {playerNameNode(state, step.player)} performs: {describeAction(step.action)}
        </>
      );
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
            {i + 1}. <StepLine state={state} step={step} />
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
            <Button
              variant="success"
              size="sm"
              sound="success"
              onClick={() => send(meId, { type: "approveTrade" })}
              className="flex-1"
            >
              Approve
            </Button>
            <Button
              variant="danger"
              size="sm"
              sound="close"
              onClick={() => send(meId, { type: "rejectTrade" })}
              className="flex-1"
            >
              Reject
            </Button>
          </>
        )}
        {iAmParticipant && iApproved && !isProposer && (
          <Button
            variant="danger"
            size="sm"
            sound="close"
            onClick={() => send(meId, { type: "rejectTrade" })}
            className="flex-1 opacity-80"
          >
            Withdraw (reject)
          </Button>
        )}
        {isProposer && (
          <>
            <Button
              variant="gold"
              size="sm"
              sound="trade"
              onClick={() => send(meId, { type: "executeTrade" })}
              disabled={trade.status !== "ready"}
              className="flex-1"
            >
              {trade.status === "ready" ? "Execute trade" : "Awaiting approvals…"}
            </Button>
            <Button
              variant="subtle"
              size="sm"
              sound="close"
              onClick={() => send(meId, { type: "cancelTrade" })}
              className="flex-1"
            >
              Cancel
            </Button>
          </>
        )}
        {!iAmParticipant && <p className="text-xs text-muted">You aren&apos;t part of this trade.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type TradePlayer = { id: string; name: string; color: PlayerColor };

const fieldCls =
  "w-full rounded-md border border-[var(--border)] bg-black/40 px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)]";

function PlayerSelect({
  players,
  value,
  onChange,
  label,
  excludeId,
}: {
  players: TradePlayer[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  excludeId?: string;
}) {
  const options = excludeId ? players.filter((p) => p.id !== excludeId) : players;
  const selected = players.find((p) => p.id === value);
  const selectedHex = selected ? PLAYER_COLORS[selected.color].hex : undefined;

  return (
    <label className="trade-builder-bar__field">
      <span className="trade-builder-bar__label">{label}</span>
      <div className="trade-builder-bar__select-wrap">
        {selected && (
          <PlayerCarMarker color={PLAYER_COLORS[selected.color].hex} size={12} className="shrink-0" />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldCls} min-w-0 flex-1 font-semibold`}
          style={{ color: selectedHex }}
        >
          {options.map((p) => (
            <option key={p.id} value={p.id} style={{ color: PLAYER_COLORS[p.color].hex }}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

/** Inline bottom bar for composing a trade while the board stays visible. */
export function TradeBuilderBar({
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const players: TradePlayer[] = [...state.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({ id: p.id, name: p.name, color: p.color }));
  const defaultTo = players.find((p) => p.id !== meId)?.id ?? meId;

  const [from, setFrom] = useState(meId);
  const [to, setTo] = useState(defaultTo);
  const [amount, setAmount] = useState("");
  const [lotId, setLotId] = useState<LotId | "">("");
  const [dieLot, setDieLot] = useState<LotId | "">("");

  const lotOptions = useMemo(() => (from ? parkingLots(state, from) : []), [state, from]);
  const dieOptions = useMemo(() => (from ? diceLots(state, from) : []), [state, from]);
  const fromMoney = state.players.find((p) => p.id === from)?.money ?? 0;
  const moneyOptions = useMemo(
    () => Array.from({ length: fromMoney }, (_, i) => i + 1),
    [fromMoney],
  );

  useEffect(() => {
    if (lotId && !lotOptions.includes(lotId)) setLotId("");
  }, [lotId, lotOptions]);

  useEffect(() => {
    if (dieLot && !dieOptions.includes(dieLot)) setDieLot("");
  }, [dieLot, dieOptions]);

  useEffect(() => {
    if (amount !== "" && parseInt(amount, 10) > fromMoney) setAmount("");
  }, [amount, fromMoney]);

  function pickOtherPlayer(exclude: string) {
    return players.find((p) => p.id !== exclude)?.id;
  }

  function setFromPlayer(id: string) {
    setFrom(id);
    if (id === to) {
      const other = pickOtherPlayer(id);
      if (other) setTo(other);
    }
  }

  const parsedAmount = amount === "" ? 0 : parseInt(amount, 10);
  const canAdd =
    from !== to &&
    (dieLot !== "" || lotId !== "" || (parsedAmount >= 1 && !Number.isNaN(parsedAmount)));

  function addStep() {
    if (!canAdd) return;
    const next: TradeStep[] = [];
    if (parsedAmount >= 1) next.push({ type: "money", from, to, amount: parsedAmount });
    if (lotId) next.push({ type: "lot", from, to, lotId });
    if (dieLot) next.push({ type: "die", from, to, lotId: dieLot });
    if (next.length === 0) return;
    setSteps([...steps, ...next]);
    setAmount("");
    setLotId("");
    setDieLot("");
  }

  return (
    <div
      className="casino-color-bar trade-builder-bar w-full max-h-[min(52vh,320px)] shrink-0 overflow-hidden"
      role="region"
      aria-label="Propose a trade"
    >
      <header className="casino-color-bar__header">
        <div className="casino-color-bar__header-main">
          <TradeIcon />
          <span className="casino-color-bar__heading">Propose a trade</span>
          <span className="hidden text-[11px] text-muted sm:inline">
            Fill any combination on a row — money, lot, and casino can go together.
          </span>
        </div>
        <button
          type="button"
          className="casino-color-bar__close focus-ring"
          aria-label="Close"
          onClick={() => {
            playSound("close");
            onClose();
          }}
        >
          ×
        </button>
      </header>

      <div className="trade-builder-bar__body scrollbar-thin">
        <div className="trade-builder-bar__form rounded-lg border border-[var(--border)] bg-black/20 p-3">
          <div className="trade-builder-bar__row">
            <PlayerSelect label="From" players={players} value={from} onChange={setFromPlayer} />

            <span className="trade-builder-bar__sep" aria-hidden="true">
              ›
            </span>

            <label className="trade-builder-bar__field">
              <span className="trade-builder-bar__label">
                Money{fromMoney > 0 && <span className="text-muted"> (${fromMoney}M)</span>}
              </span>
              <select
                value={amount}
                disabled={fromMoney === 0}
                onChange={(e) => setAmount(e.target.value)}
                className={fieldCls}
              >
                <option value="">—</option>
                {moneyOptions.map((n) => (
                  <option key={n} value={n}>
                    ${n}M
                  </option>
                ))}
              </select>
            </label>

            <label className="trade-builder-bar__field">
              <span className="trade-builder-bar__label">Lot</span>
              <select
                value={lotId}
                onChange={(e) => setLotId(e.target.value as LotId | "")}
                className={fieldCls}
              >
                <option value="">—</option>
                {lotOptions.map((id) => (
                  <option key={id} value={id}>
                    {id} (${BOARD_LOTS[id].price}M)
                  </option>
                ))}
              </select>
            </label>

            <label className="trade-builder-bar__field">
              <span className="trade-builder-bar__label">Casino</span>
              <select
                value={dieLot}
                onChange={(e) => setDieLot(e.target.value as LotId | "")}
                className={fieldCls}
              >
                <option value="">—</option>
                {dieOptions.map((id) => (
                  <option key={id} value={id}>
                    {id} (pip {state.board[id].die?.value})
                  </option>
                ))}
              </select>
            </label>

            <span className="trade-builder-bar__sep" aria-hidden="true">
              ›
            </span>

            <PlayerSelect label="To" players={players} value={to} excludeId={from} onChange={setTo} />

            <Button
              variant="sky"
              size="sm"
              sound="chip"
              onClick={addStep}
              disabled={!canAdd}
              className="trade-builder-bar__add shrink-0 self-end"
            >
              + Add
            </Button>
          </div>
        </div>

        <div className="trade-builder-bar__footer">
          {steps.length > 0 ? (
            <ol className="trade-builder-bar__step-list scrollbar-thin text-xs">
              {steps.map((step, i) => (
                <li key={i} className="flex items-center gap-2 rounded bg-black/25 px-2 py-1">
                  <span className="min-w-0 flex-1">
                    {i + 1}. <StepLine state={state} step={step} />
                  </span>
                  <button
                    type="button"
                    onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                    className="shrink-0 text-[var(--accent-2)] hover:brightness-125"
                    aria-label="Remove step"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="trade-builder-bar__empty text-[11px] text-muted">
              No steps yet — combine money, lots, and casino dice on each row.
            </p>
          )}
          <Button
            variant="gold"
            size="md"
            sound="trade"
            onClick={() => onPropose(steps)}
            disabled={steps.length === 0}
            className="trade-builder-bar__propose shrink-0"
          >
            Propose ({steps.length})
          </Button>
        </div>
      </div>
    </div>
  );
}

function TradeIcon() {
  return (
    <svg
      className="casino-color-bar__action-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3l4 4-4 4" />
      <path d="M21 7H7" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M3 17h14" />
    </svg>
  );
}
