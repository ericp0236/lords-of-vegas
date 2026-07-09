"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import type { LogEvent } from "@/engine/types";

const TYPE_COLORS: Record<string, string> = {
  scoring: "text-[var(--accent)]",
  "casino-payout": "text-emerald-400",
  "parking-payout": "text-emerald-300/80",
  trade: "text-sky-300",
  reroll: "text-orange-300",
  "game-over": "text-[var(--accent-2)] font-semibold",
  choice: "text-purple-300",
};

export interface LogLine {
  key: string | number;
  type: string;
  message: string;
  turn: number;
}

export function LogPanel({
  lines,
  className = "",
  autoScroll = true,
}: {
  lines: LogLine[];
  className?: string;
  autoScroll?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length, autoScroll]);

  return (
    <div className={`scrollbar-thin overflow-y-auto text-xs leading-relaxed ${className}`}>
      {lines.map((line, index) => (
        <motion.div
          key={`${line.key}-${index}`}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="flex gap-2 border-b border-white/5 py-1"
        >
          <span className="shrink-0 font-mono text-[10px] text-white/30">T{line.turn}</span>
          <span className={TYPE_COLORS[line.type] ?? "text-white/80"}>{line.message}</span>
        </motion.div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

export function stateLogLines(log: LogEvent[]): LogLine[] {
  return log
    .filter((e) => e.type !== "gamble-roll")
    .map((e, i) => ({ key: `${e.at}-${i}`, type: e.type, message: e.message, turn: e.turn }));
}
