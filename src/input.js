// Keep the actual freehand samples; only rendering is coalesced to animation frames.
export function bindInput(canvas, state, { draw, beforeCommit, commit }) {
  let frame = 0;
  const preview = () => {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        draw();
      });
  };
  const position = (ev) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) / r.width,
      y: (ev.clientY - r.top) / r.height,
    };
  };
  const append = (ev) => {
    const points = state.drag.points,
      p = position(ev),
      last = points.at(-1);
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.0015)
      points.push(p);
  };
  const release = (id) => {
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  };
  canvas.addEventListener("pointerdown", (ev) => {
    if (!state.playing || !ev.isPrimary || ev.button > 0 || state.drag) return;
    ev.preventDefault();
    canvas.setPointerCapture(ev.pointerId);
    state.drag = { id: ev.pointerId, points: [position(ev)] };
    preview();
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!state.playing || !state.drag || ev.pointerId !== state.drag.id) return;
    ev.preventDefault();
    const events = ev.getCoalescedEvents?.() ?? [];
    if (events.length) events.forEach(append);
    else append(ev);
    preview();
  });
  canvas.addEventListener("pointerup", (ev) => {
    if (!state.drag || ev.pointerId !== state.drag.id) return;
    ev.preventDefault();
    append(ev);
    const points = state.drag.points;
    state.drag = null;
    release(ev.pointerId);
    if (beforeCommit()) commit(points);
    else draw();
  });
  const cancel = (ev) => {
    if (!state.drag || ev.pointerId !== state.drag.id) return;
    state.drag = null;
    release(ev.pointerId);
    preview();
  };
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("lostpointercapture", cancel);
  return {
    cancel() {
      if (!state.drag) return;
      const id = state.drag.id;
      state.drag = null;
      release(id);
      preview();
    },
  };
}
