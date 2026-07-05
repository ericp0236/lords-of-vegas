"use client";

/**
 * Shared button with press feedback (scale + click sound) and consistent
 * casino styling. All interactive buttons in the app should use this so
 * animation and audio behavior stay uniform.
 */

import { motion, type HTMLMotionProps } from "motion/react";
import { playSound, type SoundName } from "@/lib/sound/SoundManager";

export type ButtonVariant = "gold" | "ghost" | "subtle" | "danger" | "success" | "sky";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  gold: "btn-gold text-black font-bold",
  ghost: "border border-[var(--border)] text-muted hover:text-white hover:border-white/30 bg-transparent",
  subtle: "bg-white/10 text-white hover:bg-white/[0.18] font-bold",
  danger: "bg-gradient-to-b from-[#ff7086] to-[#e0435c] text-black font-bold shadow-[0_2px_10px_rgba(255,93,115,0.3)]",
  success: "bg-gradient-to-b from-[#3ddc97] to-[#16a34a] text-black font-bold shadow-[0_2px_10px_rgba(22,163,74,0.3)]",
  sky: "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 font-bold",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-[11px] rounded-md",
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-5 py-3 text-base rounded-xl",
};

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Sound played on press; null disables audio for this button */
  sound?: SoundName | null;
}

export function Button({
  variant = "subtle",
  size = "md",
  sound = "click",
  className = "",
  onClick,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      onClick={(e) => {
        if (sound) playSound(sound);
        onClick?.(e);
      }}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 select-none transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
