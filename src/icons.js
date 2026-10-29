const paths = {
  retry: '<path d="M3 10a9 9 0 1 1 2 8"/><path d="M3 4v6h6"/>',
  stages:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  summary: '<path d="M5 21V3m0 0h14l-3 5 3 5H5"/>',
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.next}</svg>`;
}
export function starRow(count) {
  return `<div class="stars" role="img" aria-label="별 ${count}개">${Array.from({ length: 3 }, (_, i) => `<svg class="star ${i < count ? "earned" : ""}" viewBox="0 0 48 48" aria-hidden="true"><path d="m24 4 6.2 12.6 13.9 2-10.1 9.8 2.4 13.8L24 35.7l-12.4 6.5L14 28.4 3.9 18.6l13.9-2z"/></svg>`).join("")}</div>`;
}
export function resultActions(last) {
  const buttons = [
    ["retry", "재도전", "retry"],
    ["stages", "스테이지 선택", "stages"],
    [
      last ? "summary" : "next",
      last ? "전체 결과" : "다음 스테이지",
      last ? "summary" : "next",
    ],
  ];
  return `<nav class="result-actions" aria-label="결과 메뉴">${buttons.map(([action, label, glyph]) => `<button type="button" class="icon-action ${action === "next" ? "primary" : ""}" data-action="${action}" aria-label="${label}" title="${label}">${icon(glyph)}<span>${label}</span></button>`).join("")}</nav>`;
}
