"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Bottom panel that slides up while its height animates open, so the board
 * above shrinks smoothly instead of snapping.
 */
export function BottomSlideBar({
  barKey,
  children,
}: {
  barKey: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div key={barKey}>{children}</div>;
  }

  return (
    <motion.div
      key={barKey}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        height: { duration: 0.38, ease: EASE },
        opacity: { duration: 0.22, ease: "easeOut" },
      }}
      className="overflow-hidden"
    >
      <motion.div
        initial={{ y: 32 }}
        animate={{ y: 0 }}
        exit={{ y: 24 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
