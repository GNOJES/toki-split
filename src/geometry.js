// Pure raster partition: each original pixel belongs to exactly one region.
export function partitionMask(baseMask, remainingMask, RES = 560) {
  const PIXELS = RES * RES;
  let baseArea = 0;
  for (const pixel of baseMask) baseArea += pixel ? 1 : 0;
  const labels = new Int32Array(PIXELS);
  for (let i = 0; i < PIXELS; i++)
    if (baseMask[i] && remainingMask[i]) labels[i] = -1;
  const queue = new Int32Array(PIXELS);
  let count = 0;
  for (let i = 0; i < PIXELS; i++) {
    if (labels[i] !== -1) continue;
    const id = ++count;
    let head = 0,
      tail = 0;
    queue[tail++] = i;
    labels[i] = id;
    while (head < tail) {
      const index = queue[head++],
        x = index % RES;
      if (x > 0 && labels[index - 1] === -1) {
        labels[index - 1] = id;
        queue[tail++] = index - 1;
      }
      if (x < RES - 1 && labels[index + 1] === -1) {
        labels[index + 1] = id;
        queue[tail++] = index + 1;
      }
      if (index >= RES && labels[index - RES] === -1) {
        labels[index - RES] = id;
        queue[tail++] = index - RES;
      }
      if (index < PIXELS - RES && labels[index + RES] === -1) {
        labels[index + RES] = id;
        queue[tail++] = index + RES;
      }
    }
  }
  if (count === 0 && baseArea) {
    return partitionMask(baseMask, baseMask, RES);
  }
  // Rasterized diagonal borders may isolate a handful of stray edge pixels.
  // Absorb sub-pixel-scale artifacts instead of counting them as new slices.
  if (count > 1) {
    const sizes = new Int32Array(count + 1);
    for (let i = 0; i < PIXELS; i++) if (labels[i] > 0) sizes[labels[i]]++;
    const minSize = Math.max(12, Math.round(baseArea * 0.00025));
    const reindex = new Int32Array(count + 1);
    let kept = 0;
    for (let id = 1; id <= count; id++)
      if (sizes[id] >= minSize) reindex[id] = ++kept;
    if (kept) {
      for (let i = 0; i < PIXELS; i++)
        if (labels[i] > 0) labels[i] = reindex[labels[i]];
      count = kept;
    }
  }
  // Allocate the narrow cut-line pixels to the nearest region. This ensures
  // the displayed percentages cover the entire original shape (sum = 100%).
  let head = 0,
    tail = 0;
  for (let i = 0; i < PIXELS; i++) {
    if (labels[i] === 0 || !baseMask[i]) continue;
    const x = i % RES;
    if (
      (x > 0 && baseMask[i - 1] && !labels[i - 1]) ||
      (x < RES - 1 && baseMask[i + 1] && !labels[i + 1]) ||
      (i >= RES && baseMask[i - RES] && !labels[i - RES]) ||
      (i < PIXELS - RES && baseMask[i + RES] && !labels[i + RES])
    )
      queue[tail++] = i;
  }
  while (head < tail) {
    const i = queue[head++],
      id = labels[i],
      x = i % RES;
    if (x > 0 && baseMask[i - 1] && !labels[i - 1]) {
      labels[i - 1] = id;
      queue[tail++] = i - 1;
    }
    if (x < RES - 1 && baseMask[i + 1] && !labels[i + 1]) {
      labels[i + 1] = id;
      queue[tail++] = i + 1;
    }
    if (i >= RES && baseMask[i - RES] && !labels[i - RES]) {
      labels[i - RES] = id;
      queue[tail++] = i - RES;
    }
    if (i < PIXELS - RES && baseMask[i + RES] && !labels[i + RES]) {
      labels[i + RES] = id;
      queue[tail++] = i + RES;
    }
  }
  const pieces = Array.from({ length: count }, () => ({
    count: 0,
    sumX: 0,
    sumY: 0,
    x: 0.5,
    y: 0.5,
  }));
  for (let i = 0; i < PIXELS; i++) {
    const id = labels[i];
    if (id <= 0) continue;
    const p = pieces[id - 1],
      x = i % RES,
      y = Math.floor(i / RES);
    p.count++;
    p.sumX += x;
    p.sumY += y;
  }
  const bestDist = Array(count).fill(Infinity);
  for (const p of pieces) {
    p.centroidX = p.sumX / Math.max(p.count, 1);
    p.centroidY = p.sumY / Math.max(p.count, 1);
  }
  // Put labels strictly inside the corresponding connected area, even for
  // strongly concave or unusual user-drawn shapes.
  for (let i = 0; i < PIXELS; i++) {
    const id = labels[i];
    if (id <= 0) continue;
    const p = pieces[id - 1],
      x = i % RES,
      y = Math.floor(i / RES);
    const d = (x - p.centroidX) ** 2 + (y - p.centroidY) ** 2;
    if (d < bestDist[id - 1]) {
      bestDist[id - 1] = d;
      p.x = (x + 0.5) / RES;
      p.y = (y + 0.5) / RES;
    }
  }
  return { labels, pieces };
}
