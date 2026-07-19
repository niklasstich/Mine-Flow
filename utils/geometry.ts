export const snapToGrid = (val: number, gridSize: number = 20) => {
  return Math.round(val / gridSize) * gridSize;
};

// Resize a node's box from a bottom-right drag delta, clamped to a minimum
// size so the header/IO rows never get crushed to nothing.
export const clampNodeSize = (
  startW: number,
  startH: number,
  dx: number,
  dy: number,
  minW: number,
  minH: number
): { width: number; height: number } => {
  return {
    width: Math.max(minW, startW + dx),
    height: Math.max(minH, startH + dy),
  };
};

// NodeEntity's layout in pixels -- kept in sync by hand with the Tailwind
// classes in components/NodeEntity.tsx (outer 2px padding, header, p-3 body,
// the stats row, and h-6 IO rows with a gap-y-3 grid). A flat minimum height
// only fits a single-row recipe; anything with more input/output rows than
// that needs a taller floor or the extra rows visually spill out past the
// node's bottom border (overflow is deliberately visible, not clipped, so
// sockets stay attached to their row instead of being cut off).
const NODE_OUTER_PADDING = 4;
const NODE_HEADER_HEIGHT = 41;
const NODE_BODY_PADDING = 24;
const NODE_STATS_ROW_HEIGHT = 30;
const NODE_IO_ROW_HEIGHT = 24;
const NODE_IO_ROW_GAP = 12;

export const computeMinNodeHeight = (ioRowCount: number): number => {
  const rows = Math.max(1, ioRowCount);
  const ioAreaHeight = rows * NODE_IO_ROW_HEIGHT + (rows - 1) * NODE_IO_ROW_GAP;
  return NODE_OUTER_PADDING + NODE_HEADER_HEIGHT + NODE_BODY_PADDING + NODE_STATS_ROW_HEIGHT + ioAreaHeight;
};

// Calculate a smooth cubic bezier curve for connections
export const getEdgePath = (
  sx: number,
  sy: number,
  tx: number,
  ty: number
): string => {
  const deltaX = Math.abs(tx - sx);
  const controlPointOffset = Math.max(deltaX * 0.5, 50);

  const cp1x = sx + controlPointOffset;
  const cp1y = sy;
  const cp2x = tx - controlPointOffset;
  const cp2y = ty;

  return `M ${sx} ${sy} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${tx} ${ty}`;
};

export const getEdgeCenter = (
  sx: number,
  sy: number,
  tx: number,
  ty: number
): { x: number, y: number } => {
  const deltaX = Math.abs(tx - sx);
  const controlPointOffset = Math.max(deltaX * 0.5, 50);

  const cp1x = sx + controlPointOffset;
  const cp1y = sy;
  const cp2x = tx - controlPointOffset;
  const cp2y = ty;

  // Cubic Bezier at t=0.5
  // Formula: 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
  const x = 0.125 * sx + 0.375 * cp1x + 0.375 * cp2x + 0.125 * tx;
  const y = 0.125 * sy + 0.375 * cp1y + 0.375 * cp2y + 0.125 * ty;

  return { x, y };
};