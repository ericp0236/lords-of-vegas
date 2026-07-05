"use client";

/**
 * Animated modal dialog: backdrop blur fade + spring pop entrance, with
 * open/close sounds. Mount conditionally inside <AnimatePresence> for the
 * exit animation to play.
 */

import { useEffect } from "react";
import { motion } from "motion/react";
import { playSound } from "@/lib/sound/SoundManager";
import { Button } from "./Button";

export function Modal({
  children,
  onClose,
  title,
  cancelLabel = "Cancel",
  showCancel = true,
  maxWidth = "max-w-sm",
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  maxWidth?: string;
}) {
  useEffect(() => {
    playSound("open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    playSound("close");
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[3px]"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className={`scrollbar-thin max-h-[85vh] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="text-sm font-bold text-white">{title}</h3>}
        {children}
        {showCancel && (
          <Button variant="ghost" size="sm" sound="close" onClick={onClose} className="mt-3 w-full">
            {cancelLabel}
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}
