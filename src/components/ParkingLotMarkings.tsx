/** Subtle parking-lot hint lines for unbuilt board lots. */

export function ParkingLotMarkings({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {[25, 50, 75].map((x) => (
        <line key={`t-${x}`} x1={x} y1={10} x2={x} y2={24} className="parking-lot-line" />
      ))}
      {[30, 55, 80].map((y) => (
        <line key={`l-${y}`} x1={10} y1={y} x2={24} y2={y} className="parking-lot-line" />
      ))}
      {[30, 55, 80].map((y) => (
        <line key={`r-${y}`} x1={90} y1={y} x2={76} y2={y} className="parking-lot-line" />
      ))}
      {[25, 75].map((x) => (
        <line key={`b-${x}`} x1={x} y1={90} x2={x} y2={76} className="parking-lot-line" />
      ))}
    </svg>
  );
}
