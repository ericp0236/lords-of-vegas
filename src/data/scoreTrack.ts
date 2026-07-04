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
