const KEY = "toki-split-best-v1";
export function loadBests(storage, stageCount = 10) {
  try {
    const data = JSON.parse(
      (storage ?? window.localStorage).getItem(KEY) || "[]",
    );
    return Array.isArray(data)
      ? data
          .slice(0, stageCount)
          .map((v) =>
            typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100
              ? v
              : null,
          )
      : [];
  } catch {
    return [];
  }
}
export function saveBests(storage, bests) {
  try {
    (storage ?? window.localStorage).setItem(KEY, JSON.stringify(bests));
  } catch {
    /* Private mode/quota must not interrupt play. */
  }
}
