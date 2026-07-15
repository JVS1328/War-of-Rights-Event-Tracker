// Binary-search the frameTimes array for the index at-or-before targetSec.
// Shared by the heatmap (kill→frame lookup) and any time-scrubbing analytics.
export function frameIndexForTime(frameTimes, targetSec) {
  if (frameTimes.length === 0) return 0;
  let lo = 0;
  let hi = frameTimes.length - 1;
  if (targetSec <= frameTimes[0]) return 0;
  if (targetSec >= frameTimes[hi]) return hi;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (frameTimes[mid] <= targetSec) lo = mid;
    else hi = mid;
  }
  return lo;
}
