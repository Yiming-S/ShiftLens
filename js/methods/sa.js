/* Subspace Alignment (SA) — rotate the source PCA frame onto the target's. */
(function (root) {
  "use strict";
  const lin = root.DAV.lin, M = root.DAV.methods;

  M.register({
    key: "sa", name: "Subspace Alignment", short: "SA", family: "affine",
    blurb: "Each domain is summarised by its PCA axes; SA learns W = Zsᵀ Zt that rotates the source frame onto the target frame.",
    facts: ["matches: subspace orientation", "does NOT match: scale or mean", "closed-form, single rotation"],
    steps: ["raw", "center", "PCA axes", "build W", "rotate", "aligned"],

    build(params) {
      const S0 = params.source, T0 = params.target, showM = params.showMatrices;
      const muS = lin.mean(S0), muT = lin.mean(T0);
      const Sc = lin.centerWith(S0, muS), Tc = lin.centerWith(T0, muT);
      const pa = lin.principalAxes2D(Sc), pb = lin.principalAxes2D(Tc);
      const dTheta = M.minimalAlign(pa.angle, pb.angle);
      const Zs = pa.vectors, Zt = pb.vectors;
      const W = lin.matmul(lin.transpose(Zs), Zt);
      const view = M.VIEWS.centered;
      const degs = Math.round(Math.abs(dTheta) * 180 / Math.PI);

      function scene(draw, caption, step, readout, mat) {
        const panels = [{ kind: "plane", rect: showM ? [0, 0, 0.7, 1] : [0, 0, 1, 1], view, drawables: draw }];
        if (showM && mat) panels.push({ kind: "matrix", rect: [0.7, 0.08, 0.3, 0.6], frame: true, title: mat.title, matrix: mat.m, ramp: "div" });
        return { panels, caption, step, readout };
      }
      const srcPts = (pts, alpha = 1) => M.points("src", pts, "src", { alpha });
      const tgtPts = M.points("tgt", Tc, "tgt");
      const tAxes = (a) => M.axes("taxes", [0, 0], pb.angle, pb.l1, pb.l2, "tgt", a);
      const sAxes = (ang, a) => M.axes("saxes", [0, 0], ang, pa.l1, pa.l2, "src", a);
      const frames = [];

      // 1 — raw
      frames.push(scene([
        M.points("src", S0, "src"), M.points("tgt", T0, "tgt"),
        M.centroid("sc", muS, "src"), M.centroid("tc", muT, "tgt"),
      ], "Two domains: different orientation and position", "1 / 5"));

      // 2 — centered
      frames.push(scene([
        srcPts(Sc), tgtPts,
        M.centroid("sc", [0, 0], "src", 0.6), M.centroid("tc", [0, 0], "tgt", 0.6),
      ], "Standardize each domain (here: centre at the origin)", "2 / 5"));

      // 3 — PCA axes
      frames.push(scene([srcPts(Sc), tgtPts, sAxes(pa.angle, 1), tAxes(1)],
        "Extract each domain's principal axes via PCA", "3 / 5"));

      // 4 — build W
      frames.push(scene([srcPts(Sc), tgtPts, sAxes(pa.angle, 1), tAxes(1)],
        "Measure the frame mismatch  →  build  W = Zsᵀ Zt", "4 / 5",
        "frame gap Δθ = " + degs + "°", { title: "W (2×2)", m: W }));

      // 5 — rotate source frame onto target frame
      M.tween(7).forEach((s) => {
        const a = dTheta * s;
        frames.push(scene([
          srcPts(lin.rotate2D(Sc, a)), tgtPts, sAxes(pa.angle + a, 1), tAxes(1),
        ], "Rotate the source frame onto the target frame (apply W)", "5 / 5",
          "rotated " + Math.round(Math.abs(a) * 180 / Math.PI) + "° of " + degs + "°",
          { title: "W (2×2)", m: W }));
      });

      // payoff
      frames.push(scene([
        srcPts(lin.rotate2D(Sc, dTheta)), tgtPts, sAxes(pa.angle + dTheta, 1), tAxes(1),
      ], "Aligned: source re-expressed in the target subspace (orientation matched)", "done",
        "axes parallel ✓", { title: "W (2×2)", m: W }));

      return frames;
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
