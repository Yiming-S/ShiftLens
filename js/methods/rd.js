/* RD — rigid rotation of the source covariance eigenframe onto the target's. */
(function (root) {
  "use strict";
  const lin = root.DAV.lin, M = root.DAV.methods;

  M.register({
    key: "rd", name: "Riemannian-distance alignment", short: "RD", family: "affine",
    blurb: "Rotate the whole source cloud rigidly so its covariance eigenframe matches the target's; the residual eigenvalue gap is summed into one affine-invariant Riemannian distance.",
    facts: ["matches: covariance orientation", "does NOT match: scale (eigenvalues)", "rigid rotation; distance is a diagnostic"],
    steps: ["raw", "eigenframes", "rotate", "done"],

    build(params) {
      const S0 = params.source, T0 = params.target, showM = params.showMatrices;
      const Sc = lin.centerWith(S0, lin.mean(S0)), Tc = lin.centerWith(T0, lin.mean(T0));
      const pa = lin.principalAxes2D(Sc), pb = lin.principalAxes2D(Tc);
      const dTheta = M.minimalAlign(pa.angle, pb.angle);
      // affine-invariant Riemannian distance d = sqrt( Σ log(eig(Σs⁻¹Σt))² )
      const Wi = lin.invSqrtmSym(lin.cov(S0));
      const ev = lin.eigSym(lin.matmul(lin.matmul(Wi, lin.cov(T0)), Wi)).values;
      const logs = ev.map((v) => Math.log(Math.max(v, 1e-9)));
      const dRiem = Math.sqrt(logs.reduce((s, v) => s + v * v, 0));
      const view = M.VIEWS.centered;

      function scene(draw, caption, step, readout) {
        const panels = [{ kind: "plane", rect: showM ? [0, 0, 0.72, 1] : [0, 0, 1, 1], view, drawables: draw }];
        if (showM) panels.push({ kind: "bars", rect: [0.72, 0.12, 0.28, 0.62], frame: true, title: "|log λ(Σs⁻¹Σt)|", values: logs.map(Math.abs) });
        return { panels, caption, step, readout };
      }
      const tgt = M.points("tgt", Tc, "tgt");
      const tEll = M.ellipse("te", [0, 0], pb.angle, pb.l1, pb.l2, "tgt", 1);
      const tAx = M.axes("ta", [0, 0], pb.angle, pb.l1, pb.l2, "tgt", 0.9);
      const sEll = (a) => M.ellipse("se", [0, 0], pa.angle + a, pa.l1, pa.l2, "src", 1);
      const sAx = (a) => M.axes("sa", [0, 0], pa.angle + a, pa.l1, pa.l2, "src", 0.9);
      const dTxt = "Riemannian dist = " + dRiem.toFixed(2);
      const F = [];

      F.push(scene([M.points("src", Sc, "src"), tgt],
        "Two domains, same mean but rotated (and rescaled) covariance", "1 / 4", dTxt));
      F.push(scene([M.points("src", Sc, "src"), tgt, sEll(0), sAx(0), tEll, tAx],
        "Read each covariance ellipse and its eigenframe", "2 / 4", dTxt));
      M.tween(7).forEach((u) => {
        const a = dTheta * u;
        F.push(scene([M.points("src", lin.rotate2D(Sc, a), "src"), tgt, sEll(a), sAx(a), tEll, tAx],
          "Rotate the source cloud onto the target eigenframe", "3 / 4",
          "rotated " + Math.round(Math.abs(a) * 180 / Math.PI) + "°"));
      });
      F.push(scene([M.points("src", lin.rotate2D(Sc, dTheta), "src"), tgt, sEll(dTheta), sAx(dTheta), tEll, tAx],
        "Orientation aligned — the ellipses' size gap is exactly what the Riemannian distance measures", "done", dTxt));
      return F;
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
