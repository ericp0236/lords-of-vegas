/**
 * Board lot data — source of truth: lords-of-vegas-updated-data/board-lots.json
 * (confirmed prices and printed die values; do not substitute placeholder values).
 *
 * Geometry: 6 blocks in a 2-column grid separated by Las Vegas Blvd ("The Strip").
 * Left column (A, C, E) touches the Strip on its RIGHT edge;
 * right column (B, D, F) touches the Strip on its LEFT edge.
 * Lots are numbered row-major within each block (e.g. A1 A2 A3 / A4 A5 A6).
 * Casinos never span blocks: adjacency exists only within a block.
 */

export type BlockId = "A" | "B" | "C" | "D" | "E" | "F";
export type LotId = string;

export interface BoardLot {
  id: LotId;
  block: BlockId;
  street: string;
  /** Purchase price in $ millions */
  price: number;
  /** Printed die value (starting pip value for a die placed here) */
  printedDie: number;
  row: number;
  col: number;
  stripAdjacent: boolean;
  /** Orthogonal neighbors within the same block */
  neighbors: LotId[];
}

export interface BlockGeometry {
  rows: number;
  cols: number;
  stripSide: "left" | "right";
}

export const BLOCKS: Record<BlockId, BlockGeometry> = {
  A: { rows: 2, cols: 3, stripSide: "right" },
  B: { rows: 2, cols: 3, stripSide: "left" },
  C: { rows: 4, cols: 3, stripSide: "right" },
  D: { rows: 3, cols: 3, stripSide: "left" },
  E: { rows: 2, cols: 3, stripSide: "right" },
  F: { rows: 3, cols: 3, stripSide: "left" },
};

/** Confirmed lot data: [id, street, price, printedDie] */
const RAW: [LotId, string, number, number][] = [
  ["A1", "Sahara Ave", 9, 3],
  ["A2", "Sahara Ave", 6, 2],
  ["A3", "Sahara Ave", 15, 5],
  ["A4", "Sahara Ave", 12, 4],
  ["A5", "Sahara Ave", 9, 3],
  ["A6", "Sahara Ave", 20, 6],
  ["B1", "Sahara Ave", 15, 5],
  ["B2", "Sahara Ave", 6, 2],
  ["B3", "Sahara Ave", 9, 3],
  ["B4", "Sahara Ave", 20, 6],
  ["B5", "Sahara Ave", 9, 3],
  ["B6", "Sahara Ave", 12, 4],
  ["C1", "Flamingo Rd", 12, 4],
  ["C2", "Flamingo Rd", 9, 3],
  ["C3", "Flamingo Rd", 20, 6],
  ["C4", "Flamingo Rd", 6, 2],
  ["C5", "Flamingo Rd", 8, 1],
  ["C6", "Flamingo Rd", 12, 4],
  ["C7", "Flamingo Rd", 6, 2],
  ["C8", "Flamingo Rd", 8, 1],
  ["C9", "Flamingo Rd", 12, 4],
  ["C10", "Flamingo Rd", 9, 3],
  ["C11", "Flamingo Rd", 6, 2],
  ["C12", "Flamingo Rd", 15, 5],
  ["D1", "Flamingo Rd", 20, 6],
  ["D2", "Flamingo Rd", 9, 3],
  ["D3", "Flamingo Rd", 12, 4],
  ["D4", "Flamingo Rd", 12, 4],
  ["D5", "Flamingo Rd", 8, 1],
  ["D6", "Flamingo Rd", 6, 2],
  ["D7", "Flamingo Rd", 15, 5],
  ["D8", "Flamingo Rd", 6, 2],
  ["D9", "Flamingo Rd", 9, 3],
  ["E1", "Tropicana Ave", 9, 3],
  ["E2", "Tropicana Ave", 6, 2],
  ["E3", "Tropicana Ave", 15, 5],
  ["E4", "Tropicana Ave", 12, 4],
  ["E5", "Tropicana Ave", 9, 3],
  ["E6", "Tropicana Ave", 20, 6],
  ["F1", "Harmon Ave", 20, 6],
  ["F2", "Harmon Ave", 9, 3],
  ["F3", "Harmon Ave", 12, 4],
  ["F4", "Harmon Ave", 12, 4],
  ["F5", "Harmon Ave", 8, 1],
  ["F6", "Harmon Ave", 6, 2],
  ["F7", "Harmon Ave", 15, 5],
  ["F8", "Harmon Ave", 6, 2],
  ["F9", "Harmon Ave", 9, 3],
];

function buildLots(): Record<LotId, BoardLot> {
  const lots: Record<LotId, BoardLot> = {};
  for (const [id, street, price, printedDie] of RAW) {
    const block = id[0] as BlockId;
    const num = parseInt(id.slice(1), 10);
    const geo = BLOCKS[block];
    const idx = num - 1;
    const row = Math.floor(idx / geo.cols);
    const col = idx % geo.cols;
    const stripAdjacent =
      geo.stripSide === "right" ? col === geo.cols - 1 : col === 0;
    lots[id] = { id, block, street, price, printedDie, row, col, stripAdjacent, neighbors: [] };
  }
  // adjacency within block only (streets and the Strip separate blocks)
  for (const lot of Object.values(lots)) {
    const geo = BLOCKS[lot.block];
    const deltas = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of deltas) {
      const r = lot.row + dr;
      const c = lot.col + dc;
      if (r < 0 || c < 0 || r >= geo.rows || c >= geo.cols) continue;
      lot.neighbors.push(`${lot.block}${r * geo.cols + c + 1}`);
    }
  }
  return lots;
}

export const BOARD_LOTS: Record<LotId, BoardLot> = buildLots();
export const ALL_LOT_IDS: LotId[] = RAW.map(([id]) => id);
export const STRIP_ADJACENT_LOTS: LotId[] = ALL_LOT_IDS.filter(
  (id) => BOARD_LOTS[id].stripAdjacent,
);

export function lotsInBlock(block: BlockId): LotId[] {
  return ALL_LOT_IDS.filter((id) => BOARD_LOTS[id].block === block);
}
