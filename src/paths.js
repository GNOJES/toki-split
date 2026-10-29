export function shapePath(context, points, scale) {
  context.beginPath();
  points.forEach((p, i) => {
    if (i) context.lineTo(p.x * scale, p.y * scale);
    else context.moveTo(p.x * scale, p.y * scale);
  });
  context.closePath();
}
export function strokePath(context, points, scale) {
  context.beginPath();
  points.forEach((p, i) => {
    if (i) context.lineTo(p.x * scale, p.y * scale);
    else context.moveTo(p.x * scale, p.y * scale);
  });
}
