/** Tiny inline glyphs for dice / lot-marker counts and player car markers. */

const CAR_VIEWBOX = "0 0 20 10";

/** Side-profile car silhouette — readable from ~8px wide upward. */
export const CAR_SILHOUETTE_PATH =
  "M1 6.8L3.4 3.6H6.1L7.6 2H13.4L15.2 3.6H17.8C18.9 4 19.6 5 19.6 6.2V6.9H18.4C18.4 8.3 17.3 9.4 15.9 9.4C14.5 9.4 13.4 8.3 13.4 6.9H6.6C6.6 8.3 5.5 9.4 4.1 9.4C2.7 9.4 1.6 8.3 1.6 6.9H1V6.8Z";

export function MiniDie({ className = "" }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" rx="2.2" fill="none" stroke="currentColor" />
      <circle cx="3.2" cy="3.2" r="1" fill="currentColor" />
      <circle cx="6.8" cy="6.8" r="1" fill="currentColor" />
    </svg>
  );
}

/** Outline car for lot-marker counts in tables and stats. */
export function MiniMarker({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="6" viewBox={CAR_VIEWBOX} className={className} aria-hidden="true">
      <path d={CAR_SILHOUETTE_PATH} fill="currentColor" />
    </svg>
  );
}

/** Filled player car — score track, board lots, standings, chips. */
export function PlayerCarMarker({
  color,
  className = "",
  size = 14,
  title,
}: {
  color: string;
  className?: string;
  size?: number;
  title?: string;
}) {
  const height = Math.round(size * 0.5);
  return (
    <svg
      width={size}
      height={height}
      viewBox={CAR_VIEWBOX}
      className={`drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] ${className}`}
      aria-hidden={!title}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        d={CAR_SILHOUETTE_PATH}
        fill={color}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={size >= 28 ? 0.5 : 0.35}
        strokeLinejoin="round"
      />
    </svg>
  );
}
