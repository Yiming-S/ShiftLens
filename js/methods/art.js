/* ART — Aligned Riemannian Transport: whiten + recolor + translate to the target mean. */
(function (root) {
  "use strict";
  const lin = root.DAV.lin, M = root.DAV.methods;
  const I2 = [[1, 0], [0, 1]];
  const mix = (A, B, s) => A.map((r, i) => r.map((v, j) => v * (1 - s) + B[i][j] * s));
  const shift = (P, off) => P.map((p) => [p[0] + off[0], p[1] + off[1]]);

  M.register({
    key: "art", name: "Aligned Riemannian Transport", short: "ART", family: "affine",
    blurb: "Slide the source covariance toward the target's along the SPD manifold, then translate to the target mean — here a whiten → recolor → shift.",
    facts: ["matches: covariance AND mean", "one covariance per domain ⇒ SPD geodesic endpoint = Σt", "≈ CORAL plus a mean shift"],
    steps: ["raw", "shape gap", "whiten", "recolor", "translate", "done"],

    build(params) {
      const S0 = params.source, T0 = params.target, showM = params.showMatrices;
      const muS = lin.mean(S0), muT = lin.mean(T0);
      const Sc = lin.centerWith(S0, muS);
      const Cs = lin.cov(S0), Ct = lin.cov(T0);
      const Wwhite = lin.invSqrtmSym(Cs), Color = lin.sqrtmSym(Ct), A = lin.matmul(Color, Wwhite);
      const whitened = lin.applyMap(Sc, Wwhite), recolored = lin.applyMap(Sc, A);
      const view = M.VIEWS.affine;

      function scene(draw, caption, step, readout) {
        const panels = [{ kind: "plane", rect: showM ? [0, 0, 0.72, 1] : [0, 0, 1, 1], view, drawables: draw }];
        if (showM) panels.push({ kind: "matrix", rect: [0.72, 0.1, 0.28, 0.5], frame: true, title: "Σt½ Σs−½", matrix: A, ramp: "div" });
        return { panels, caption, step, readout };
      }
      const tgt = M.points("tgt", T0, "tgt"), tEll = M.ellipseOf("te", T0, "tgt", 1);
      const ghost = M.ellipseOf("ghost", S0, "src", 0.22, 1.6, 1.5);
      const circ = (a) => ({ type: "ellipse", id: "circ", center: muS, angle: 0, rx: 1.6, ry: 1.6, color: "accent", width: 1.5, alpha: a, dash: true });
      const F = [];
      F.push(scene([M.points("src", S0, "src"), tgt, M.centroid("sc", muS, "src"), M.centroid("tc", muT, "tgt")],
        "Two domains: different covariance and mean", "1 / 5"));
      F.push(scene([M.points("src", S0, "src"), tgt, M.ellipseOf("se", S0, "src", 1), tEll],
        "Read the covariance ellipses (the SPD endpoints)", "2 / 5"));
      M.tween(6).forEach((s) => { const P = shift(lin.applyMap(Sc, mix(I2, Wwhite, s)), muS); F.push(scene([ghost, circ(0.3 + 0.5 * s), M.points("src", P, "src"), tgt, M.ellipseOf("se", P, "src", 1), tEll, M.label("clab", [muS[0], muS[1] + 2.2], "step 1: whiten → unit circle", { size: 11, alpha: s })], "Step 1 — whiten the source covariance to a unit circle", "3 / 5")); });
      M.tween(6).forEach((s) => { const P = shift(lin.applyMap(whitened, mix(I2, Color, s)), muS); F.push(scene([ghost, circ(0.8 * (1 - s)), M.points("src", P, "src"), tgt, M.ellipseOf("se", P, "src", 1), tEll, M.label("clab", [muS[0], muS[1] + 2.2], "step 2: recolor → target shape", { size: 11, alpha: 1 - s })], "Step 2 — recolor the circle into the target covariance", "4 / 5")); });
      M.tween(5).forEach((s) => { const off = [lin.lerp(muS[0], muT[0], s), lin.lerp(muS[1], muT[1], s)]; const P = shift(recolored, off); F.push(scene([M.points("src", P, "src"), tgt, M.ellipseOf("se", P, "src", 1), tEll], "Translate onto the target mean", "5 / 5")); });
      const Pf = shift(recolored, muT);
      F.push(scene([M.points("src", Pf, "src"), tgt, M.ellipseOf("se", Pf, "src", 1), tEll], "Covariance and mean matched (single-covariance SPD transport reduces to this)", "done", "Σ + mean matched"));
      return F;
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
