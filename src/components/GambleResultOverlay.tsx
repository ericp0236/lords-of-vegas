"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { PLAYER_COLORS } from "@/data/playerColors";
import type { LogEvent, PlayerState } from "@/engine/types";
import { GAMBLE_PAYOUT_TIERS, gambleOutcome } from "@/lib/gambleRules";
import { playSound } from "@/lib/sound/SoundManager";
import { DieFace, HOUSE_DIE, RollingDie } from "./DieFace";
import { Button } from "./ui/Button";

interface GambleResult {
  key: string;
  gambleAt: number;
  roll: number;
  message: string;
  gamblerId: string;
  gamblerName: string;
  d1: number;
  d2: number;
}

type Phase = "ready" | "rolling" | "revealed";

function diceFaces(roll: number): { d1: number; d2: number } {
  const d1 = Math.min(6, Math.max(1, Math.ceil(roll / 2)));
  return { d1, d2: roll - d1 };
}

function rollStartFace(final: number): number {
  return final === 1 ? 6 : final - 1;
}

function gamblerFromEvent(e: LogEvent, players: PlayerState[]): string {
  if (typeof e.data?.playerId === "string") return e.data.playerId;
  const match = e.message.match(/^(.+?) wagers \$/);
  if (match) {
    const p = players.find((pl) => pl.name === match[1]);
    if (p) return p.id;
  }
  return "";
}

function phaseFromLog(log: LogEvent[], gambleAt: number): Phase {
  if (
    log.some(
      (e) =>
        e.type === "gamble-roll" &&
        e.data?.phase === "stop" &&
        e.data?.gambleAt === gambleAt,
    )
  ) {
    return "revealed";
  }
  if (
    log.some(
      (e) =>
        e.type === "gamble-roll" &&
        e.data?.phase === "start" &&
        e.data?.gambleAt === gambleAt,
    )
  ) {
    return "rolling";
  }
  return "ready";
}

/**
 * Centered dice-tray overlay shown to the whole table when a player gambles.
 * The gambler controls Roll / Stop (synced via log events); everyone else
 * watches the same animation in lockstep. Dice keep tumbling until Stop.
 */
export function GambleResultOverlay({
  log,
  meId,
  players,
  onRevealRoll,
  onStopRoll,
  onDismissRoll,
}: {
  log: LogEvent[];
  meId: string;
  players: PlayerState[];
  onRevealRoll: (gambleAt: number) => void;
  onStopRoll: (gambleAt: number) => void;
  onDismissRoll: (gambleAt: number) => void;
}) {
  const [result, setResult] = useState<GambleResult | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [rollTick, setRollTick] = useState(0);
  const [isGambler, setIsGambler] = useState(false);
  const seenRef = useRef<Set<string> | null>(null);
  const activeGambleAtRef = useRef<number | null>(null);

  const beginRolling = useCallback(() => {
    playSound("diceRoll");
    setRollTick((t) => t + 1);
    setPhase("rolling");
  }, []);

  const snapRevealed = useCallback(() => {
    setPhase("revealed");
    playSound("diceLand");
  }, []);

  const closeLocal = useCallback(() => {
    activeGambleAtRef.current = null;
    setResult(null);
  }, []);

  // The gambler's dismissal is broadcast so the tray closes for the whole
  // table; spectators close only their own view.
  const dismiss = useCallback(() => {
    if (isGambler && result) onDismissRoll(result.gambleAt);
    closeLocal();
  }, [isGambler, result, onDismissRoll, closeLocal]);

  useEffect(() => {
    const keys = log.map((e) => `${e.at}:${e.type}:${e.message}`);
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
        const roll = e.data.roll as number;
        const gamblerId = gamblerFromEvent(e, players);
        const gambler = players.find((p) => p.id === gamblerId);
        const initialPhase = phaseFromLog(log, e.at);
        activeGambleAtRef.current = e.at;
        setIsGambler(gamblerId === meId);
        setRollTick(initialPhase === "rolling" ? 1 : 0);
        setResult({
          key: k,
          gambleAt: e.at,
          roll,
          message: e.message,
          gamblerId,
          gamblerName: gambler?.name ?? "Player",
          ...diceFaces(roll),
        });
        setPhase(initialPhase);
        continue;
      }

      if (e.type === "gamble-roll" && typeof e.data?.gambleAt === "number") {
        const gambleAt = e.data.gambleAt as number;
        if (activeGambleAtRef.current !== gambleAt) continue;
        if (e.data.phase === "start") beginRolling();
        if (e.data.phase === "stop") snapRevealed();
        if (e.data.phase === "dismiss") closeLocal();
      }
    }
  }, [log, meId, players, beginRolling, snapRevealed, closeLocal]);

  const handleRoll = () => {
    if (!result || !isGambler || phase !== "ready") return;
    onRevealRoll(result.gambleAt);
  };

  const handleStop = () => {
    if (!result || !isGambler || phase !== "rolling") return;
    onStopRoll(result.gambleAt);
  };

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, dismiss]);

  const gamblerColor =
    players.find((p) => p.id === result?.gamblerId)?.color ?? "red";

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          key={result.key}
          className="fixed inset-0 z-[58] flex items-center justify-center bg-black/70 p-4 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismiss}
        >
          <motion.div
            className="gamble-result-overlay"
            data-outcome={gambleOutcome(result.roll)}
            data-phase={phase}
            data-view-only={!isGambler || undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {!isGambler && phase === "ready" && (
              <p className="gamble-result-overlay__watching">
                Waiting for{" "}
                <span style={{ color: PLAYER_COLORS[gamblerColor].hex }}>
                  {result.gamblerName}
                </span>{" "}
                to roll…
              </p>
            )}

            {!isGambler && phase === "rolling" && (
              <p className="gamble-result-overlay__watching">
                Watching{" "}
                <span style={{ color: PLAYER_COLORS[gamblerColor].hex }}>
                  {result.gamblerName}
                </span>
                {"'s roll"}
              </p>
            )}

            <div className="gamble-result-overlay__payouts">
              {GAMBLE_PAYOUT_TIERS.map((tier) => (
                <div
                  key={tier.outcome}
                  className="gamble-result-overlay__tier"
                  data-tier={tier.outcome}
                >
                  <span className="gamble-result-overlay__tier-rolls">
                    {tier.rolls}
                  </span>
                  <span className="gamble-result-overlay__tier-result">
                    {tier.result}
                  </span>
                </div>
              ))}
            </div>

            <div className="gamble-result-overlay__tray">
              {phase === "rolling" ? (
                <>
                  <RollingDie
                    key={`${result.key}-${rollTick}-d1`}
                    value={result.d1}
                    fromValue={rollStartFace(result.d1)}
                    palette={HOUSE_DIE}
                    size={60}
                    continuous
                    rollOnMount
                  />
                  <RollingDie
                    key={`${result.key}-${rollTick}-d2`}
                    value={result.d2}
                    fromValue={rollStartFace(result.d2)}
                    palette={HOUSE_DIE}
                    size={60}
                    continuous
                    rollOnMount
                  />
                </>
              ) : (
                <>
                  <DieFace
                    value={phase === "ready" ? rollStartFace(result.d1) : result.d1}
                    palette={HOUSE_DIE}
                    size={60}
                  />
                  <DieFace
                    value={phase === "ready" ? rollStartFace(result.d2) : result.d2}
                    palette={HOUSE_DIE}
                    size={60}
                  />
                </>
              )}
            </div>

            {isGambler && (
              <div className="gamble-result-overlay__actions">
                {phase === "ready" && (
                  <Button
                    variant="gold"
                    size="md"
                    sound={null}
                    onClick={handleRoll}
                    className="min-w-[8rem]"
                  >
                    Roll
                  </Button>
                )}
                {phase === "rolling" && (
                  <Button
                    variant="danger"
                    size="md"
                    sound={null}
                    onClick={handleStop}
                    className="min-w-[8rem]"
                  >
                    Stop
                  </Button>
                )}
              </div>
            )}

            <AnimatePresence>
              {phase === "revealed" && (
                <motion.p
                  className="gamble-result-overlay__outcome"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.28 }}
                >
                  {result.message}
                </motion.p>
              )}
            </AnimatePresence>

            {(phase === "revealed" || !isGambler) && (
              <p className="gamble-result-overlay__dismiss">
                {isGambler
                  ? "Click outside or press Esc to close for everyone"
                  : "Click outside or press Esc to close"}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
