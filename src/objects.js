// Connected, hole-free silhouettes. Curves are sampled into the same normalized
// polygon format as the original stages, so rendering and cutting share one outline.
function outline(commands) {
  let current = commands[0];
  const points = [{ x: current[0] / 100, y: current[1] / 100 }];
  for (const c of commands.slice(1)) {
    const end = c.slice(-2),
      start = current;
    if (c.length === 2) points.push({ x: end[0] / 100, y: end[1] / 100 });
    else
      for (let i = 1; i <= 16; i++) {
        const t = i / 16,
          u = 1 - t;
        const at = (axis) =>
          c.length === 4
            ? u * u * start[axis] + 2 * u * t * c[axis] + t * t * end[axis]
            : u * u * u * start[axis] +
              3 * u * u * t * c[axis] +
              3 * u * t * t * c[axis + 2] +
              t * t * t * end[axis];
        points.push({ x: at(0) / 100, y: at(1) / 100 });
      }
    current = end;
  }
  const first = points[0],
    last = points.at(-1);
  if (first.x === last.x && first.y === last.y) points.pop();
  return points;
}
const star = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5,
    r = i % 2 ? 19 : 40;
  return {
    x: 0.5 + (r * Math.cos(a)) / 100,
    y: 0.51 + (r * Math.sin(a)) / 100,
  };
});
export const objectShapes = {
  umbrella: {
    name: "우산",
    poly: outline([
      [13, 47],
      [16, 22, 31, 12, 50, 12],
      [70, 12, 84, 27, 87, 47],
      [78, 35, 69, 47],
      [60, 35, 53, 47],
      [53, 75],
      [53, 87, 35, 89, 32, 78],
      [38, 76],
      [40, 82, 47, 81, 47, 75],
      [47, 47],
      [37, 35, 31, 47],
      [22, 35, 13, 47],
    ]),
  },
  apple: {
    name: "사과",
    poly: outline([
      [50, 25],
      [43, 13],
      [50, 12],
      [56, 24],
      [70, 14, 86, 26, 87, 47],
      [90, 68, 70, 88, 59, 87],
      [53, 86, 50, 83, 46, 86],
      [29, 93, 12, 68, 13, 46],
      [13, 25, 31, 16, 44, 25],
      [47, 27, 50, 25],
    ]),
  },
  rabbit: {
    name: "토끼",
    poly: outline([
      [23, 57],
      [13, 38, 23, 17, 31, 13],
      [40, 9, 40, 29, 42, 44],
      [50, 40, 56, 44],
      [60, 27, 65, 10, 74, 13],
      [85, 17, 80, 43, 76, 54],
      [92, 63, 85, 88, 68, 91],
      [51, 96, 28, 91, 22, 79],
      [16, 72, 17, 62, 23, 57],
    ]),
  },
  heart: {
    name: "하트",
    poly: outline([
      [50, 31],
      [30, 5, 8, 22, 13, 44],
      [17, 62, 36, 78, 50, 90],
      [64, 78, 83, 62, 87, 44],
      [92, 22, 70, 5, 50, 31],
    ]),
  },
  mushroom: {
    name: "버섯",
    poly: outline([
      [12, 53],
      [13, 30, 29, 13, 50, 13],
      [72, 13, 87, 30, 88, 53],
      [86, 59, 66, 60, 59, 59],
      [60, 72, 65, 83, 65, 86],
      [58, 91, 42, 91, 35, 86],
      [35, 83, 40, 72, 41, 59],
      [28, 61, 14, 59, 12, 53],
    ]),
  },
  fish: {
    name: "물고기",
    poly: outline([
      [17, 43],
      [30, 24, 50, 22, 65, 37],
      [86, 23],
      [82, 49],
      [87, 75],
      [65, 62],
      [48, 79, 27, 70, 17, 56],
      [11, 58, 10, 52, 15, 49],
      [10, 46, 11, 41, 17, 43],
    ]),
  },
  star: { name: "별", poly: star },
  lightning: {
    name: "번개",
    poly: outline([
      [52, 10],
      [80, 10],
      [61, 40],
      [82, 40],
      [30, 91],
      [42, 58],
      [19, 58],
    ]),
  },
  tulip: {
    name: "튤립",
    poly: outline([
      [22, 18],
      [40, 29],
      [50, 12],
      [60, 29],
      [78, 18],
      [80, 48, 67, 57, 54, 60],
      [54, 68],
      [69, 55, 83, 59, 84, 63],
      [79, 78, 64, 80, 54, 81],
      [54, 90],
      [46, 90],
      [46, 79],
      [29, 82, 15, 70, 16, 57],
      [30, 55, 40, 63, 46, 69],
      [46, 60],
      [32, 57, 20, 47, 22, 18],
    ]),
  },
};
