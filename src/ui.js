import { starsForScore, STAR_THRESHOLDS } from "./scoring.js";
import { starRow, resultActions } from "./icons.js";
export function createUI({ state, stages, palette, cutter }) {
  const $ = (id) => document.getElementById(id);
  const targetNote = `<span class="star-target">별 3개 · 정확도 ${STAR_THRESHOLDS[2]}% 이상</span>`;
  function updateHeader() {
    const s = stages[state.index];
    $("stageLabel").textContent =
      `STAGE ${String(state.index + 1).padStart(2, "0")} / ${stages.length}`;
    $("shapeName").textContent = s.name;
    $("splitCount").textContent = s.n;
    $("subtitle").textContent = s.tip;
    $("goalCount").textContent = s.n;
    $("targetArea").textContent = (100 / s.n).toFixed(1);
    updateStats();
    renderStages();
  }
  function updateStats() {
    const s = stages[state.index],
      t = state.paused ? state.pausedLeft / 1000 : state.secondsLeft;
    $("pieceCount").textContent = state.pieces.length;
    $("undoButton").disabled = !state.playing || !state.strokes.length;
    $("timer").innerHTML = `${Math.max(0, t).toFixed(1)}<small>초</small>`;
    const danger = t <= s.time * 0.25;
    $("timer").classList.toggle("danger", danger);
    $("timerFill").style.width =
      `${Math.max(0, Math.min(100, (100 * t) / s.time))}%`;
    $("timerFill").classList.toggle("danger", danger);
    $("canvasHint").textContent = state.revealing
      ? ""
      : "도형을 가로질러 그어보세요";
  }
  function setStatus(message, error = false) {
    $("statusText").textContent = message;
    $("status").classList.toggle("error", error);
  }
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => el.classList.remove("show"), 1900);
  }
  function renderStages() {
    $("stageRail").innerHTML = stages
      .map((s, i) => {
        const played = typeof state.bests[i] === "number",
          stars = starsForScore(state.bests[i]);
        const rating = played
          ? `별 ${stars}개, ${stars ? "통과" : "실패"}`
          : "미도전";
        const best = played ? state.bests[i].toFixed(1) + "%" : "미도전";
        return `<button type="button" class="stage-btn ${i === state.index ? "active" : ""}" data-stage="${i}" aria-label="${i + 1}스테이지 ${s.name}, ${rating}, 최고 기록 ${best}"><span class="n">STAGE ${String(i + 1).padStart(2, "0")}</span><svg class="stage-preview" viewBox="0 0 100 100" aria-hidden="true"><polygon points="${s.poly.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(" ")}"/></svg><span class="stage-name">${s.name}</span><span class="stage-meta">${s.n}등분 · ${s.time}초</span><span class="stage-stars ${played ? (stars ? "earned" : "failed") : "unplayed"}" aria-hidden="true">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span><span class="best">${best}</span></button>`;
      })
      .join("");
  }
  function openModal(inner, mode) {
    state.modalMode = mode;
    $("modalContent").innerHTML = inner;
    $("modal").classList.remove("hidden");
    $("app").inert = true;
    $("modalContent").querySelector("button")?.focus({ preventScroll: true });
  }
  function closeModal() {
    $("modal").classList.add("hidden");
    $("app").inert = false;
  }
  const explanation = `<p class="help-instruction">도형을 가로질러 그어주세요.<br>같은 넓이로 나눌수록 높은 점수!</p><div class="help-ratings" aria-label="별점 조건">${STAR_THRESHOLDS.map((score, i) => `<div class="help-rating ${i === 2 ? "best" : ""}"><span class="help-stars" aria-label="별 ${i + 1}개">${"★".repeat(i + 1)}${"☆".repeat(2 - i)}</span><strong>${score}%</strong><span>이상</span></div>`).join("")}</div><p class="help-failure">75% 미만 또는 시간 초과는 실패예요.</p>`;
  function showScore(score, timeRemaining) {
    const s = stages[state.index],
      stars = starsForScore(score),
      passed = stars > 0;
    setStatus(
      `정확도 ${score.toFixed(1)}% · 별 ${stars}개 · ${passed ? "통과!" : "실패"}`,
      !passed,
    );
    const bars = state.pieces
      .map((p, i) => {
        const pct = (100 * p.count) / cutter.baseArea;
        return `<div class="segment"><span>조각 ${i + 1}</span><div class="segment-track"><i style="width:${Math.min(100, (pct / (100 / s.n)) * 55)}%;background:${palette[i % palette.length]}"></i></div><b>${pct.toFixed(1)}%</b></div>`;
      })
      .join("");
    openModal(
      `<div class="modal-kicker">STAGE ${String(state.index + 1).padStart(2, "0")} · ${passed ? "CLEAR!" : "TRY AGAIN"}</div><h2>${passed ? "분할 성공!" : "도전 실패"}</h2>${starRow(stars)}<div class="score-number ${passed ? "" : "failed"}">${score.toFixed(1)}<span>%</span></div><div class="score-caption">정확도</div>${targetNote}<div class="segment-list">${bars}</div><div class="recap"><span>최고 기록<strong>${state.bests[state.index].toFixed(1)}%</strong></span><span>목표 면적<strong>${(100 / s.n).toFixed(1)}%</strong></span><span>남은 시간<strong>${timeRemaining.toFixed(1)}초</strong></span></div>${resultActions(state.index === stages.length - 1)}`,
      passed ? "success" : "failure",
    );
  }
  function showTimeout() {
    openModal(
      `<div class="modal-kicker">TIME OVER</div><h2>시간이 끝났어요!</h2>${starRow(0)}<p>${state.pieces.length} / ${stages[state.index].n}조각 완성</p>${targetNote}${resultActions(state.index === stages.length - 1)}`,
      "timeout",
    );
  }
  function summary() {
    const attempted = state.results.filter((v) => typeof v === "number"),
      completed = attempted.filter((v) => starsForScore(v) > 0);
    const avg = attempted.length
      ? attempted.reduce((a, b) => a + b, 0) / attempted.length
      : 0;
    openModal(
      `<div class="modal-kicker">CHALLENGE COMPLETE</div><h2>${completed.length === stages.length ? "모든 스테이지 완주!" : "스테이지 도전 결과"}</h2><div class="final-avg">${avg.toFixed(1)}%</div><p>완료한 스테이지 ${completed.length} / ${stages.length}</p><button class="cta" data-action="stages">스테이지 선택</button><button class="secondary" data-action="home">홈으로</button>`,
      "summary",
    );
  }
  return {
    updateHeader,
    updateStats,
    setStatus,
    toast,
    renderStages,
    openModal,
    closeModal,
    explanation,
    showScore,
    showTimeout,
    summary,
  };
}
