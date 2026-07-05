"use client";

/**
 * Bottom sheet for phone/tablet layouts: slides up over the board with a
 * drag handle. Mount conditionally inside <AnimatePresence>.
 */

import { useEffect } from "react";
import { motion } from "motion/react";
import { playSound } from "@/lib/sound/SoundManager";

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    playSound("open");
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
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-[2px]"
      onClick={handleClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 90 || info.velocity.y > 500) handleClose();
        }}
        className="flex max-h-[75dvh] flex-col rounded-t-2xl border-t border-x border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_50px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{title}</h2>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="focus-ring rounded-md px-2 py-1 text-xs text-muted hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}
