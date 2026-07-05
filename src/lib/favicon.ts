export interface ContainRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateSquareContainRect(
  sourceWidth: number,
  sourceHeight: number,
  targetSize: number
): ContainRect {
  if (
    ![sourceWidth, sourceHeight, targetSize].every((value) => Number.isFinite(value) && value > 0)
  ) {
    throw new Error('Favicon dimensions must be greater than zero.');
  }

  const scale = Math.min(targetSize / sourceWidth, targetSize / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetSize - width) / 2,
    y: (targetSize - height) / 2,
    width,
    height,
  };
}
