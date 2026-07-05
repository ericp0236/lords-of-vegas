/**
 * Scoring track values, transcribed from the physical board.
 * Index 0 is the off-track start position (0 points).
 * Gaps > 1 are "breaks": a single casino's score must cover the whole gap
 * to advance past it; excess points are lost.
 */
export const SCORE_TRACK: number[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 23, 26, 29, 32, 36,
  40, 44, 49, 54, 60, 66, 73, 81, 90,
];

export const MAX_TRACK_INDEX = SCORE_TRACK.length - 1;
export const JACKPOT = SCORE_TRACK[MAX_TRACK_INDEX]; // 90

export interface TrackStep {
  fromIndex: number;
  toIndex: number;
  fromValue: number;
  toValue: number;
  /** Points a single casino score must earn to reach the next space */
  gap: number;
  isBreak: boolean;
}

/** Describe the next scoring advance from a track position. */
export function stepFrom(trackIndex: number): TrackStep | null {
  if (trackIndex >= MAX_TRACK_INDEX) return null;
  const fromValue = SCORE_TRACK[trackIndex];
  const toValue = SCORE_TRACK[trackIndex + 1];
  const gap = toValue - fromValue;
  return {
    fromIndex: trackIndex,
    toIndex: trackIndex + 1,
    fromValue,
    toValue,
    gap,
    isBreak: gap > 1,
  };
}

/** Points a single casino score must earn to leave this space (0 at jackpot). */
export function advanceGapAt(trackIndex: number): number {
  if (trackIndex >= MAX_TRACK_INDEX) return 0;
  return stepFrom(trackIndex)!.gap;
}

/** Points required to enter this space from the previous one (1 at the start). */
export function entryGapAt(trackIndex: number): number {
  if (trackIndex === 0) return 1;
  return SCORE_TRACK[trackIndex] - SCORE_TRACK[trackIndex - 1];
}

/** Consecutive track indices in the same break tier (grouped by entry gap). */
export interface TrackTier {
  gap: number;
  fromIndex: number;
  toIndex: number;
  fromValue: number;
  toValue: number;
}

export function trackTiers(): TrackTier[] {
  const tiers: TrackTier[] = [];
  let fromIndex = 0;
  let gap = entryGapAt(0);

  // Jackpot (last index) is laid out separately in the UI.
  for (let i = 1; i < MAX_TRACK_INDEX; i++) {
    const entryGap = entryGapAt(i);
    if (entryGap !== gap) {
      tiers.push({
        gap,
        fromIndex,
        toIndex: i - 1,
        fromValue: SCORE_TRACK[fromIndex],
        toValue: SCORE_TRACK[i - 1],
      });
      fromIndex = i;
      gap = entryGap;
    }
  }

  tiers.push({
    gap,
    fromIndex,
    toIndex: MAX_TRACK_INDEX - 1,
    fromValue: SCORE_TRACK[fromIndex],
    toValue: SCORE_TRACK[MAX_TRACK_INDEX - 1],
  });

  return tiers;
}

export interface TrackGridTier {
  gap: number;
  rows: number[][];
}

/** Lay out track indices in rows of `cols`, starting a new row at each tier. */
export function buildTrackGrid(cols = 3): { tiers: TrackGridTier[]; jackpotIndex: number } {
  const tiers: TrackGridTier[] = [];

  for (const tier of trackTiers()) {
    const indices: number[] = [];
    for (let i = tier.fromIndex; i <= tier.toIndex; i++) indices.push(i);

    const rows: number[][] = [];
    for (let i = 0; i < indices.length; i += cols) {
      rows.push(indices.slice(i, i + cols));
    }
    tiers.push({ gap: tier.gap, rows });
  }

  return { tiers, jackpotIndex: MAX_TRACK_INDEX };
}

/**
 * Advance a marker from `trackIndex` by `points` (one casino's score),
 * respecting breaks. Returns the new track index; excess points are lost.
 */
export function advanceTrack(trackIndex: number, points: number): number {
  let idx = trackIndex;
  let remaining = points;
  while (remaining > 0 && idx < MAX_TRACK_INDEX) {
    const gap = SCORE_TRACK[idx + 1] - SCORE_TRACK[idx];
    if (gap <= remaining) {
      idx += 1;
      remaining -= gap;
    } else {
      break; // can't clear the break; excess lost
    }
  }
  return idx;
}
