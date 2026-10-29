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
    viewport: { width: 390, height: 844 },
    ...options,
  });
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-10-29T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-29T00:00:01Z"));
  await page.goto(baseURL);
  page.on("close", () => assert.deepEqual(errors, []));
  return page;
}
async function select(page, i = 0) {
  if (await page.locator("#homeScreen").isVisible())
    await page.getByRole("button", { name: "게임 시작", exact: true }).click();
  else if (!(await page.locator("#stageScreen").isVisible()))
    await page.locator("#backButton").click();
  await page.locator(`[data-stage="${i}"]`).click();
}
async function drag(page, points, steps = 1) {
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

test("home → stages → instant play, no intro or in-game stage rail", async () => {
  const page = await open();
  assert.equal(await page.locator("#homeScreen").isVisible(), true);
  await page.screenshot({ path: "test-results/home-mobile.png" });
  assert.equal(await page.locator("#modal").isVisible(), false);
  await page.getByRole("button", { name: "게임 시작", exact: true }).click();
  assert.equal(await page.locator("#stageScreen").isVisible(), true);
  assert.equal(await page.locator("[data-stage]").count(), 10);
  await page.screenshot({ path: "test-results/stages-mobile.png" });
  await page.locator('[data-stage="0"]').click();
  assert.equal(await page.locator("#gameScreen").isVisible(), true);
  assert.equal(await page.locator("#modal").isVisible(), false);
  assert.equal(await page.locator("#stageRail").isVisible(), false);
  assert.equal(parseFloat(await page.locator("#timer").innerText()), 2);
  await page.close();
});

test("mobile and landscape play fits viewport and wheel cannot scroll it", async () => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1280, height: 1000 },
  ]) {
    const page = await open({ viewport, hasTouch: true });
    await select(page);
    const layout = await page.evaluate(() => {
      const box = document.getElementById("boardBox").getBoundingClientRect();
      const actions = document
        .querySelector(".actions")
        .getBoundingClientRect();
      return {
        box: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          bottom: box.bottom,
        },
        actionsBottom: actions.bottom,
        scrollHeight: document.documentElement.scrollHeight,
        height: innerHeight,
        width: innerWidth,
        pattern: getComputedStyle(
          document.getElementById("boardBox"),
          "::before",
        ).backgroundImage,
      };
    });
    assert.ok(layout.scrollHeight <= layout.height + 1, JSON.stringify(layout));
    assert.ok(layout.actionsBottom <= layout.height, JSON.stringify(layout));
    assert.ok(layout.box.y >= 0 && layout.box.bottom <= layout.height);
    assert.ok(Math.abs(layout.box.width - layout.box.height) < 1);
    assert.equal(layout.pattern, "none");
    await page.mouse.wheel(0, 500);
    assert.equal(await page.evaluate(() => scrollY), 0);
    await drag(
      page,
      [
        [0.1, 0.5],
        [0.9, 0.5],
      ],
      12,
    );
    await pieces(page, 2);
    await page.screenshot({ path: `test-results/game-${viewport.width}.png` });
    await page.clock.fastForward(2500);
    assert.equal(await page.locator("#modal").isVisible(), false);
    await page.clock.fastForward(150);
    assert.equal(await page.locator(".result-actions button").count(), 3);
    assert.equal(await page.locator(".stars .star").count(), 3);
    assert.equal(await page.locator(".stars .star.earned").count(), 3);
    assert.match(
      await page.locator("#modalContent .star-target").innerText(),
      /98% 이상/,
    );
    await page.screenshot({
      path: `test-results/new-result-${viewport.width}.png`,
    });
    await page
      .getByRole("button", { name: "다음 스테이지", exact: true })
      .click();
    assert.match(await page.locator("#shapeName").innerText(), /삼각형/);
    assert.equal(await page.locator("#modal").isVisible(), false);
    await page.close();
  }
});

test("short deadlines, pause/resume, timeout icons and stage navigation cancel old reveal", async () => {
  const page = await open();
  await select(page);
  await page.clock.fastForward(500);
  await page.locator("#helpButton").click();
  const paused = await page.locator("#timer").innerText();
  await page.clock.fastForward(10000);
  assert.equal(await page.locator("#timer").innerText(), paused);
  await page.locator('[data-action="closehelp"]').click();
  await page.clock.fastForward(1600);
  assert.match(await page.locator("#modalContent h2").innerText(), /시간/);
  assert.equal(await page.locator(".stars .star.earned").count(), 0);
  assert.equal(await page.locator(".result-actions button").count(), 3);
  await page.getByRole("button", { name: "재도전", exact: true }).click();
  await pieces(page, 1);
  await drag(page, [
    [0.1, 0.5],
    [0.9, 0.5],
  ]);
  await pieces(page, 2);
  await page.locator("#backButton").click();
  await page.clock.fastForward(3000);
  assert.equal(await page.locator("#stageScreen").isVisible(), true);
  assert.equal(await page.locator("#modal").isVisible(), false);
  await page.locator('[data-stage="9"]').click();
  assert.equal(parseFloat(await page.locator("#timer").innerText()), 5.8);
  await page.close();
});

test("score failure, highest stage stars, retry and stage icons", async () => {
  const page = await open();
  await select(page);
  await drag(page, [
    [0.1, 0.56],
    [0.9, 0.56],
  ]);
  await page.clock.fastForward(2700);
  assert.ok(
    Math.abs(parseFloat(await page.locator(".score-number").innerText()) - 80) <
      1,
  );
  assert.equal(await page.locator(".stars .star.earned").count(), 1);
  await page.getByRole("button", { name: "재도전", exact: true }).click();
  await drag(page, [
    [0.1, 0.5],
    [0.9, 0.5],
  ]);
  await page.clock.fastForward(2700);
  await page.getByRole("button", { name: "재도전", exact: true }).click();
  await drag(page, [
    [0.1, 0.65],
    [0.9, 0.65],
  ]);
  await page.clock.fastForward(2700);
  assert.match(await page.locator("#modalContent h2").innerText(), /실패/);
  assert.equal(await page.locator(".stars .star.earned").count(), 0);
  await page
    .getByRole("button", { name: "스테이지 선택", exact: true })
    .click();
  assert.equal(
    await page.locator('[data-stage="0"] .stage-stars').innerText(),
    "★★★",
  );
  await page.reload();
  await page.getByRole("button", { name: "게임 시작", exact: true }).click();
  assert.equal(
    await page.locator('[data-stage="0"] .stage-stars').innerText(),
    "★★★",
  );
  await page.close();
});

test("freehand/zigzag/incomplete/intersection/over-goal and undo still work", async () => {
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
  await drag(page, [
    [0.1, 0.5],
    [0.9, 0.5],
  ]);
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

test("all ten stages complete and use direct next-stage navigation", async () => {
  const page = await open({ viewport: { width: 320, height: 568 } });
  await select(page);
  const stages = await page.evaluate(
    async () => (await import("/src/stages.js")).stages,
  );
  assert.deepEqual(
    stages.map((s) => s.time),
    [2, 2.4, 3.2, 3.5, 3.7, 3.7, 4, 4.3, 5, 5.8],
  );
  for (const [i, s] of stages.entries()) {
    const min = Math.min(...s.poly.map((p) => p.x)),
      max = Math.max(...s.poly.map((p) => p.x));
    for (let j = 1; j < s.n; j++) {
      const x = min + ((max - min) * j) / s.n;
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
    assert.equal(await page.locator("#revealPcts span").count(), s.n);
    await page.clock.fastForward(2700);
    assert.equal(await page.locator(".segment").count(), s.n);
    if (i === 9) {
      await page.screenshot({ path: "test-results/six-pieces-compact.png" });
      await page
        .getByRole("button", { name: "전체 결과", exact: true })
        .click();
      assert.match(
        await page.locator("#modalContent").innerText(),
        /완료한 스테이지 10 \/ 10/,
      );
    } else
      await page
        .getByRole("button", { name: "다음 스테이지", exact: true })
        .click();
  }
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
    await select(page);
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

test(
  "primary touch survives a second finger without phantom cuts",
  { skip: browserName !== "chromium" },
  async () => {
    const page = await open({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await select(page);
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

test("cancelled pointers, backgrounding and viewport resize discard partial strokes", async () => {
  const page = await open();
  await select(page);
  let b = await page.locator("canvas").boundingBox();
  const begin = async () => {
    b = await page.locator("canvas").boundingBox();
    await page.mouse.move(b.x + 0.1 * b.width, b.y + 0.5 * b.height);
    await page.mouse.down();
    await page.mouse.move(b.x + 0.4 * b.width, b.y + 0.5 * b.height);
  };
  const end = async () => {
    const r = await page.locator("canvas").boundingBox();
    await page.mouse.move(r.x + 0.9 * r.width, r.y + 0.5 * r.height);
    await page.mouse.up();
    await pieces(page, 1);
  };
  await begin();
  await page
    .locator("canvas")
    .dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await end();
  await begin();
  await page.locator("canvas").evaluate((el) => el.releasePointerCapture(1));
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
  await page.clock.fastForward(10000);
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
  await page.setViewportSize({ width: 390, height: 920 });
  await page.clock.runFor(20);
  await end();
  await begin();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.runFor(20);
  await end();
  await page.locator("canvas").dispatchEvent("pointerdown", {
    pointerId: 50,
    isPrimary: false,
    button: 0,
    clientX: b.x,
    clientY: b.y,
  });
  await drag(
    page,
    [
      [0.1, 0.5],
      [0.9, 0.5],
    ],
    8,
  );
  await pieces(page, 2);
  await page.close();
});

test("real-time mobile round cuts immediately, reveals result, and expires in two seconds", async () => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  try {
    await page.goto(baseURL);
    await select(page);
    const box = await page.locator("canvas").boundingBox();
    assert.ok(box.width > 200);
    await drag(
      page,
      [
        [0.1, 0.5],
        [0.9, 0.5],
      ],
      8,
    );
    await pieces(page, 2);
    assert.equal(await page.locator("#modal").isVisible(), false);
    await page.locator(".score-number").waitFor({ timeout: 5000 });
    assert.ok(
      parseFloat(await page.locator(".score-number").innerText()) >= 98,
    );
    await page.getByRole("button", { name: "재도전", exact: true }).click();
    await page.waitForTimeout(2200);
    assert.match(await page.locator("#modalContent h2").innerText(), /시간/);
  } finally {
    await page.close();
  }
});
