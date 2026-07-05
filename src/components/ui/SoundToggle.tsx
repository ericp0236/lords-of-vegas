"use client";

import { playSound, setMuted } from "@/lib/sound/SoundManager";
import { useSoundSettings } from "@/lib/sound/useSound";

/** Speaker mute toggle shown in game headers. */
export function SoundToggle({ className = "" }: { className?: string }) {
  const settings = useSoundSettings();
  const muted = settings.muted;
  return (
    <button
      type="button"
      onClick={() => {
        setMuted(!muted);
        if (muted) playSound("click"); // audible confirmation when unmuting
      }}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      aria-pressed={muted}
      title={muted ? "Unmute sounds" : "Mute sounds"}
      className={`focus-ring flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-muted transition-colors hover:border-white/30 hover:text-white ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 9v6h4l5 4V5L8 9H4z"
          fill="currentColor"
        />
        {muted ? (
          <path
            d="M16 9l5 6M21 9l-5 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ) : (
          <>
            <path
              d="M16 8.5a5 5 0 010 7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M18.5 6a8.5 8.5 0 010 12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </button>
  );
}
