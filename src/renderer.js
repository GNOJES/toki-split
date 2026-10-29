import { shapePath, strokePath } from "./paths.js";
import { RES } from "./cutter.js";
export function createRenderer({ canvas, state, stages, palette, cutter }) {
  const $ = (id) => document.getElementById(id),
    PI = Math.PI,
    ctx = canvas.getContext("2d"),
    PIXELS = RES * RES;
  const regionCanvas = document.createElement("canvas");
  regionCanvas.width = RES;
  regionCanvas.height = RES;
  const regionCtx = regionCanvas.getContext("2d");
  const rgb = palette.map((h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]);
  function updateRegionBitmap() {
    const img = regionCtx.createImageData(RES, RES),
      out = img.data,
      labels = state.labels;
    if (!labels) return;
    for (let i = 0; i < PIXELS; i++) {
      const id = labels[i];
      if (!id) continue;
      const c = rgb[(id - 1) % rgb.length],
        j = i * 4;
      const y = Math.floor(i / RES),
        light = 0.1 * (1 - y / RES);
      out[j] = Math.round(c[0] + (255 - c[0]) * light);
      out[j + 1] = Math.round(c[1] + (255 - c[1]) * light);
      out[j + 2] = Math.round(c[2] + (255 - c[2]) * light);
      out[j + 3] = 247;
    }
    regionCtx.putImageData(img, 0, 0);
  }
  function resize() {
    const box = $("boardBox").getBoundingClientRect(),
      size = Math.max(1, Math.floor(Math.min(box.width, box.height)));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    state.viewSize = size;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  function pathPoly(poly) {
    shapePath(ctx, poly, state.viewSize);
  }
  function drawStroke(points, w) {
    strokePath(ctx, points, w);
    ctx.stroke();
  }
  function draw() {
    const w = state.viewSize;
    if (!w) return;
    ctx.clearRect(0, 0, w, w);
    ctx.save();
    const poly = stages[state.index].poly;
    pathPoly(poly);
    ctx.shadowColor = "#08182085";
    ctx.shadowBlur = 13;
    ctx.shadowOffsetY = 7;
    ctx.fillStyle = "#91eec0";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(regionCanvas, 0, 0, w, w);
    ctx.save();
    pathPoly(poly);
    ctx.clip();
    const grad = ctx.createLinearGradient(
      w * 0.18,
      w * 0.12,
      w * 0.8,
      w * 0.86,
    );
    grad.addColorStop(0, "#ffffff2c");
    grad.addColorStop(1, "#103b5214");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, w);
    if (state.strokes.length) {
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const points of state.strokes) {
        ctx.strokeStyle = "#143747";
        ctx.lineWidth = Math.max(3, w * 0.009);
        drawStroke(points, w);
        ctx.strokeStyle = "#edfffaac";
        ctx.lineWidth = Math.max(0.8, w * 0.0025);
        drawStroke(points, w);
      }
    }
    ctx.restore();
    pathPoly(poly);
    ctx.lineWidth = Math.max(2, w * 0.007);
    ctx.strokeStyle = "#173c48";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = "#ffffff65";
    ctx.stroke();
    if (state.drag && state.drag.points.length > 1) {
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = "#e8fffd88";
      ctx.shadowBlur = 9;
      ctx.lineWidth = Math.max(2.5, w * 0.008);
      ctx.strokeStyle = "#ffffffed";
      drawStroke(state.drag.points, w);
      ctx.shadowBlur = 0;
      const last = state.drag.points[state.drag.points.length - 1];
      ctx.beginPath();
      ctx.arc(last.x * w, last.y * w, Math.max(3, w * 0.009), 0, PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    if (state.revealing) {
      const target = 100 / stages[state.index].n;
      state.pieces.forEach((p, i) => {
        const pct = (100 * p.count) / cutter.baseArea;
        const fs = Math.max(11, Math.min(17, w * 0.044));
        const label = pct.toFixed(1) + "%";
        ctx.font = `900 ${fs}px system-ui,-apple-system,sans-serif`;
        const width = ctx.measureText(label).width + 16;
        const px = p.x * w,
          py = p.y * w;
        ctx.fillStyle = "#102e3fe8";
        ctx.strokeStyle =
          pct >= target - 0.5 && pct <= target + 0.5 ? "#c6ffda" : "#ffffffa0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(px - width / 2, py - fs * 0.85, width, fs * 1.7, 9);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f6fff9";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, px, py + 0.5);
      });
    }
    ctx.restore();
  }
  return { resize, draw, updateRegionBitmap };
}
