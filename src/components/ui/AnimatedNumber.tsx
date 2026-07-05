"use client";

/**
 * Number that springs toward its new value instead of snapping — used for
 * money and scores so changes are noticeable and satisfying.
 */

import { useEffect } from "react";
import { motion, useSpring, useTransform } from "motion/react";

export function AnimatedNumber({
  value,
  format = (v: number) => String(Math.round(v)),
  className = "",
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const spring = useSpring(value, { stiffness: 110, damping: 22 });
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  const text = useTransform(spring, (v) => format(v));
  return <motion.span className={`tabular-nums ${className}`}>{text}</motion.span>;
}
