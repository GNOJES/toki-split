// Preserve the prototype’s normalized absolute area error formula.
export function accuracyScore(pieces, original) {
  const n = pieces.length;
  if (n < 2 || original <= 0) return 0;
  const average = original / n;
  const absoluteError = pieces.reduce(
    (sum, p) => sum + Math.abs(p.count - average),
    0,
  );
  return Math.max(
    0,
    Math.min(100, 100 * (1 - absoluteError / (2 * original * (1 - 1 / n)))),
  );
}

// Shared by result, stage rail and run summary; use the unrounded accuracy.
export const STAR_THRESHOLDS = Object.freeze([75, 90, 98]);
export function starsForScore(score) {
  return Number.isFinite(score)
    ? STAR_THRESHOLDS.filter((threshold) => score >= threshold).length
    : 0;
}
