export function createGameState() {
  return {
    index: 0,
    pieces: [],
    strokes: [],
    labels: null,
    drag: null,
    playing: false,
    revealing: false,
    revealTimeout: null,
    paused: false,
    pausedLeft: 0,
    deadline: 0,
    secondsLeft: 0,
    viewSize: 400,
    bests: [],
    results: [],
    modalMode: "intro",
    toastTimeout: null,
  };
}
export function resetGame(state, cutter, seconds) {
  const fresh = cutter.findPieces([]);
  Object.assign(state, {
    strokes: [],
    drag: null,
    pieces: fresh.pieces,
    labels: fresh.labels,
    secondsLeft: seconds,
    paused: false,
    pausedLeft: 0,
    playing: false,
    deadline: 0,
  });
}
export function applyCut(state, cutter, points, goal) {
  if (
    !state.playing ||
    !Array.isArray(points) ||
    points.length < 2 ||
    points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return { ok: false, reason: "선을 다시 그려주세요" };
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  if (length < 0.055) return { ok: false, reason: "조금 더 길게 그려주세요" };
  const path = points.map(({ x, y }) => ({ x, y }));
  const next = cutter.findPieces([...state.strokes, path]);
  if (next.pieces.length <= state.pieces.length)
    return {
      ok: false,
      reason: "도형의 경계에서 반대쪽 경계까지 이어 그려주세요",
    };
  if (next.pieces.length > goal)
    return {
      ok: false,
      reason: `${goal}조각을 초과해요. 다른 경로로 그려보세요`,
    };
  state.strokes.push(path);
  state.labels = next.labels;
  state.pieces = next.pieces;
  return { ok: true };
}
export function undoCut(state, cutter) {
  if (!state.playing || !state.strokes.length) return false;
  state.strokes.pop();
  const prev = cutter.findPieces(state.strokes);
  state.pieces = prev.pieces;
  state.labels = prev.labels;
  state.drag = null;
  return true;
}
