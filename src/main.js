import { stages, palette } from "./stages.js";
import { accuracyScore } from "./scoring.js";
import { createGameState, resetGame, applyCut, undoCut } from "./game-state.js";
import { loadBests, saveBests } from "./storage.js";
import { createCutter } from "./cutter.js";
import { createRenderer } from "./renderer.js";
import { bindInput } from "./input.js";
import { createUI } from "./ui.js";
const $ = (id) => document.getElementById(id);
const state = createGameState();
state.bests = loadBests(undefined, stages.length);
const canvas = $("gameCanvas"),
  cutter = createCutter();
const { resize, draw, updateRegionBitmap } = createRenderer({
  canvas,
  state,
  stages,
  palette,
  cutter,
});
const {
  updateHeader,
  updateStats,
  setStatus,
  toast,
  renderStages,
  openModal,
  explanation,
  showScore,
  summary,
} = createUI({ state, stages, palette, cutter });
function cancelReveal() {
  clearTimeout(state.revealTimeout);
  state.revealTimeout = null;
  state.revealing = false;
  $("revealBanner").classList.remove("show");
  $("revealPcts").classList.remove("show");
  $("revealPcts").replaceChildren();
}
function resetPieces() {
  cancelReveal();
  input.cancel();
  clearTimeout(state.toastTimeout);
  $("toast").classList.remove("show");
  cutter.prepare(stages[state.index].poly);
  resetGame(state, cutter, stages[state.index].time);
  updateRegionBitmap();
  updateHeader();
  setStatus("게임 시작을 눌러주세요");
  draw();
}
function intro() {
  resetPieces();
  const s = stages[state.index];
  openModal(
    `<div class="modal-kicker">STAGE ${String(state.index + 1).padStart(2, "0")} · TIME ATTACK</div><h2>${s.name} ${s.n}등분 챌린지</h2><p>${s.time}초 안에 ${s.n}등분하세요.</p><button class="cta" data-action="start">도전 시작 →</button>`,
    "intro",
  );
}
function start() {
  resetPieces();
  state.playing = true;
  state.deadline = performance.now() + stages[state.index].time * 1000;
  $("modal").classList.add("hidden");
  setStatus("선을 그어 조각을 나눠보세요");
  tick();
}
function recordResult(score) {
  const prior = state.bests[state.index];
  if (typeof prior !== "number" || score > prior) {
    state.bests[state.index] = score;
    saveBests(undefined, state.bests);
  }
  state.results[state.index] = score;
  renderStages();
}
function finish() {
  state.playing = false;
  state.drag = null;
  state.revealing = true;
  const total = cutter.baseArea,
    score = accuracyScore(state.pieces, total);
  const timeRemaining = state.secondsLeft;
  recordResult(score);
  const percentages = state.pieces.map((p) => (100 * p.count) / total);
  $("revealPcts").innerHTML = percentages
    .map((pct, i) => `<span>조각 ${i + 1} · ${pct.toFixed(1)}%</span>`)
    .join("");
  $("revealBanner").classList.add("show");
  $("revealPcts").classList.add("show");
  updateStats();
  renderStages();
  draw();
  setStatus(
    `등분 완료! ${percentages.map((v) => v.toFixed(1) + "%").join(" / ")}`,
  );
  // A short board-focused result reveal before showing the full score modal.
  state.revealTimeout = setTimeout(() => {
    if (!state.revealing) return;
    cancelReveal();
    draw();
    showScore(score, timeRemaining);
  }, 2600);
}
function timeUp() {
  input.cancel();
  state.playing = false;
  state.paused = false;
  state.secondsLeft = 0;
  recordResult(0);
  updateStats();
  draw();
  setStatus("시간 초과 · 다시 도전해보세요", true);
  openModal(
    `<div class="modal-kicker" style="color:var(--red)">TIME OVER</div><h2>시간이 끝났어요!</h2><div class="stars" aria-label="별 0개">☆☆☆</div><p>목표 조각 수를 완성하지 못해 별 0개 · 실패예요.</p><p>이번에는 <strong style="color:white">${state.pieces.length} / ${stages[state.index].n}조각</strong>까지 완성했어요. 다시 도전하면 처음부터 새롭게 시작합니다.</p><button class="cta" data-action="retry">다시 도전하기 →</button><button class="secondary" data-action="next">다른 스테이지 도전</button>`,
    "timeout",
  );
}
let helpReturn = null;
function showHelp() {
  if (
    state.revealing ||
    (state.modalMode === "help" && !$("modal").classList.contains("hidden"))
  )
    return;
  if (state.playing) {
    tick();
    if (!state.playing) return;
  }
  helpReturn = $("modal").classList.contains("hidden")
    ? null
    : { html: $("modalContent").innerHTML, mode: state.modalMode };
  input.cancel();
  if (state.playing) {
    state.paused = true;
    state.pausedLeft = Math.max(0, state.deadline - performance.now());
    state.secondsLeft = state.pausedLeft / 1000;
    state.playing = false;
  }
  draw();
  openModal(
    `<div class="modal-kicker">HOW TO PLAY</div><h2>도형을 균등하게 나눠요</h2><p>같은 넓이로 나누는 감각을 시험하는 간단한 타임어택 게임입니다.</p>${explanation}<button class="cta" data-action="closehelp">${state.paused ? "이어하기 →" : "확인"}</button>`,
    "help",
  );
  updateStats();
}
function closeHelp() {
  $("modal").classList.add("hidden");
  if (state.paused) {
    state.playing = true;
    state.deadline = performance.now() + state.pausedLeft;
    state.paused = false;
    tick();
  } else if (helpReturn) {
    openModal(helpReturn.html, helpReturn.mode);
    helpReturn = null;
  }
  $("helpButton").focus();
  updateStats();
}
function tick() {
  if (!state.playing) return;
  state.secondsLeft = Math.max(0, (state.deadline - performance.now()) / 1000);
  updateStats();
  if (state.secondsLeft <= 0) timeUp();
}
setInterval(tick, 85);

const input = bindInput(canvas, state, {
  draw,
  beforeCommit: () => {
    tick();
    return state.playing;
  },
  commit(points) {
    const result = applyCut(state, cutter, points, stages[state.index].n);
    if (result.ok) {
      updateRegionBitmap();
      const n = stages[state.index].n;
      setStatus(
        `${state.pieces.length}/${n}조각 완성 · ${n - state.pieces.length}조각 남음`,
      );
      updateStats();
      draw();
      if (state.pieces.length === n) finish();
    } else {
      toast(result.reason);
      setStatus(result.reason, true);
      draw();
    }
  },
});

$("undoButton").addEventListener("click", () => {
  tick();
  if (!state.playing || !state.strokes.length) return;
  input.cancel();
  undoCut(state, cutter);
  updateRegionBitmap();
  state.drag = null;
  updateStats();
  draw();
  setStatus("직전 절단을 되돌렸어요");
});
$("retryButton").addEventListener("click", intro);
$("helpButton").addEventListener("click", showHelp);
$("stageRail").addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-stage]");
  if (!el) return;
  state.index = Number(el.dataset.stage);
  intro();
});
$("modalContent").addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-action]");
  if (!el) return;
  switch (el.dataset.action) {
    case "start":
    case "retry":
      start();
      break;
    case "next":
      state.index = Math.min(stages.length - 1, state.index + 1);
      intro();
      break;
    case "summary":
      summary();
      break;
    case "first":
      state.index = 0;
      state.results = [];
      intro();
      break;
    case "dismiss":
      $("modal").classList.add("hidden");
      break;
    case "closehelp":
      closeHelp();
      break;
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.playing) {
    input.cancel();
    state.pausedLeft = Math.max(0, state.deadline - performance.now());
    state.secondsLeft = state.pausedLeft / 1000;
    state.playing = false;
    state.paused = true;
    updateStats();
    draw();
  } else if (
    !document.hidden &&
    state.paused &&
    $("modal").classList.contains("hidden")
  ) {
    state.playing = true;
    state.paused = false;
    state.deadline = performance.now() + state.pausedLeft;
    tick();
  }
});
if ("ResizeObserver" in window)
  new ResizeObserver(resize).observe($("boardBox"));
window.addEventListener("resize", resize);
intro();
resize();
