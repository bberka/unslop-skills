// One assertion per line is a judgment call; eight in one file is spam.
export function corners(points: { x?: number; y?: number }[]) {
  const left = points[0]!.x;
  const top = points[0]!.y;
  const right = points[1]!.x;
  const bottom = points[1]!.y;
  const midX = points[2]!.x;
  const midY = points[2]!.y;
  const endX = points[3]!.x;
  const endY = points[3]!.y;
  return { left, top, right, bottom, midX, midY, endX, endY };
}
