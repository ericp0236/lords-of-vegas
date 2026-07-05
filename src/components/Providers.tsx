"use client";

import { MotionConfig } from "motion/react";

/** App-wide client providers. `reducedMotion="user"` disables transform
 * animations for users with a reduced-motion OS preference. */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
