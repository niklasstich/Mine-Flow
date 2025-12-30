export const snapToGrid = (val: number, gridSize: number = 20) => {
  return Math.round(val / gridSize) * gridSize;
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