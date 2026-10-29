// Browser-side verification only: find ordinary straight cuts for concave silhouettes.
export function planCuts(cutter, stage, project = (points) => points) {
  cutter.prepare(stage.poly);
  const path = (axis, t) =>
    axis === "x"
      ? [
          { x: t, y: 0.01 },
          { x: t, y: 0.99 },
        ]
      : [
          { x: 0.01, y: t },
          { x: 0.99, y: t },
        ];
  const min = Math.min(...stage.poly.map((p) => p.x)),
    max = Math.max(...stage.poly.map((p) => p.x));
  const uniform = Array.from({ length: stage.n - 1 }, (_, i) =>
    path("x", min + ((max - min) * (i + 1)) / stage.n),
  );
  if (cutter.findPieces(uniform.map(project)).pieces.length === stage.n) {
    return uniform.map((points, i) => ({
      points,
      count: cutter.findPieces(uniform.slice(0, i + 1).map(project)).pieces
        .length,
    }));
  }
  const cuts = [];
  let count = 1;
  while (count < stage.n) {
    let chosen;
    for (const axis of ["x", "y"]) {
      for (const t of [
        0.5, 0.35, 0.65, 0.25, 0.75, 0.4, 0.6, 0.2, 0.8, 0.3, 0.7, 0.45, 0.55,
        0.15, 0.85,
      ]) {
        const points = path(axis, t),
          result = cutter.findPieces(
            [...cuts.map((c) => c.points), points].map(project),
          );
        if (result.pieces.length === count + 1) {
          chosen = { points, count: result.pieces.length };
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen)
      throw Error(`No valid cut plan for ${stage.name} / ${stage.n}`);
    cuts.push(chosen);
    count = chosen.count;
  }
  return cuts;
}
