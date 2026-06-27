/* PT — covariance "parallel transport": one congruence map E with E Σs E = Σt, then translate. */
(function (root) {
  "use strict";
  const lin = root.DAV.lin, M = root.DAV.methods;
  const I2 = [[1, 0], [0, 1]];
  const mix = (A, B, s) => A.map((r, i) => r.map((v, j) => v * (1 - s) + B[i][j] * s));
  const shift = (P, off) => P.map((p) => [p[0] + off[0], p[1] + off[1]]);

  M.register({
    key: "pt", name: "Parallel Transport (SPD)", short: "PT", family: "affine",
    blurb: "A single covariance-transport map E (with E Σs E = Σt) reshapes the source ellipse into the target's in one step, then shifts it onto the target mean.",
    facts: ["matches: covariance AND mean", "whole-domain transport (per-trial geodesics in spd.py not used here)", "one stretch+rotate, not whiten-then-recolor"],
    steps: ["raw", "shape gap", "transport", "translate", "done"],

    build(params) {
      const S0 = params.source, T0 = params.target, showM = params.showMatrices;
      const muS = lin.mean(S0), muT = lin.mean(T0);
      const Sc = lin.centerWith(S0, muS);
      const Cs = lin.cov(S0), Ct = lin.cov(T0);
      // symmetric SPD transport: E = Σs^-½ (Σs^½ Σt Σs^½)^½ Σs^-½  (E Σs E = Σt)
      const CsH = lin.sqrtmSym(Cs), CsHi = lin.invSqrtmSym(Cs);
      const inner = lin.sqrtmSym(lin.matmul(lin.matmul(CsH, Ct), CsH));
      const E = lin.matmul(lin.matmul(CsHi, inner), CsHi);
      const transported = lin.applyMap(Sc, E);
      const view = M.VIEWS.affine;

      function scene(draw, caption, step, readout) {
        const panels = [{ kind: "plane", rect: showM ? [0, 0, 0.72, 1] : [0, 0, 1, 1], view, drawables: draw }];
        if (showM) panels.push({ kind: "matrix", rect: [0.72, 0.1, 0.28, 0.5], frame: true, title: "E (transport)", matrix: E, ramp: "div" });
        return { panels, caption, step, readout };
      }
      const pbT = lin.principalAxes2D(lin.centerWith(T0, muT));
      const tgt = M.points("tgt", T0, "tgt"), tEll = M.ellipseOf("te", T0, "tgt", 1);
      const ghost = M.ellipseOf("ghost", S0, "src", 0.22, 1.6, 1.5);
      const goal = { type: "ellipse", id: "goal", center: muS, angle: pbT.angle, rx: 1.6 * Math.sqrt(pbT.l1), ry: 1.6 * Math.sqrt(pbT.l2), color: "tgt", width: 1.5, alpha: 0.3, dash: true };
      const F = [];
      F.push(scene([M.points("src", S0, "src"), tgt, M.centroid("sc", muS, "src"), M.centroid("tc", muT, "tgt")],
        "Two domains: different covariance and mean", "1 / 4"));
      F.push(scene([M.points("src", S0, "src"), tgt, M.ellipseOf("se", S0, "src", 1), tEll],
        "Read the covariance ellipses", "2 / 4"));
      M.tween(8).forEach((s) => { const P = shift(lin.applyMap(Sc, mix(I2, E, s)), muS); F.push(scene([ghost, goal, M.points("src", P, "src"), tgt, M.ellipseOf("se", P, "src", 1), tEll, M.label("lab", [muS[0], muS[1] + 2.2], "one operator E — never a circle", { size: 11, alpha: s })], "Transport: ONE congruence map reshapes Σs → Σt directly (no whitening step)", "3 / 4")); });
      M.tween(5).forEach((s) => { const off = [lin.lerp(muS[0], muT[0], s), lin.lerp(muS[1], muT[1], s)]; const P = shift(transported, off); F.push(scene([M.points("src", P, "src"), tgt, M.ellipseOf("se", P, "src", 1), tEll], "Translate onto the target mean", "4 / 4")); });
      const Pf = shift(transported, muT);
      F.push(scene([M.points("src", Pf, "src"), tgt, M.ellipseOf("se", Pf, "src", 1), tEll], "Covariance and mean matched via a single transport operator", "done", "Σ + mean matched"));
      return F;
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
