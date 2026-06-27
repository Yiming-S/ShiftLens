/*
 * render.js — one generic renderer for ALL methods.
 *
 * A method never draws anything itself; it emits a declarative SCENE and the
 * renderer turns it into pixels. A scene is:
 *
 *   { caption, step, readout, panels: [ panel, ... ] }
 *
 *   panel.kind = "plane"  -> a data-space scatter with `drawables`
 *              = "matrix" -> a heat-map of `matrix`
 *              = "bars"   -> a bar chart of `values` (e.g. an eigenspectrum)
 *
 * Each panel carries a normalized `rect` [x,y,w,h] in [0,1] of the canvas, so
 * split-screen layouts (data plane + kernel matrix) fall out for free.
 *
 * Keeping methods purely declarative means the same renderer + interpolator
 * serve the affine, kernel, manifold and transport families — consistency by
 * construction.
 */
(function (root) {
  "use strict";
  const R = {};

  // project data coords -> pixels inside a panel rect, preserving aspect ratio
  function makeProj(view, rx, ry, rw, rh, pad) {
    const vw = view.xmax - view.xmin, vh = view.ymax - view.ymin;
    const s = Math.min((rw - 2 * pad) / vw, (rh - 2 * pad) / vh);
    const cx = rx + rw / 2, cy = ry + rh / 2;
    const mx = (view.xmin + view.xmax) / 2, my = (view.ymin + view.ymax) / 2;
    return {
      s,
      to(x, y) { return [cx + (x - mx) * s, cy - (y - my) * s]; },
    };
  }

  function colorOf(c, th) {
    if (c && c[0] === "#") return c;
    return th.colors[c] || th.colors.src;
  }

  function dot(ctx, x, y, r, fill, shape) {
    ctx.fillStyle = fill;
    if (shape === "triangle") {
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.1, y + r);
      ctx.lineTo(x - r * 1.1, y + r);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fill();
    }
  }

  function arrow(ctx, x0, y0, x1, y1, col, w) {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0), h = 6 + w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4));
    ctx.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
  }

  function panelTitle(ctx, text, rx, ry, rw, th) {
    if (!text) return;
    ctx.fillStyle = th.colors.textMute;
    ctx.font = "13px " + th.font;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(text, rx + rw / 2, ry + 4);
  }

  function drawPlane(ctx, p, rx, ry, rw, rh, th) {
    const pad = 26;
    const proj = makeProj(p.view, rx, ry, rw, rh, pad);
    panelTitle(ctx, p.title, rx, ry, rw, th);

    ctx.save();
    ctx.beginPath();
    ctx.rect(rx + 2, ry + (p.title ? 20 : 2), rw - 4, rh - (p.title ? 22 : 4));
    ctx.clip();

    // light grid + origin
    ctx.strokeStyle = th.colors.grid; ctx.lineWidth = 1;
    const v = p.view;
    for (let gx = Math.ceil(v.xmin); gx <= Math.floor(v.xmax); gx++) {
      const [x0, y0] = proj.to(gx, v.ymin), [x1, y1] = proj.to(gx, v.ymax);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    for (let gy = Math.ceil(v.ymin); gy <= Math.floor(v.ymax); gy++) {
      const [x0, y0] = proj.to(v.xmin, gy), [x1, y1] = proj.to(v.xmax, gy);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }

    for (const d of p.drawables || []) {
      const a = d.alpha == null ? 1 : d.alpha;
      if (a <= 0.001) continue;
      ctx.save(); ctx.globalAlpha = a;
      const col = colorOf(d.color, th);
      if (d.type === "points") {
        for (const pt of d.pts) { const [x, y] = proj.to(pt[0], pt[1]); dot(ctx, x, y, d.r || 2.8, col, d.shape); }
      } else if (d.type === "centroid") {
        const [x, y] = proj.to(d.at[0], d.at[1]);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
        ctx.strokeStyle = th.colors.bg; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (d.type === "axes") {
        const segs = [[d.len1, d.angle, 3], [d.len2, d.angle + Math.PI / 2, 2]];
        for (const [len, ang, w] of segs) {
          const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
          const [x0, y0] = proj.to(d.center[0] - dx, d.center[1] - dy);
          const [x1, y1] = proj.to(d.center[0] + dx, d.center[1] + dy);
          ctx.strokeStyle = col; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          if (w === 3) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x1, y1, 3.5, 0, 7); ctx.fill(); }
        }
      } else if (d.type === "ellipse") {
        ctx.strokeStyle = col; ctx.lineWidth = d.width || 2;
        if (d.dash) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        for (let k = 0; k <= 48; k++) {
          const t = (k / 48) * 2 * Math.PI;
          const ex = Math.cos(t) * d.rx, ey = Math.sin(t) * d.ry;
          const ca = Math.cos(d.angle), sa = Math.sin(d.angle);
          const wx = d.center[0] + ca * ex - sa * ey, wy = d.center[1] + sa * ex + ca * ey;
          const [px, py] = proj.to(wx, wy);
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke(); ctx.setLineDash([]);
      } else if (d.type === "arrow") {
        const [x0, y0] = proj.to(d.from[0], d.from[1]), [x1, y1] = proj.to(d.to[0], d.to[1]);
        arrow(ctx, x0, y0, x1, y1, col, d.width || 2);
      } else if (d.type === "edges") {
        for (const e of d.lines) {
          const [x0, y0] = proj.to(e.from[0], e.from[1]), [x1, y1] = proj.to(e.to[0], e.to[1]);
          ctx.strokeStyle = col; ctx.globalAlpha = a * Math.min(1, e.w);
          ctx.lineWidth = 0.5 + 3 * Math.min(1, e.w);
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        ctx.globalAlpha = a;
      } else if (d.type === "curve") {
        ctx.strokeStyle = col; ctx.lineWidth = d.width || 2;
        if (d.dash) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        d.pts.forEach((pt, i) => { const [x, y] = proj.to(pt[0], pt[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke(); ctx.setLineDash([]);
      } else if (d.type === "glider") {
        const [x, y] = proj.to(d.at[0], d.at[1]);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
        ctx.strokeStyle = th.colors.bg; ctx.lineWidth = 2; ctx.stroke();
      } else if (d.type === "label") {
        const [x, y] = proj.to(d.at[0], d.at[1]);
        ctx.fillStyle = col === th.colors.src ? col : (d.color ? col : th.colors.text);
        ctx.font = (d.size || 12) + "px " + th.font;
        ctx.textAlign = d.align || "center"; ctx.textBaseline = "middle";
        ctx.fillText(d.text, x, y);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function heatColor(t, ramp, th) {
    // t in [0,1] for seq; for div, t in [-1,1]
    if (ramp === "div") {
      const a = Math.min(1, Math.abs(t));
      const c = t >= 0 ? th.heat.pos : th.heat.neg;
      return `rgba(${c[0]},${c[1]},${c[2]},${0.12 + 0.85 * a})`;
    }
    const c = th.heat.seq;
    return `rgba(${c[0]},${c[1]},${c[2]},${0.08 + 0.9 * Math.min(1, Math.max(0, t))})`;
  }

  function drawMatrix(ctx, p, rx, ry, rw, rh, th) {
    panelTitle(ctx, p.title, rx, ry, rw, th);
    const M = p.matrix, n = M.length, m = M[0].length;
    let lo = Infinity, hi = -Infinity;
    for (const r of M) for (const v of r) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const pad = 24, top = ry + 22;
    const sz = Math.min((rw - 2 * pad) / m, (rh - pad - 26) / n);
    const ox = rx + (rw - sz * m) / 2, oy = top;
    const ramp = p.ramp || "seq";
    const absmax = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++) {
        const v = M[i][j];
        const t = ramp === "div" ? v / absmax : (v - lo) / (hi - lo + 1e-12);
        ctx.fillStyle = heatColor(t, ramp, th);
        ctx.fillRect(ox + j * sz, oy + i * sz, sz - 0.5, sz - 0.5);
      }
    ctx.strokeStyle = th.colors.border; ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, sz * m, sz * n);
    if (p.blocks) { // optional source/target block separators
      ctx.strokeStyle = th.colors.textMute; ctx.lineWidth = 1.5;
      for (const b of p.blocks) {
        ctx.beginPath(); ctx.moveTo(ox + b * sz, oy); ctx.lineTo(ox + b * sz, oy + sz * n); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox, oy + b * sz); ctx.lineTo(ox + sz * m, oy + b * sz); ctx.stroke();
      }
    }
  }

  function drawBars(ctx, p, rx, ry, rw, rh, th) {
    panelTitle(ctx, p.title, rx, ry, rw, th);
    const vals = p.values, n = vals.length;
    const pad = 26, top = ry + 24, bottom = ry + rh - 18;
    const w = (rw - 2 * pad) / n, ox = rx + pad;
    const mx = Math.max(...vals.map((v) => Math.abs(v))) || 1;
    const zeroY = bottom;
    for (let i = 0; i < n; i++) {
      const h = (Math.abs(vals[i]) / mx) * (bottom - top);
      const hot = p.highlight != null && i < p.highlight;
      ctx.fillStyle = hot ? th.colors.accent : th.colors.barMute;
      ctx.fillRect(ox + i * w + 1.5, zeroY - h, w - 3, h);
    }
    ctx.strokeStyle = th.colors.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ox, zeroY); ctx.lineTo(ox + n * w, zeroY); ctx.stroke();
  }

  R.scene = function (ctx, W, H, scene, th) {
    ctx.clearRect(0, 0, W, H);
    for (const p of scene.panels) {
      const [nx, ny, nw, nh] = p.rect;
      const rx = nx * W, ry = ny * H, rw = nw * W, rh = nh * H;
      if (p.frame) {
        ctx.fillStyle = th.colors.panel;
        ctx.strokeStyle = th.colors.border; ctx.lineWidth = 1;
        roundRect(ctx, rx + 4, ry + 4, rw - 8, rh - 8, 10); ctx.fill(); ctx.stroke();
      }
      if (p.kind === "plane") drawPlane(ctx, p, rx, ry, rw, rh, th);
      else if (p.kind === "matrix") drawMatrix(ctx, p, rx, ry, rw, rh, th);
      else if (p.kind === "bars") drawBars(ctx, p, rx, ry, rw, rh, th);
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  root.DAV = root.DAV || {};
  root.DAV.render = R;
})(typeof window !== "undefined" ? window : globalThis);
