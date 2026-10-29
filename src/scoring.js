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

// Grade the same one-decimal accuracy shown in results and best records.
export const STAR_THRESHOLDS = Object.freeze([75, 90, 98]);
export function starsForScore(score) {
  if (!Number.isFinite(score)) return 0;
  const displayedAccuracy = Number(score.toFixed(1));
  return STAR_THRESHOLDS.filter((threshold) => displayedAccuracy >= threshold)
    .length;
}
