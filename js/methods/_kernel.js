/*
 * _kernel.js — shared builder for the kernel re-embedding family (TCA, MIDA).
 *
 * These methods do NOT warp points in place: they re-express every point by its
 * kernel similarities, Z = K W. We render that honestly as a split screen —
 * the data plane on the left, the kernel matrix / eigenspectrum on the right —
 * and at the climax the points GLIDE from their raw coordinates to the learned
 * 2-D components (axes relabelled accordingly), with an explicit caption that
 * this happens in feature space, not the original plane.
 */
(function (root) {
  "use strict";
  const lin = root.DAV.lin, M = root.DAV.methods;

  function rescaleCols(Z, R) {
    const n = Z.length, k = Z[0].length, out = Z.map((r) => r.slice());
    for (let c = 0; c < k; c++) {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) { lo = Math.min(lo, Z[i][c]); hi = Math.max(hi, Z[i][c]); }
      for (let i = 0; i < n; i++) out[i][c] = ((Z[i][c] - lo) / (hi - lo + 1e-12)) * 2 * R - R;
    }
    return out;
  }
  const centroid = (idx, pos) => {
    const m = [0, 0]; idx.forEach((i) => { m[0] += pos[i][0]; m[1] += pos[i][1]; });
    return [m[0] / idx.length, m[1] / idx.length];
  };

  // cfg: { short, kernelCaption, solveCaption, embedCaption, doneCaption, rightTitle, Bcore(K,H,ctx) }
  M.kernelReembed = function (params, cfg) {
    const S = params.source, T = params.target, showM = params.showMatrices;
    const sl = params.srcLabel || S.map(() => 0), tl = params.tgtLabel || T.map(() => 0);
    const X = S.concat(T), ns = S.length, nt = T.length, n = ns + nt, mu = 0.1;
    const dom = X.map((_, i) => (i < ns ? 0 : 1));
    const lab = sl.concat(tl);

    const sigma = lin.sigmaMed(S, T);
    const K = lin.rbf(X, X, sigma);
    const H = lin.eye(n).map((r, i) => r.map((v, j) => v - 1 / n));
    const A = lin.matmul(lin.matmul(K, H), K);
    const Bc = cfg.Bcore(K, H, { ns, nt, n, dom });
    const B = Bc.map((r, i) => r.map((v, j) => v + (i === j ? mu : 0)));
    const Bm = lin.invSqrtmSym(B);
    const Sym = lin.matmul(lin.matmul(Bm, A), Bm);
    const eg = lin.eigSym(Sym);
    const U2 = eg.vectors.map((r) => [r[0], r[1]]);
    const Wmat = lin.matmul(Bm, U2);
    const Z = rescaleCols(lin.matmul(K, Wmat), 3.4);
    const spectrum = eg.values.slice(0, Math.min(10, n)).map((v) => Math.abs(v));

    const srcIdx = X.map((_, i) => i).filter((i) => i < ns);
    const tgtIdx = X.map((_, i) => i).filter((i) => i >= ns);
    const groups = [
      { id: "s0", color: "src", shape: "circle", idx: srcIdx.filter((i) => lab[i] === 0) },
      { id: "s1", color: "src", shape: "triangle", idx: srcIdx.filter((i) => lab[i] === 1) },
      { id: "t0", color: "tgt", shape: "circle", idx: tgtIdx.filter((i) => lab[i] === 0) },
      { id: "t1", color: "tgt", shape: "triangle", idx: tgtIdx.filter((i) => lab[i] === 1) },
    ];
    const view = { xmin: -5, xmax: 5, ymin: -5, ymax: 5 };

    function pointDraws(pos) { return groups.filter((g) => g.idx.length).map((g) => M.points(g.id, g.idx.map((i) => pos[i]), g.color, { shape: g.shape, r: 3 })); }
    function gapArrow(pos, alpha) {
      const cs = centroid(srcIdx, pos), ct = centroid(tgtIdx, pos);
      return M.arrow("gap", cs, ct, "accent", { width: 2, alpha });
    }
    function axisLabels(alpha) {
      return [
        M.label("axx", [0, -4.6], "learned component 1 →", { size: 12, alpha }),
        M.label("axy", [-4.6, 0, ], "↑ learned component 2", { size: 12, alpha, align: "left" }),
      ];
    }
    function scene(plane, caption, step, readout, right) {
      const panels = [{ kind: "plane", rect: showM ? [0, 0, 0.6, 1] : [0, 0, 1, 1], view, drawables: plane }];
      if (showM && right) panels.push(right);
      return { panels, caption, step, readout };
    }
    const sig = cfg.signature ? cfg.signature(K, { ns, nt, n, dom }) : { matrix: K, title: "kernel K (" + n + "×" + n + ")", blocks: [ns] };
    const Kpanel = { kind: "matrix", rect: [0.6, 0.06, 0.4, 0.6], frame: true, title: sig.title, matrix: sig.matrix, ramp: sig.ramp || "seq", blocks: sig.blocks };
    const specPanel = { kind: "bars", rect: [0.6, 0.06, 0.4, 0.6], frame: true, title: "eigenspectrum (keep top 2)", values: spectrum, highlight: 2 };

    // live MMD between domains (fixed bandwidth so the value is comparable across frames)
    const blockMean = (A) => A.flat().reduce((a, b) => a + b, 0) / (A.length * A[0].length);
    function mmd(P) {
      const s = P.slice(0, ns), t = P.slice(ns);
      const v = blockMean(lin.rbf(s, s, sigma)) + blockMean(lin.rbf(t, t, sigma)) - 2 * blockMean(lin.rbf(s, t, sigma));
      return Math.sqrt(Math.max(v, 0));
    }
    const mmdRaw = mmd(X);
    const metric = cfg.metricName || "MMD";

    const F = [];
    F.push(scene([...pointDraws(X), gapArrow(X, 0.9)], cfg.poolCaption, "1 / 5", metric + " = " + mmdRaw.toFixed(3)));
    F.push(scene([...pointDraws(X), gapArrow(X, 0.9)], cfg.kernelCaption, "2 / 5", "σ = " + sigma.toFixed(2), Kpanel));
    F.push(scene([...pointDraws(X), gapArrow(X, 0.9)], cfg.solveCaption, "3 / 5", metric + " = " + mmdRaw.toFixed(3), specPanel));
    M.tween(5).forEach((s) => {
      const pos = lin.lerpPts(X, Z, s);
      F.push(scene([...pointDraws(pos), gapArrow(pos, 0.9), ...axisLabels(s)], cfg.embedCaption, "4 / 5", metric + " ↓ " + mmd(pos).toFixed(3), specPanel));
    });
    F.push(scene([...pointDraws(Z), gapArrow(Z, 0.5), ...axisLabels(1)], cfg.doneCaption, "done", metric + " " + mmdRaw.toFixed(2) + " → " + mmd(Z).toFixed(2), specPanel));
    return F;
  };
})(typeof window !== "undefined" ? window : globalThis);
