/* M3D — Manifold-based Multi-step DA: a pipeline (bulk align → rotate → per-class pull). */
(function (root) {
  "use strict";
  const lin = root.DAV.lin, M = root.DAV.methods, D = root.DAV.data;
  const shift = (P, off) => P.map((p) => [p[0] + off[0], p[1] + off[1]]);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];

  M.register({
    key: "m3d", name: "Multi-step DA (M3D)", short: "M3D", family: "multi-step",
    blurb: "A pipeline: reduce the overall (marginal) gap, rotate the source frame onto the target's, then iteratively pull each class to its match (conditional alignment).",
    facts: ["real M3D runs in kernel feature space; this is the geometric intent", "uses source labels + target pseudo-labels", "marginal then conditional (per-class) alignment"],
    steps: ["raw", "marginal", "rotate", "per-class", "done"],

    build(params) {
      const G = D.gaussCloud, d2r = Math.PI / 180, nc = 15;
      // own data: target sits near the origin so the aligned payoff is centred
      const S0 = G(3, 22 * d2r, 0.5, 0.5, -4.0, 1.8, nc).concat(G(5, 22 * d2r, 0.5, 0.5, -2.4, -1.8, nc));
      const T0 = G(13, -28 * d2r, 0.55, 0.55, -0.6, 1.6, nc).concat(G(17, -28 * d2r, 0.55, 0.55, 1.2, -1.6, nc));
      const sl = S0.map((_, i) => (i < nc ? 0 : 1)), tl = T0.map((_, i) => (i < nc ? 0 : 1));
      const muS = lin.mean(S0), muT = lin.mean(T0);
      const view = M.VIEWS.m3d;
      const tgtC = [lin.mean(T0.filter((_, i) => tl[i] === 0)), lin.mean(T0.filter((_, i) => tl[i] === 1))];

      function groups(pos, dom, lab) {
        const idx = pos.map((_, i) => i);
        return [
          { id: dom + "0", color: dom === "s" ? "src" : "tgt", shape: "circle", pts: idx.filter((i) => lab[i] === 0).map((i) => pos[i]) },
          { id: dom + "1", color: dom === "s" ? "src" : "tgt", shape: "triangle", pts: idx.filter((i) => lab[i] === 1).map((i) => pos[i]) },
        ];
      }
      const tgtDraws = groups(T0, "t", tl).map((g) => M.points(g.id, g.pts, g.color, { shape: g.shape, r: 3 }));
      const srcDraws = (pos) => groups(pos, "s", sl).map((g) => M.points(g.id, g.pts, g.color, { shape: g.shape, r: 3 }));
      function scene(srcPos, caption, step, readout, extra = []) {
        return { panels: [{ kind: "plane", rect: [0, 0, 1, 1], view, drawables: [...srcDraws(srcPos), ...tgtDraws, ...extra] }], caption, step, readout };
      }
      const F = [];

      F.push(scene(S0, "Two domains, two classes (colour = domain, shape = class)", "1 / 5",
        null, [M.arrow("gap", muS, muT, "accent", { width: 2 })]));

      M.tween(5).forEach((s) => {
        const off = [lin.lerp(0, muT[0] - muS[0], s), lin.lerp(0, muT[1] - muS[1], s)];
        F.push(scene(shift(S0, off), "Stage 1 — reduce the marginal gap (align overall means)", "2 / 5"));
      });
      const afterMarg = shift(S0, sub(muT, muS));

      const Sc = lin.centerWith(afterMarg, muT);
      const pa = lin.principalAxes2D(Sc), pb = lin.principalAxes2D(lin.centerWith(T0, muT));
      const dTheta = M.minimalAlign(pa.angle, pb.angle);
      let afterRot = afterMarg;
      M.tween(6).forEach((s) => {
        afterRot = shift(lin.rotate2D(Sc, dTheta * s), muT);
        F.push(scene(afterRot, "Stage 2 — rotate the source frame onto the target frame (SA step)", "3 / 5",
          "rotated " + Math.round(Math.abs(dTheta * s) * 180 / Math.PI) + "°"));
      });

      let p = afterRot;
      for (let it = 0; it < 4; it++) {
        const next = p.map((pt, i) => { const c = tgtC[sl[i]]; return [lin.lerp(pt[0], c[0], 0.35), lin.lerp(pt[1], c[1], 0.35)]; });
        F.push(scene(next, "Stage 3 — iteratively pull each class to its match (conditional alignment)", "4 / 5", "iter " + (it + 1) + "/4"));
        p = next;
      }
      F.push(scene(p, "Marginal and per-class structure aligned (real M3D does this in kernel space)", "done", "aligned"));
      return F;
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
