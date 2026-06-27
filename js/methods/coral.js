/* CORAL — whiten the source cloud to a unit circle, then recolor to the target covariance. */
(function (root) {
  "use strict";
  const lin = root.DAV.lin, M = root.DAV.methods;
  const I2 = [[1, 0], [0, 1]];
  const mix = (A, B, s) => A.map((r, i) => r.map((v, j) => v * (1 - s) + B[i][j] * s));
  const addMu = (P, mu) => P.map((p) => [p[0] + mu[0], p[1] + mu[1]]);

  M.register({
    key: "coral", name: "Correlation Alignment", short: "CORAL", family: "affine",
    blurb: "Match second-order statistics: whiten the source covariance to a unit sphere, then recolor it into the target covariance.",
    facts: ["matches: covariance (shape)", "does NOT match: the mean", "closed-form whiten → recolor"],
    steps: ["raw", "shape gap", "whiten", "recolor", "done"],

    build(params) {
      const S0 = params.source, T0 = params.target, showM = params.showMatrices;
      const muS = lin.mean(S0), muT = lin.mean(T0);
      const Sc = lin.centerWith(S0, muS);
      const Cs = lin.cov(S0), Ct = lin.cov(T0);
      const Wwhite = lin.invSqrtmSym(Cs), Color = lin.sqrtmSym(Ct);
      const A = lin.matmul(Color, Wwhite);
      const whitened = lin.applyMap(Sc, Wwhite);
      const view = M.VIEWS.affine;

      function scene(draw, caption, step, readout, mat) {
        const panels = [{ kind: "plane", rect: showM ? [0, 0, 0.7, 1] : [0, 0, 1, 1], view, drawables: draw }];
        if (showM && mat) panels.push({ kind: "matrix", rect: [0.7, 0.08, 0.3, 0.6], frame: true, title: mat.title, matrix: mat.m, ramp: "div" });
        return { panels, caption, step, readout };
      }
      const tgt = M.points("tgt", T0, "tgt");
      const tEll = M.ellipseOf("tell", T0, "tgt", 1);
      const frames = [];

      frames.push(scene([M.points("src", S0, "src"), tgt, M.centroid("sc", muS, "src"), M.centroid("tc", muT, "tgt")],
        "Two domains: different covariance shape and mean", "1 / 5"));

      frames.push(scene([M.points("src", S0, "src"), tgt, M.ellipseOf("sell", S0, "src", 1), tEll],
        "Read each domain's covariance ellipse — the shape gap", "2 / 5", null, { title: "A = Σt½ Σs−½", m: A }));

      // whiten: source ellipse -> unit circle
      M.tween(6).forEach((s) => {
        const Mt = mix(I2, Wwhite, s);
        const P = addMu(lin.applyMap(Sc, Mt), muS);
        frames.push(scene([M.points("src", P, "src"), tgt, M.ellipseOf("sell", P, "src", 1), tEll],
          "Whiten: sphere the source covariance to a unit circle", "3 / 5", "Σs⁻¹ᐟ²", { title: "A = Σt½ Σs−½", m: A }));
      });

      // recolor: unit circle -> target covariance
      M.tween(6).forEach((s) => {
        const Mt = mix(I2, Color, s);
        const P = addMu(lin.applyMap(whitened, Mt), muS);
        frames.push(scene([M.points("src", P, "src"), tgt, M.ellipseOf("sell", P, "src", 1), tEll],
          "Recolor: stretch the sphere into the target covariance", "4 / 5", "Σt¹ᐟ²", { title: "A = Σt½ Σs−½", m: A }));
      });

      const Pf = addMu(lin.applyMap(Sc, A), muS);
      frames.push(scene([
        M.points("src", Pf, "src"), tgt, M.ellipseOf("sell", Pf, "src", 1), tEll,
        M.arrow("mg", muS, muT, "#9aa", { width: 1.5 }), M.label("mgl", [(muS[0] + muT[0]) / 2, (muS[1] + muT[1]) / 2 + 0.6], "mean gap (CORAL leaves this)", { size: 11 }),
      ], "Covariance matched — but the mean is NOT corrected by CORAL", "done", "Σ matched", { title: "A = Σt½ Σs−½", m: A }));

      return frames;
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
