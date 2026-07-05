/** Tiny inline glyphs for dice / lot-marker counts and player car markers. */

const CAR_SRC = "/car.png";
/** height / width of public/car.png */
const CAR_ASPECT = 85 / 128;

const carMaskStyle = {
  WebkitMaskImage: `url(${CAR_SRC})`,
  maskImage: `url(${CAR_SRC})`,
  WebkitMaskSize: "contain",
  maskSize: "contain" as const,
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat" as const,
  WebkitMaskPosition: "center",
  maskPosition: "center" as const,
};

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
  const width = 12;
  return (
    <span
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ width, height: Math.round(width * CAR_ASPECT), ...carMaskStyle }}
      aria-hidden="true"
    />
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
  return (
    <span
      className={`inline-block shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] ${className}`}
      style={{
        width: size,
        height: Math.round(size * CAR_ASPECT),
        backgroundColor: color,
        ...carMaskStyle,
      }}
      aria-hidden={!title}
      role={title ? "img" : undefined}
      title={title}
    />
  );
}
