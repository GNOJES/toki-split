import test from "node:test";
import assert from "node:assert/strict";
import { partitionMask } from "../src/geometry.js";
import { accuracyScore, starsForScore } from "../src/scoring.js";
import {
  createGameState,
  resetGame,
  applyCut,
  undoCut,
} from "../src/game-state.js";
import { loadBests, saveBests } from "../src/storage.js";

const res = 100;
function mask(cut = () => false) {
  return Uint8Array.from({ length: res * res }, (_, i) =>
    !cut(i % res, Math.floor(i / res)) ? 1 : 0,
  );
}
const base = mask();
const split = (cut) => partitionMask(base, mask(cut), res);
test("50:50, 55:45, 60:40 retain the original accuracy formula", () => {
  for (const [a, expected] of [
    [50, 100],
    [55, 90],
    [60, 80],
  ]) {
    assert.equal(
      accuracyScore([{ count: a }, { count: 100 - a }], 100),
      expected,
    );
  }
  assert.equal(accuracyScore([{ count: 100 }], 100), 0);
  assert.equal(accuracyScore([], 0), 0);
  assert.equal(
    accuracyScore(
      Array.from({ length: 6 }, () => ({ count: 10 })),
      60,
    ),
    100,
  );
});
test("square half and 60:40 raster cuts have expected accuracy", () => {
  assert.ok(
    accuracyScore(split((x) => x === 49 || x === 50).pieces, 10000) > 99,
  );
  assert.ok(
    Math.abs(
      accuracyScore(split((x) => x === 59 || x === 60).pieces, 10000) - 80,
    ) < 1,
  );
});
test("incomplete cuts stay connected; curved and zigzag cuts separate", () => {
  assert.equal(split((x, y) => x === 50 && y > 20 && y < 80).pieces.length, 1);
  for (const f of [
    (y) => 50 + 10 * Math.sin(y / 15),
    (y) => 50 + Math.abs((y % 20) - 10),
  ]) {
    const next = split((x, y) => Math.abs(x - f(y)) < 2);
    assert.equal(next.pieces.length, 2);
    assert.equal(
      next.pieces.reduce((n, p) => n + p.count, 0),
      10000,
    );
    assert.ok([...next.labels].every((id) => id > 0 && id <= 2));
  }
});
test("narrow pieces and intersections conserve original area with exclusive labels", () => {
  for (const cut of [
    (x) => x < 3,
    (x) => x === 4,
    (x, y) => Math.abs(x - 50) < 2 || Math.abs(y - 50) < 2,
  ]) {
    const result = split(cut);
    assert.equal(
      result.pieces.reduce((n, p) => n + p.count, 0),
      10000,
    );
    const counts = new Map();
    for (const id of result.labels) counts.set(id, (counts.get(id) || 0) + 1);
    result.pieces.forEach((p, i) => assert.equal(p.count, counts.get(i + 1)));
    result.pieces.forEach((p, i) =>
      assert.equal(
        result.labels[Math.floor(p.y * res) * res + Math.floor(p.x * res)],
        i + 1,
      ),
    );
  }
});
test("all-erased mask retains one piece; tiny raster islands are absorbed", () => {
  assert.equal(
    split(() => true).pieces.reduce((n, p) => n + p.count, 0),
    10000,
  );
  const result = split((x, y) => x === 2 || y === 2);
  assert.equal(
    result.pieces.reduce((n, p) => n + p.count, 0),
    10000,
  );
});
function fixture(goal = 4) {
  const cutter = {
    findPieces(strokes) {
      return split((x, y) =>
        strokes.some((points) =>
          points[0].x === 0.5 ? Math.abs(x - 50) < 2 : Math.abs(y - 50) < 2,
        ),
      );
    },
  };
  const state = createGameState();
  resetGame(state, cutter, 20);
  state.playing = true;
  return { state, cutter, goal };
}
const v = [
    { x: 0.5, y: 0 },
    { x: 0.5, y: 1 },
  ],
  h = [
    { x: 0, y: 0.5 },
    { x: 1, y: 0.5 },
  ];
test("cut, undo, retry restore geometry and invalid/over-goal cuts are atomic", () => {
  const { state, cutter } = fixture();
  assert.equal(applyCut(state, cutter, v, 3).ok, true);
  const labels = state.labels;
  assert.equal(applyCut(state, cutter, h, 3).ok, false);
  assert.equal(state.labels, labels);
  assert.equal(state.strokes.length, 1);
  assert.equal(undoCut(state, cutter), true);
  assert.equal(state.pieces.length, 1);
  assert.equal(applyCut(state, cutter, v, 4).ok, true);
  assert.equal(applyCut(state, cutter, h, 4).ok, true);
  assert.equal(state.pieces.length, 4);
  resetGame(state, cutter, 20);
  assert.equal(state.pieces.length, 1);
  assert.equal(state.strokes.length, 0);
  assert.equal(state.playing, false);
  assert.equal(state.secondsLeft, 20);
  assert.equal(state.drag, null);
});
test("invalid points and non-playing state cannot commit cuts", () => {
  const { state, cutter } = fixture();
  for (const path of [
    [],
    [
      { x: NaN, y: 0 },
      { x: 1, y: 1 },
    ],
    null,
  ])
    assert.equal(applyCut(state, cutter, path, 4).ok, false);
  state.playing = false;
  assert.equal(applyCut(state, cutter, v, 4).ok, false);
});
test("best records validate untrusted localStorage and tolerate unavailable storage", () => {
  assert.deepEqual(loadBests({ getItem: () => '[99,null,"oops",-1,101,85]' }), [
    99,
    null,
    null,
    null,
    null,
    85,
  ]);
  assert.deepEqual(loadBests({ getItem: () => "{oops" }), []);
  assert.deepEqual(
    loadBests({
      getItem() {
        throw Error("blocked");
      },
    }),
    [],
  );
  assert.doesNotThrow(() =>
    saveBests(
      {
        setItem() {
          throw Error("quota");
        },
      },
      [90],
    ),
  );
});

test("record loading follows configured stage count when more stages are added", () => {
  const storage = { getItem: () => JSON.stringify(Array(12).fill(90)) };
  assert.equal(loadBests(storage, 12).length, 12);
  assert.equal(loadBests(storage, 3).length, 3);
});

test("star thresholds include boundaries and zero stars means failure", () => {
  for (const [score, stars] of [
    [0, 0],
    [74.999, 0],
    [75, 1],
    [89.999, 1],
    [90, 2],
    [97.999, 2],
    [98, 3],
    [100, 3],
  ]) {
    assert.equal(starsForScore(score), stars);
  }
  for (const score of [null, undefined, NaN])
    assert.equal(starsForScore(score), 0);
});
