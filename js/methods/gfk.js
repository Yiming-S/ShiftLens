/* GFK — Geodesic Flow Kernel: integrate over the geodesic between two subspaces on the Grassmann manifold. */
(function (root) {
  "use strict";
  const lin = root.DAV.lin, M = root.DAV.methods;

  M.register({
    key: "gfk", name: "Geodesic Flow Kernel", short: "GFK", family: "manifold",
    blurb: "Each domain is a point (a subspace) on the Grassmann manifold; GFK averages over the whole geodesic of subspaces connecting them into one kernel/metric.",
    facts: ["a subspace is a POINT on the manifold — no point physically slides", "builds a metric G; it reweights, it does NOT move points", "shown with 1 principal angle; real EEG uses several"],
    steps: ["subspaces", "geodesic", "flow", "metric"],

    build(params) {
      const S0 = params.source, T0 = params.target;
      const muS = lin.mean(S0), muT = lin.mean(T0);
      const Sc = lin.centerWith(S0, muS), Tc = lin.centerWith(T0, muT);
      const pa = lin.principalAxes2D(Sc), pb = lin.principalAxes2D(Tc);
      const dAng = M.minimalAlign(pa.angle, pb.angle), theta = Math.abs(dAng);
      const weight = theta > 1e-6 ? (theta - Math.sin(theta)) / theta : 0;
      const view = M.viewFor([Sc, Tc], 1.2);
      const insetView = { xmin: -1.5, xmax: 1.5, ymin: -1.1, ymax: 1.3 };

      // geodesic arc (quadratic bezier) in the schematic inset
      const A = [-1, -0.5], Bp = [1, -0.5], Cc = [0, 1.05];
      const arcPt = (u) => [(1 - u) * (1 - u) * A[0] + 2 * (1 - u) * u * Cc[0] + u * u * Bp[0],
      (1 - u) * (1 - u) * A[1] + 2 * (1 - u) * u * Cc[1] + u * u * Bp[1]];
      const arc = M.tween(24).map(arcPt);

      function dirLine(id, ang, color, alpha) {
        const L = 1.7 * Math.sqrt(Math.max(pa.l1, pb.l1));
        return M.curve(id, [[-L * Math.cos(ang), -L * Math.sin(ang)], [L * Math.cos(ang), L * Math.sin(ang)]], color, { width: 2, alpha });
      }
      function fan(u) {
        return M.tween(6).map((q, k) => dirLine("fan" + k, pa.angle + dAng * q, "edge", q <= u + 1e-6 ? 0.3 : 0));
      }
      function plane(extra) {
        return [M.points("src", Sc, "src"), M.points("tgt", Tc, "tgt"),
        dirLine("sdir", pa.angle, "src", 1), dirLine("tdir", pb.angle, "tgt", 1), ...extra];
      }
      function inset(u, glAlpha) {
        return {
          kind: "plane", rect: [0.62, 0.08, 0.38, 0.8], frame: true, view: insetView, title: "Grassmann manifold (schematic)",
          drawables: [
            M.curve("arc", arc, "edge", { width: 2, dash: true }),
            M.centroid("eA", A, "src"), M.centroid("eB", Bp, "tgt"),
            M.label("lA", [A[0], A[1] - 0.32], "source subspace", { size: 11 }),
            M.label("lB", [Bp[0], Bp[1] - 0.32], "target subspace", { size: 11 }),
            M.glider("gl", arcPt(u), "accent", glAlpha),
          ],
        };
      }
      function scene(planeDraw, caption, step, readout, inset_) {
        const panels = [{ kind: "plane", rect: inset_ ? [0, 0, 0.62, 1] : [0, 0, 1, 1], view, drawables: planeDraw }];
        if (inset_) panels.push(inset_);
        return { panels, caption, step, readout };
      }
      const F = [];
      F.push(scene(plane([]), "Each domain has a PCA subspace (its principal direction)", "1 / 4"));
      F.push(scene(plane([]), "Treat each subspace as a point on the Grassmann manifold; connect by a geodesic", "2 / 4",
        "principal angle θ = " + Math.round(theta * 180 / Math.PI) + "°", inset(0, 1)));
      M.tween(7).forEach((u) => {
        F.push(scene(plane(fan(u)), "Integrate over the geodesic flow of subspaces (source → target)", "3 / 4",
          "flow weight (θ−sinθ)/θ = " + weight.toFixed(2), inset(u, 1)));
      });
      F.push(scene(plane([...fan(1), M.ellipse("G", [0, 0], (pa.angle + pb.angle) / 2, pa.l1, pb.l2, "accent", 1, 1.7, 2.5)]),
        "Assemble the flow kernel G — both domains are compared in this shared metric (no points move)", "done",
        "metric G built", inset(1, 1)));
      return F;
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
