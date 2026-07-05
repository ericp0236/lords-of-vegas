"use client";

/**
 * Animated money display: the value springs to its new amount and a small
 * "+$5M" / "−$9M" chip floats up whenever it changes, so payouts and spends
 * are impossible to miss — even on other players' turns.
 */

import { useEffect, useState } from "react";
import { AnimatedNumber } from "./AnimatedNumber";

interface Floater {
  id: number;
  delta: number;
}

let floaterId = 0;

export function MoneyValue({
  amount,
  className = "",
}: {
  amount: number;
  className?: string;
}) {
  const [prevAmount, setPrevAmount] = useState(amount);
  const [floaters, setFloaters] = useState<Floater[]>([]);

  // Derived-state-during-render: when the amount changes, queue a floater.
  if (amount !== prevAmount) {
    setPrevAmount(amount);
    setFloaters((f) => [...f.slice(-2), { id: ++floaterId, delta: amount - prevAmount }]);
  }

  useEffect(() => {
    if (floaters.length === 0) return;
    const timer = setTimeout(() => setFloaters((f) => f.slice(1)), 1700);
    return () => clearTimeout(timer);
  }, [floaters]);

  return (
    <span className={`relative inline-block ${className}`}>
      <AnimatedNumber
        value={amount}
        format={(v) => `$${Math.round(v)}M`}
        className="font-mono font-bold text-[var(--money)]"
      />
      {floaters.map((f) => (
        <span
          key={f.id}
          className={`float-up pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 text-[10px] font-bold ${
            f.delta > 0
              ? "bg-emerald-950/90 text-[var(--money)]"
              : "bg-rose-950/90 text-[var(--accent-2)]"
          }`}
        >
          {f.delta > 0 ? "+" : "−"}${Math.abs(f.delta)}M
        </span>
      ))}
    </span>
  );
}
