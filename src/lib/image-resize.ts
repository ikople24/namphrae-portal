/** Scale (width,height) down so the longest side is at most maxDim, preserving aspect ratio.
 *  Returns integers; a no-op (rounded) when already within maxDim or maxDim<=0. */
export function fitDimensions(width: number, height: number, maxDim: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (maxDim <= 0 || longest <= maxDim) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxDim / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
