import { starsForScore, STAR_THRESHOLDS } from "./scoring.js";
export function createUI({ state, stages, palette, cutter }) {
  const $ = (id) => document.getElementById(id);
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
    const stage = stages[state.index];
    $("pieceCount").textContent = state.pieces.length;
    $("undoButton").disabled = !state.playing || !state.strokes.length;
    const t = state.paused ? state.pausedLeft / 1000 : state.secondsLeft;
    $("timer").innerHTML = `${Math.max(0, t).toFixed(1)}<small>초</small>`;
    $("timer").classList.toggle("danger", t <= 5);
    const fill = $("timerFill");
    fill.style.width = `${Math.max(0, Math.min(100, (100 * t) / stage.time))}%`;
    fill.classList.toggle("danger", t <= 5);
    $("canvasHint").textContent = state.revealing
      ? ""
      : state.playing
        ? "손가락으로 직접 선을 그려 잘라보세요"
        : "도형 위를 자유롭게 그려 자르세요 ✎";
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
      .map((stage, i) => {
        const played = typeof state.bests[i] === "number";
        const stars = starsForScore(state.bests[i]);
        const best = played
          ? state.bests[i].toFixed(1) + "%"
          : `${stage.n}등분`;
        const rating = played
          ? `별 ${stars}개, ${stars ? "통과" : "실패"}`
          : "미도전";
        return `<button type="button" class="stage-btn ${i === state.index ? "active" : ""}" data-stage="${i}" aria-label="${i + 1}스테이지 ${stage.name}, ${rating}, 최고 기록 ${best}"><span class="n">${String(i + 1).padStart(2, "0")}</span><span class="stage-stars ${played ? (stars ? "earned" : "failed") : "unplayed"}" aria-hidden="true">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span><span class="best">${best}</span></button>`;
      })
      .join("");
  }
  function openModal(inner, mode) {
    state.modalMode = mode;
    $("modalContent").innerHTML = inner;
    $("modal").classList.remove("hidden");
  }
  const ratingGuide = `<p class="rating-guide">★ ${STAR_THRESHOLDS[0]}% 이상 · ★★ ${STAR_THRESHOLDS[1]}% 이상 · ★★★ ${STAR_THRESHOLDS[2]}% 이상<br><span>${STAR_THRESHOLDS[0]}% 미만은 별 0개 · 실패</span></p>`;
  const explanation = `<div class="instruction"><strong>조작 방법</strong><br>① 손가락 또는 마우스로 <strong>원하는 곡선이나 직선을 직접 그려</strong> 자릅니다.<br>② 그린 선이 도형의 한쪽 경계부터 다른 쪽 경계까지 닿아야 조각이 나뉩니다.<br>③ N개 조각이 완성되면 <strong>각 조각의 실제 면적 비율</strong>을 잠시 보여준 후 정확도를 발표합니다.<br><br>※ 그린 경로 그대로 잘리며, 조각 수가 목표를 초과하는 절단은 취소됩니다.</div>${ratingGuide}`;
  function showScore(score, timeRemaining) {
    const stage = stages[state.index],
      total = cutter.baseArea;
    const stars = starsForScore(score),
      passed = stars > 0;
    setStatus(
      `정확도 ${score.toFixed(1)}% · 별 ${stars}개 · ${passed ? "통과!" : "실패 · 다시 도전해보세요"}`,
      !passed,
    );
    const bars = state.pieces
      .map((p, i) => {
        const pct = (p.count / total) * 100;
        return `<div class="segment"><span>조각 ${i + 1}</span><div class="segment-track"><i style="width:${Math.min(100, (pct / (100 / stage.n)) * 55)}%;background:${palette[i % palette.length]}"></i></div><b>${pct.toFixed(1)}%</b></div>`;
      })
      .join("");
    const last = state.index === stages.length - 1;
    const advanceAction = last ? "summary" : "next";
    const advanceLabel = last ? "전체 결과 보기 →" : "다음 스테이지 →";
    openModal(
      `<div class="modal-kicker">STAGE ${String(state.index + 1).padStart(2, "0")} · ${passed ? "CLEAR!" : "TRY AGAIN"}</div><h2>${passed ? "분할 성공!" : "도전 실패"}</h2><div class="score-number ${passed ? "" : "failed"}">${score.toFixed(1)}<span>%</span></div><div class="stars" aria-label="별 ${stars}개">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div><p style="margin-bottom:0">${stars === 3 ? "거의 완벽한 균등 분할이에요!" : stars === 2 ? "훌륭해요. 아주 균등하게 나눴어요!" : stars === 1 ? "성공! 조금만 더 균등하게 나눠보세요." : `통과하려면 정확도 ${STAR_THRESHOLDS[0]}% 이상이 필요해요. 조각의 면적 차이를 줄여보세요.`}</p><div class="segment-list">${bars}</div><div class="best-record">최고 기록 <strong>${state.bests[state.index].toFixed(1)}%</strong></div><div class="recap"><span>조각별 목표 <strong>${(100 / stage.n).toFixed(1)}%</strong></span><span>남은 시간 <strong>${timeRemaining.toFixed(1)}초</strong></span></div><button class="cta" data-action="${passed ? advanceAction : "retry"}">${passed ? advanceLabel : "다시 도전하기 →"}</button><button class="secondary" data-action="${passed ? "retry" : advanceAction}">${passed ? "이 스테이지 다시 도전" : advanceLabel}</button>`,
      passed ? "success" : "failure",
    );
  }

  function summary() {
    const attempted = state.results.filter((v) => typeof v === "number");
    const completed = attempted.filter((score) => starsForScore(score) > 0);
    const average = attempted.length
      ? attempted.reduce((a, b) => a + b, 0) / attempted.length
      : 0;
    const bestCount = state.bests.filter((v) => typeof v === "number").length;
    openModal(
      `<div class="modal-kicker">CHALLENGE COMPLETE</div><h2>${completed.length === stages.length ? `${stages.length}개 스테이지 완주!` : "스테이지 도전 결과"}</h2><p>이번 플레이에서 도전한 ${attempted.length}개 스테이지의 평균 정확도입니다.</p><div class="final-avg">${average.toFixed(1)}%</div><div class="instruction">완료한 스테이지 ${completed.length} / ${stages.length}<br>최고 기록이 저장된 스테이지 ${bestCount} / ${stages.length}<br>스테이지 선택에서 원하는 도형에 다시 도전할 수 있어요.</div><button class="cta" data-action="first">처음부터 다시 도전 →</button><button class="secondary" data-action="dismiss">스테이지 선택하기</button>`,
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
    explanation,
    showScore,
    summary,
  };
}
