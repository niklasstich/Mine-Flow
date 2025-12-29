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
