/* OT — entropic optimal transport (Sinkhorn) + barycentric mapping. */
(function (root) {
  "use strict";
  const lin = root.DAV.lin, M = root.DAV.methods;

  M.register({
    key: "ot", name: "Optimal Transport (Sinkhorn)", short: "OT", family: "transport",
    blurb: "Compute a soft coupling that says how much mass each source point sends to each target, then drag every source point to the weighted centre of the targets it feeds.",
    facts: ["matches: individual points, not just moments", "Sinkhorn iterations move no points (matrix only)", "transductive: no reusable transform"],
    steps: ["raw", "cost", "Sinkhorn", "map", "transport", "done"],
    controls: [{ key: "eps", label: "entropy ε", min: 0.1, max: 3, step: 0.1, value: 0.5 }],

    build(params) {
      const S = params.source, T = params.target, showM = params.showMatrices;
      const eps = (params.controls && params.controls.eps) || 0.5;
      const n = S.length, m = T.length;
      const C = lin.pairwiseSq(S, T);
      const a = new Array(n).fill(1 / n), b = new Array(m).fill(1 / m);
      const { P, history } = lin.sinkhorn(a, b, C, eps, 80);
      const Pmax = Math.max(...P.flat());
      const mapped = lin.barycentric(P, T);
      const view = M.VIEWS.ot;

      const edgesFrom = (Pm) => {
        const mx = Math.max(...Pm.flat()) || 1, lines = [];
        for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const w = Pm[i][j] / mx; if (w > 0.04) lines.push({ from: S[i], to: T[j], w }); }
        return lines;
      };
      function scene(draw, caption, step, readout, Pm) {
        const panels = [{ kind: "plane", rect: showM ? [0, 0, 0.66, 1] : [0, 0, 1, 1], view, drawables: draw }];
        if (showM && Pm) panels.push({ kind: "matrix", rect: [0.66, 0.08, 0.34, 0.78], frame: true, title: "coupling P", matrix: Pm, ramp: "seq" });
        return { panels, caption, step, readout };
      }
      const src = (pts) => M.points("src", pts, "src", { r: 4 });
      const tgt = M.points("tgt", T, "tgt", { r: 4 });
      const F = [];

      F.push(scene([src(S), tgt], "Two small clouds — source shifted away from target", "1 / 5"));

      // cost fan from one source point
      const c0 = C[0], cmin = Math.min(...c0), cmax = Math.max(...c0);
      const fan = c0.map((c, j) => ({ from: S[0], to: T[j], w: (cmax - c) / (cmax - cmin + 1e-9) }));
      F.push(scene([M.edges("e", fan, "edge", 0.8), src(S), tgt, M.centroid("h", S[0], "src")],
        "Cost: for one source point, a cheaper (closer) target = thicker line", "2 / 5"));

      // Sinkhorn snapshots — the plan sharpens & balances; points stay put
      [0, 2, 6, 18, 79].forEach((it, k) => {
        const h = history[Math.min(it, history.length - 1)];
        F.push(scene([M.edges("e", edgesFrom(h.P), "edge", 0.85), src(S), tgt],
          "Sinkhorn: rescale rows & columns so the coupling balances", "3 / 5",
          "residual = " + h.res.toExponential(1), h.P));
      });

      // barycentric arrows
      const arrows = S.map((p, i) => M.arrow("a" + i, p, mapped[i], "accent", { width: 1.6 }));
      F.push(scene([M.edges("e", edgesFrom(P), "edge", 0.3), ...arrows, src(S), tgt],
        "Barycentric map: each source point → weighted centre of its targets", "4 / 5", null, P));

      // move points along the arrows
      M.tween(6).forEach((s) => {
        const P2 = lin.lerpPts(S, mapped, s);
        F.push(scene([...S.map((p, i) => M.arrow("a" + i, p, mapped[i], "accent", { width: 1.4, alpha: 1 - s })), src(P2), tgt],
          "Transport the points along the plan", "5 / 5"));
      });
      F.push(scene([src(mapped), tgt],
        "Source mapped onto the target (diffuse plans land points between target blobs)", "done", "points matched"));
      return F;
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
