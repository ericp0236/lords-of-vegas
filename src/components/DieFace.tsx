import { PLAYER_COLORS, type PlayerColor } from "@/data/playerColors";

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

export function DieFace({
  value,
  color,
  size = 28,
}: {
  value: number;
  color: PlayerColor;
  size?: number;
}) {
  const meta = PLAYER_COLORS[color];
  const pips = PIP_LAYOUTS[value] ?? [];
  const pad = size * 0.18;
  const cell = (size - pad * 2) / 2;
  const r = size * 0.09;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${meta.name} die showing ${value}`}
      className="drop-shadow-md"
    >
      <rect
        x={0.5}
        y={0.5}
        width={size - 1}
        height={size - 1}
        rx={size * 0.2}
        fill={meta.hex}
        stroke="rgba(255,255,255,0.35)"
      />
      {pips.map(([row, col], i) => (
        <circle
          key={i}
          cx={pad + col * cell}
          cy={pad + row * cell}
          r={r}
          fill={meta.textHex}
        />
      ))}
    </svg>
  );
}
