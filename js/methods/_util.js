/*
 * _util.js — shared helpers + registry for method modules.
 *
 * A method registers a descriptor and a `build(params)` that returns an array
 * of keyframes (scenes). params = { source, target, srcLabel?, tgtLabel?,
 * showMatrices, controls{...} }.
 */
(function (root) {
  "use strict";
  const lin = root.DAV.lin;
  const M = { _reg: [], _map: {} };

  M.register = (desc) => { M._reg.push(desc); M._map[desc.key] = desc; };
  M.all = () => M._reg;
  M.get = (k) => M._map[k];

  // shared fixed cameras (aspect ~1.78 to fill the canvas; no letterboxing)
  M.VIEWS = {
    affine: { xmin: -6.05, xmax: 6.05, ymin: -3.4, ymax: 3.4 },
    centered: { xmin: -4.7, xmax: 4.7, ymin: -2.64, ymax: 2.64 },
    ot: { xmin: -4.6, xmax: 4.6, ymin: -2.58, ymax: 2.58 },
    m3d: { xmin: -5.3, xmax: 5.3, ymin: -2.98, ymax: 2.98 },
  };

  // bounding-box view over any number of clouds, with margin
  M.viewFor = (clouds, margin = 1) => {
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const c of clouds) for (const [x, y] of c) {
      xmin = Math.min(xmin, x); xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
    }
    return { xmin: xmin - margin, xmax: xmax + margin, ymin: ymin - margin, ymax: ymax + margin };
  };

  // drawable builders ------------------------------------------------------
  M.points = (id, pts, color, opts = {}) => ({ type: "points", id, pts, color, r: opts.r || 2.8, shape: opts.shape || "circle", alpha: opts.alpha == null ? 1 : opts.alpha });
  M.centroid = (id, at, color, alpha = 1) => ({ type: "centroid", id, at, color, alpha });
  M.arrow = (id, from, to, color, opts = {}) => ({ type: "arrow", id, from, to, color, width: opts.width || 2, alpha: opts.alpha == null ? 1 : opts.alpha });
  M.label = (id, at, text, opts = {}) => ({ type: "label", id, at, text, color: opts.color, size: opts.size || 12, align: opts.align, alpha: opts.alpha == null ? 1 : opts.alpha });
  M.curve = (id, pts, color, opts = {}) => ({ type: "curve", id, pts, color, width: opts.width || 2, dash: opts.dash, alpha: opts.alpha == null ? 1 : opts.alpha });
  M.glider = (id, at, color, alpha = 1) => ({ type: "glider", id, at, color, alpha });
  M.edges = (id, lines, color, alpha = 1) => ({ type: "edges", id, lines, color, alpha });

  // principal-axis cross from a cloud (or explicit angle/eigenvalues)
  M.axesOf = (id, cloud, color, alpha = 1, scale = 1.7) => {
    const { angle, l1, l2 } = lin.principalAxes2D(cloud);
    const center = lin.mean(cloud);
    return { type: "axes", id, center, angle, len1: scale * Math.sqrt(Math.max(l1, 1e-3)), len2: scale * Math.sqrt(Math.max(l2, 1e-3)), color, alpha };
  };
  M.axes = (id, center, angle, l1, l2, color, alpha = 1, scale = 1.7) => ({ type: "axes", id, center, angle, len1: scale * Math.sqrt(Math.max(l1, 1e-3)), len2: scale * Math.sqrt(Math.max(l2, 1e-3)), color, alpha });

  // covariance ellipse (k-sigma) from a cloud
  M.ellipseOf = (id, cloud, color, alpha = 1, k = 1.6, width = 2) => {
    const { angle, l1, l2 } = lin.principalAxes2D(cloud);
    return { type: "ellipse", id, center: lin.mean(cloud), angle, rx: k * Math.sqrt(Math.max(l1, 1e-4)), ry: k * Math.sqrt(Math.max(l2, 1e-4)), color, width, alpha };
  };
  M.ellipse = (id, center, angle, l1, l2, color, alpha = 1, k = 1.6, width = 2) => ({ type: "ellipse", id, center, angle, rx: k * Math.sqrt(Math.max(l1, 1e-4)), ry: k * Math.sqrt(Math.max(l2, 1e-4)), color, width, alpha });

  // minimal rotation aligning line-direction a1 onto a2, in (-pi/2, pi/2]
  M.minimalAlign = (a1, a2) => {
    let d = a2 - a1;
    while (d > Math.PI / 2) d -= Math.PI;
    while (d <= -Math.PI / 2) d += Math.PI;
    return d;
  };

  // make a phase of n dense sub-frames; fn(s) with s in [0,1] returns drawables
  M.tween = (n) => Array.from({ length: n }, (_, i) => i / (n - 1));

  if (typeof module !== "undefined" && module.exports) module.exports = M;
  root.DAV.methods = M;
})(typeof window !== "undefined" ? window : globalThis);
