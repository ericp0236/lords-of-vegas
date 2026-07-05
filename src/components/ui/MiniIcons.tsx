/** Tiny inline glyphs for dice / lot-marker counts (replaces emoji, which
 * render inconsistently across platforms). */

export function MiniDie({ className = "" }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" rx="2.2" fill="none" stroke="currentColor" />
      <circle cx="3.2" cy="3.2" r="1" fill="currentColor" />
      <circle cx="6.8" cy="6.8" r="1" fill="currentColor" />
    </svg>
  );
}

export function MiniMarker({ className = "" }: { className?: string }) {
  return (
    <svg width="11" height="10" viewBox="0 0 11 10" className={className} aria-hidden="true">
      <rect x="0.5" y="2.5" width="10" height="6" rx="1.8" fill="none" stroke="currentColor" />
      <path
        d="M2.5 2.5 L4 0.8 H7 L8.5 2.5"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}
