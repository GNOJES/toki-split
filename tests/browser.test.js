import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createStaticServer } from "../scripts/serve.js";
import { chromium, webkit } from "playwright";
const browserName = process.env.TEST_BROWSER || "chromium";
let browser, server, baseURL;
before(async () => {
  server = createStaticServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
  browser = await { chromium, webkit }[browserName].launch(
    browserName === "chromium" && process.env.PLAYWRIGHT_CHROME
      ? { channel: "chrome" }
      : {},
  );
  await mkdir("test-results", { recursive: true });
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});
async function open(options = {}) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    ...options,
  });
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto(baseURL);
  await page.locator('[data-action="start"]').click();
  page.on("close", () => assert.deepEqual(errors, []));
  return page;
}
async function drag(page, points, steps = 1) {
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const b = await page.locator("canvas").boundingBox();
  await page.mouse.move(
    b.x + points[0][0] * b.width,
    b.y + points[0][1] * b.height,
  );
  await page.mouse.down();
  for (const [x, y] of points.slice(1))
    await page.mouse.move(b.x + x * b.width, b.y + y * b.height, { steps });
  await page.mouse.up();
}
async function pieces(page, n) {
  await page.waitForFunction(
    (n) => document.getElementById("pieceCount").textContent === String(n),
    n,
  );
}
async function select(page, i) {
  await page.locator(`[data-stage="${i}"]`).click();
  await page.locator('[data-action="start"]').click();
}

test("desktop and mobile drag → 2.6 second reveal → full result → next stage", async () => {
  for (const viewport of [
    { width: 1280, height: 1000 },
    { width: 390, height: 844 },
    { width: 320, height: 640 },
  ]) {
    const page = await open({
      viewport,
      deviceScaleFactor: 2,
      hasTouch: viewport.width < 500,
    });
    await page.clock.fastForward(1200);
    await drag(
      page,
      [
        [0.1, 0.5],
        [0.9, 0.5],
      ],
      20,
    );
    await pieces(page, 2);
    assert.equal(
      await page
        .locator("#modal")
        .evaluate((el) => el.classList.contains("hidden")),
      true,
    );
    assert.equal(await page.locator("#revealPcts span").count(), 2);
    const frozen = await page.locator("#timer").innerText();
    assert.ok(
      parseFloat(frozen) < 20,
      "reveal must retain actual remaining time",
    );
    await page.clock.fastForward(2500);
    assert.equal(
      await page
        .locator("#modal")
        .evaluate((el) => el.classList.contains("hidden")),
      true,
    );
    await page.clock.fastForward(150);
    assert.ok(
      parseFloat(await page.locator(".score-number").innerText()) >= 99,
      `center cut on ${browserName} / ${viewport.width} should be approximately 100%`,
    );
    assert.match(await page.locator("#modalContent").innerText(), /최고 기록/);
    assert.equal(await page.locator("#timer").innerText(), frozen);
    await page.screenshot({
      path: `test-results/result-${viewport.width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.locator('[data-action="next"]').click();
    assert.match(await page.locator("#modalContent h2").innerText(), /삼각형/);
    await page.locator('[data-action="start"]').click();
    await pieces(page, 1);
    await page.close();
  }
});

test("60:40 score, best storage and retry", async () => {
  const page = await open();
  await drag(page, [
    [0.1, 0.56],
    [0.9, 0.56],
  ]);
  await pieces(page, 2);
  await page.clock.fastForward(2700);
  const score = parseFloat(await page.locator(".score-number").innerText());
  assert.ok(Math.abs(score - 80) < 1);
  await page.locator('[data-action="retry"]').click();
  await pieces(page, 1);
  await drag(page, [
    [0.1, 0.5],
    [0.9, 0.5],
  ]);
  await page.clock.fastForward(2700);
  const best = await page.evaluate(
    () => JSON.parse(localStorage.getItem("toki-split-best-v1"))[0],
  );
  assert.equal(best, 100);
  await page.reload();
  assert.match(await page.locator('[data-stage="0"]').innerText(), /100.0%/);
  await page.close();
});

test("curve, zigzag, incomplete, boundary, intersection, over-goal, undo and restart", async () => {
  const page = await open();
  await select(page, 4);
  await drag(
    page,
    [
      [0.4, 0.4],
      [0.6, 0.6],
    ],
    12,
  );
  await pieces(page, 1);
  assert.match(await page.locator("#statusText").innerText(), /경계/);
  await drag(page, [
    [0.01, 0.01],
    [0.99, 0.01],
  ]);
  await pieces(page, 1);
  await drag(
    page,
    [
      [0.1, 0.45],
      [0.3, 0.55],
      [0.5, 0.45],
      [0.7, 0.55],
      [0.9, 0.45],
    ],
    8,
  );
  await pieces(page, 2);
  await page.locator("#undoButton").click();
  await pieces(page, 1);
  await drag(
    page,
    [
      [0.1, 0.5],
      [0.9, 0.5],
    ],
    1,
  );
  await pieces(page, 2);
  await drag(
    page,
    [
      [0.5, 0.05],
      [0.5, 0.95],
    ],
    50,
  );
  await pieces(page, 4);
  await page.locator("#retryButton").click();
  await page.locator('[data-action="start"]').click();
  await pieces(page, 1);
  await select(page, 2);
  await drag(page, [
    [0.1, 0.5],
    [0.9, 0.5],
  ]);
  await pieces(page, 2);
  await drag(page, [
    [0.5, 0.05],
    [0.5, 0.95],
  ]);
  await pieces(page, 2);
  assert.match(await page.locator("#statusText").innerText(), /초과/);
  await page.locator("#undoButton").click();
  await pieces(page, 1);
  await page.close();
});

test("deadline, help pause, lost capture, unrelated cancellation and restart during reveal", async () => {
  const page = await open();
  await page.clock.fastForward(500);
  await page.locator("#helpButton").click();
  const paused = await page.locator("#timer").innerText();
  await page.clock.fastForward(30000);
  assert.equal(await page.locator("#timer").innerText(), paused);
  await page.locator('[data-action="closehelp"]').click();
  await page.clock.fastForward(20000);
  assert.match(
    await page.locator("#modalContent").innerText(),
    /시간이 끝났어요/,
  );
  assert.equal(parseFloat(await page.locator("#timer").innerText()), 0);
  await page.locator('[data-action="retry"]').click();
  const b = await page.locator("canvas").boundingBox();
  await page.mouse.move(b.x + 0.1 * b.width, b.y + 0.5 * b.height);
  await page.mouse.down();
  await page.mouse.move(b.x + 0.5 * b.width, b.y + 0.5 * b.height);
  await page
    .locator("canvas")
    .dispatchEvent("pointercancel", { pointerId: 999, isPrimary: false });
  await page.mouse.move(b.x + 0.9 * b.width, b.y + 0.5 * b.height);
  await page.mouse.up();
  await pieces(page, 2);
  await page.locator("#retryButton").click();
  await page.clock.fastForward(3000);
  assert.match(await page.locator("#modalContent h2").innerText(), /챌린지/);
  await pieces(page, 1);
  await page.locator('[data-action="start"]').click();
  await page.mouse.move(b.x + 0.1 * b.width, b.y + 0.5 * b.height);
  await page.mouse.down();
  await page.mouse.move(b.x + 0.3 * b.width, b.y + 0.5 * b.height);
  await page.locator("canvas").evaluate((el) => el.releasePointerCapture(1));
  await page.mouse.move(b.x + 0.9 * b.width, b.y + 0.5 * b.height);
  await page.mouse.up();
  await pieces(page, 1);
  await page.close();
});

test("real Canvas partition for all shapes, curves, self crossings and tiny pieces", async () => {
  const page = await open();
  const report = await page.evaluate(async () => {
    const { createCutter } = await import("/src/cutter.js");
    const { stages } = await import("/src/stages.js");
    const cutter = createCutter();
    const path = (a) => a.map(([x, y]) => ({ x, y }));
    const check = (result) => {
      const area = result.pieces.reduce((n, p) => n + p.count, 0);
      if (area !== cutter.baseArea)
        throw Error(`area mismatch ${area} / ${cutter.baseArea}`);
      const counts = new Map();
      for (const id of result.labels)
        if (id) counts.set(id, (counts.get(id) || 0) + 1);
      result.pieces.forEach((p, i) => {
        if (p.count !== counts.get(i + 1))
          throw Error("overlap or missing labels");
      });
      return result.pieces.length;
    };
    const rows = [];
    for (const stage of stages) {
      cutter.prepare(stage.poly);
      if (check(cutter.findPieces([])) !== 1)
        throw Error("initial shape fragmented");
      // Convex stage polygons: parallel lines give exactly N pieces.
      const min = Math.min(...stage.poly.map((p) => p.x)),
        max = Math.max(...stage.poly.map((p) => p.x));
      const strokes = Array.from({ length: stage.n - 1 }, (_, i) =>
        path([
          [min + ((max - min) * (i + 1)) / stage.n, 0],
          [min + ((max - min) * (i + 1)) / stage.n, 1],
        ]),
      );
      const count = check(cutter.findPieces(strokes));
      if (count !== stage.n) throw Error(stage.name + " stage failed");
      rows.push({ name: stage.name, pieces: count, area: cutter.baseArea });
    }
    cutter.prepare(stages[0].poly);
    const curves = [
      path([
        [0.1, 0.5],
        [0.3, 0.4],
        [0.5, 0.55],
        [0.7, 0.4],
        [0.9, 0.5],
      ]),
      path([
        [0.1, 0.5],
        [0.3, 0.7],
        [0.7, 0.3],
        [0.3, 0.3],
        [0.7, 0.7],
        [0.9, 0.5],
      ]),
    ];
    for (const stroke of curves)
      if (check(cutter.findPieces([stroke])) < 2)
        throw Error("curve did not split");
    for (const x of [0.201, 0.205, 0.21, 0.25, 0.5])
      check(
        cutter.findPieces([
          path([
            [x, 0.1],
            [x, 0.9],
          ]),
        ]),
      );
    return rows;
  });
  assert.equal(report.length, 10);
  console.log(report);
  await page.close();
});

test(
  "mobile touch gestures stay on canvas and commit actual freehand path",
  { skip: browserName !== "chromium" },
  async () => {
    const page = await open({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const session = await page.context().newCDPSession(page);
    await page.locator("canvas").scrollIntoViewIfNeeded();
    const b = await page.locator("canvas").boundingBox();
    const before = await page.evaluate(() => scrollY);
    const point = (x, y) => ({
      x: b.x + x * b.width,
      y: b.y + y * b.height,
      id: 1,
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(0.1, 0.5)],
    });
    for (const [x, y] of [
      [0.3, 0.4],
      [0.5, 0.6],
      [0.7, 0.4],
      [0.9, 0.5],
    ])
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [point(x, y)],
      });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await pieces(page, 2);
    assert.equal(await page.evaluate(() => scrollY), before);
    await page.screenshot({
      path: "test-results/mobile-reveal.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.close();
  },
);

test("all ten stages play through UI and the final summary on a narrow phone", async () => {
  const page = await open({
    viewport: { width: 320, height: 640 },
    hasTouch: true,
  });
  const stages = await page.evaluate(async () => {
    const { stages } = await import("/src/stages.js");
    return stages;
  });
  for (const [i, stage] of stages.entries()) {
    assert.match(
      await page.locator("#shapeName").innerText(),
      new RegExp(stage.name),
    );
    const min = Math.min(...stage.poly.map((p) => p.x)),
      max = Math.max(...stage.poly.map((p) => p.x));
    for (let j = 1; j < stage.n; j++) {
      const x = min + ((max - min) * j) / stage.n;
      await drag(
        page,
        [
          [x, 0.02],
          [x, 0.98],
        ],
        3,
      );
      await pieces(page, j + 1);
    }
    assert.equal(await page.locator("#revealPcts span").count(), stage.n);
    await page.clock.fastForward(2700);
    assert.equal(await page.locator(".segment").count(), stage.n);
    if (i === 9) {
      await page.screenshot({
        path: "test-results/six-pieces-320.png",
        fullPage: true,
        animations: "disabled",
      });
      await page.locator('[data-action="summary"]').click();
      assert.match(
        await page.locator("#modalContent").innerText(),
        /완료한 스테이지 10 \/ 10/,
      );
    } else {
      await page.locator('[data-action="next"]').click();
      await page.locator('[data-action="start"]').click();
    }
  }
  await page.close();
});

test("active cancellation and background pause discard partial paths; help preserves result", async () => {
  const page = await open();
  const b = await page.locator("canvas").boundingBox();
  async function begin() {
    await page.mouse.move(b.x + 0.1 * b.width, b.y + 0.5 * b.height);
    await page.mouse.down();
    await page.mouse.move(b.x + 0.4 * b.width, b.y + 0.5 * b.height);
  }
  async function end() {
    await page.mouse.move(b.x + 0.9 * b.width, b.y + 0.5 * b.height);
    await page.mouse.up();
    await pieces(page, 1);
  }
  await begin();
  await page
    .locator("canvas")
    .dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await end();
  await begin();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const paused = await page.locator("#timer").innerText();
  await page.clock.fastForward(30000);
  assert.equal(await page.locator("#timer").innerText(), paused);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await end();
  await begin();
  await page.clock.fastForward(21000);
  await end();
  assert.match(await page.locator("#modalContent h2").innerText(), /時間|시간/);
  await page.locator('[data-action="retry"]').click();
  await drag(page, [
    [0.1, 0.5],
    [0.9, 0.5],
  ]);
  await page.clock.fastForward(2700);
  await page.locator("#helpButton").evaluate((el) => el.click());
  assert.match(await page.locator("#modalContent h2").innerText(), /균등/);
  await page.locator('[data-action="closehelp"]').click();
  assert.match(await page.locator("#modalContent h2").innerText(), /분할 성공/);
  await page.close();
});

test(
  "primary touch survives a second finger without phantom cuts",
  { skip: browserName !== "chromium" },
  async () => {
    const page = await open({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const session = await page.context().newCDPSession(page);
    await page.locator("canvas").scrollIntoViewIfNeeded();
    const b = await page.locator("canvas").boundingBox();
    const p = (x, y, id) => ({
      x: b.x + x * b.width,
      y: b.y + y * b.height,
      id,
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [p(0.1, 0.5, 1)],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [p(0.1, 0.5, 1), p(0.5, 0.1, 2)],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [p(0.4, 0.5, 1), p(0.5, 0.9, 2)],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [p(0.5, 0.9, 2)], // CDP touchEnd identifies the finger being lifted.
    });
    await pieces(page, 1);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [p(0.9, 0.5, 1)],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await pieces(page, 2);
    await page.close();
  },
);

test("stage stars derive from legacy best scores and rules are visible", async () => {
  const page = await open({ viewport: { width: 320, height: 640 } });
  await page.evaluate(() =>
    localStorage.setItem(
      "toki-split-best-v1",
      JSON.stringify([100, 95, 80, 60]),
    ),
  );
  await page.reload();
  for (const [i, stars] of [3, 2, 1, 0].entries()) {
    assert.equal(
      await page.locator(`[data-stage="${i}"] .stage-stars`).innerText(),
      "★".repeat(stars) + "☆".repeat(3 - stars),
    );
    assert.match(
      await page.locator(`[data-stage="${i}"]`).getAttribute("aria-label"),
      new RegExp(`별 ${stars}개`),
    );
  }
  assert.match(
    await page.locator('[data-stage="4"]').getAttribute("aria-label"),
    /미도전/,
  );
  assert.equal(await page.locator("#modalContent .instruction").count(),0);
  assert.equal(await page.locator(".rating-guide").count(),0);
  await page.locator('[data-action="start"]').click();
  await page.locator('#helpButton').click();
  assert.match(
    await page.locator(".rating-guide").innerText(),
    /75% 미만.*실패/,
  );
  await page.close();
});

test("zero-star result fails after reveal, retries first and preserves highest stage stars", async () => {
  const page = await open({ viewport: { width: 320, height: 640 } });
  await drag(
    page,
    [
      [0.1, 0.65],
      [0.9, 0.65],
    ],
    10,
  );
  await pieces(page, 2);
  assert.equal(await page.locator("#revealPcts span").count(), 2);
  await page.clock.fastForward(2700);
  assert.match(await page.locator("#modalContent h2").innerText(), /실패/);
  assert.equal(await page.locator(".stars").innerText(), "☆☆☆");
  assert.equal(await page.locator(".cta").getAttribute("data-action"), "retry");
  assert.doesNotMatch(
    await page.locator("#modalContent").innerText(),
    /CLEAR!|분할 성공/,
  );
  await page.screenshot({
    path: "test-results/zero-stars-320.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.locator(".cta").click();
  await pieces(page, 1);
  await drag(
    page,
    [
      [0.1, 0.5],
      [0.9, 0.5],
    ],
    10,
  );
  await page.clock.fastForward(2700);
  assert.equal(
    await page.locator('[data-stage="0"] .stage-stars').innerText(),
    "★★★",
  );
  await page.locator('[data-action="retry"]').click();
  await drag(
    page,
    [
      [0.1, 0.65],
      [0.9, 0.65],
    ],
    10,
  );
  await page.clock.fastForward(2700);
  await page.reload();
  assert.equal(
    await page.locator('[data-stage="0"] .stage-stars').innerText(),
    "★★★",
  );
  await page.close();
});

test("timeout is a persisted zero-star failure and incomplete run does not claim all clear", async () => {
  const page = await open();
  await page.clock.fastForward(21000);
  assert.equal(await page.locator(".stars").innerText(), "☆☆☆");
  await page.reload();
  assert.match(
    await page.locator('[data-stage="0"]').getAttribute("aria-label"),
    /별 0개/,
  );
  await page.locator('[data-action="start"]').click();
  await select(page, 9);
  for (const x of [0.22, 0.25, 0.28, 0.31, 0.34])
    await drag(
      page,
      [
        [x, 0.02],
        [x, 0.98],
      ],
      3,
    );
  await pieces(page, 6);
  await page.clock.fastForward(2700);
  assert.match(await page.locator("#modalContent h2").innerText(), /실패/);
  await page.locator('[data-action="summary"]').click();
  assert.doesNotMatch(
    await page.locator("#modalContent h2").innerText(),
    /완주/,
  );
  assert.match(
    await page.locator("#modalContent").innerText(),
    /완료한 스테이지 0 \/ 10/,
  );
  await page.close();
});
