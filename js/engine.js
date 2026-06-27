/*
 * engine.js — keyframe interpolation + playback.
 *
 * A method returns an array of keyframes (each a full scene, see render.js).
 * The engine maps a global progress p in [0,1] onto that timeline, finds the
 * surrounding pair of keyframes and tweens between them by matching panels by
 * index and drawables by `id`. So methods describe discrete meaningful states;
 * the engine produces the continuous motion between them.
 */
(function (root) {
  "use strict";
  const E = {};
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  function lerpVec(a, b, t) { return a.map((v, i) => lerp(v, b[i], t)); }
  function lerpPts(a, b, t) {
    if (!a || !b || a.length !== b.length) return b;
    return a.map((p, i) => p.map((v, d) => lerp(v, b[i][d], t)));
  }

  const NUM = ["angle", "len1", "len2", "rx", "ry", "r", "width", "alpha"];
  const VEC = ["center", "from", "to", "at"];

  function lerpDrawable(a, b, t) {
    if (!a) { const d = Object.assign({}, b); d.alpha = lerp(0, b.alpha == null ? 1 : b.alpha, t); return d; }
    if (!b) { const d = Object.assign({}, a); d.alpha = lerp(a.alpha == null ? 1 : a.alpha, 0, t); return d; }
    const d = Object.assign({}, b);
    for (const k of NUM) if (typeof a[k] === "number" && typeof b[k] === "number") d[k] = lerp(a[k], b[k], t);
    for (const k of VEC) if (Array.isArray(a[k]) && Array.isArray(b[k])) d[k] = lerpVec(a[k], b[k], t);
    if (a.pts && b.pts) d.pts = lerpPts(a.pts, b.pts, t);
    if (a.lines && b.lines && a.lines.length === b.lines.length) {
      d.lines = b.lines.map((e, i) => ({
        from: lerpVec(a.lines[i].from, e.from, t),
        to: lerpVec(a.lines[i].to, e.to, t),
        w: lerp(a.lines[i].w, e.w, t),
      }));
    }
    return d;
  }

  function indexById(list) {
    const m = new Map();
    (list || []).forEach((d, i) => m.set(d.id != null ? d.id : "_" + i, d));
    return m;
  }

  function lerpPanel(a, b, t) {
    if (!a || a.kind !== b.kind) return b;
    const p = Object.assign({}, b);
    if (b.view && a.view) {
      p.view = { xmin: lerp(a.view.xmin, b.view.xmin, t), xmax: lerp(a.view.xmax, b.view.xmax, t), ymin: lerp(a.view.ymin, b.view.ymin, t), ymax: lerp(a.view.ymax, b.view.ymax, t) };
    }
    if (b.kind === "plane") {
      const am = indexById(a.drawables), bm = indexById(b.drawables), keys = new Set([...am.keys(), ...bm.keys()]);
      const order = [];
      (a.drawables || []).forEach((d, i) => order.push(d.id != null ? d.id : "_" + i));
      (b.drawables || []).forEach((d, i) => { const k = d.id != null ? d.id : "_" + i; if (!order.includes(k)) order.push(k); });
      p.drawables = order.filter((k) => keys.has(k)).map((k) => lerpDrawable(am.get(k), bm.get(k), t));
    } else if (b.kind === "matrix") {
      if (a.matrix && a.matrix.length === b.matrix.length && a.matrix[0].length === b.matrix[0].length)
        p.matrix = b.matrix.map((r, i) => r.map((v, j) => lerp(a.matrix[i][j], v, t)));
    } else if (b.kind === "bars") {
      if (a.values && a.values.length === b.values.length)
        p.values = b.values.map((v, i) => lerp(a.values[i], v, t));
    }
    return p;
  }

  // interpolate the timeline at global progress p in [0,1] -> a single scene
  E.interp = function (frames, p, ease) {
    const N = frames.length;
    if (N === 1) return frames[0];
    const x = Math.max(0, Math.min(1, p)) * (N - 1);
    let i = Math.floor(x);
    if (i >= N - 1) i = N - 2;
    let t = x - i;
    if (ease) t = smooth(t);
    const A = frames[i], B = frames[i + 1];
    const panels = B.panels.map((bp, k) => lerpPanel(A.panels[k], bp, t));
    const pick = t < 0.5 ? A : B;
    return { panels, caption: pick.caption, step: pick.step, readout: pick.readout };
  };

  // ---- Player: drives p over time -----------------------------------------
  E.Player = function (onScene) {
    let frames = [], p = 0, playing = false, raf = null, last = 0, speed = 0.12;
    const api = {};
    api.setFrames = (f) => { frames = f; if (p > 1) p = 1; api.render(); };
    api.frameCount = () => frames.length;
    api.seek = (np) => { p = Math.max(0, Math.min(1, np)); api.render(); };
    api.progress = () => p;
    api.setSpeed = (s) => { speed = s; };
    api.isPlaying = () => playing;
    api.render = () => { if (frames.length) onScene(E.interp(frames, p, true), p); };
    function tick(ts) {
      if (!playing) return;
      if (!last) last = ts;
      const dt = (ts - last) / 1000; last = ts;
      p += dt * speed;
      if (p >= 1) { p = 1; playing = false; }
      api.render();
      if (playing) raf = requestAnimationFrame(tick);
    }
    api.play = () => { if (p >= 1) p = 0; playing = true; last = 0; raf = requestAnimationFrame(tick); };
    api.pause = () => { playing = false; if (raf) cancelAnimationFrame(raf); };
    api.toggle = () => { playing ? api.pause() : api.play(); return playing; };
    return api;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
  root.DAV = root.DAV || {};
  root.DAV.engine = E;
})(typeof window !== "undefined" ? window : globalThis);
