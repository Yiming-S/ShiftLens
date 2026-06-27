/* MIDA — Maximum Independence Domain Adaptation: kernel components independent of the domain label (HSIC). */
(function (root) {
  "use strict";
  const lin = root.DAV.lin, M = root.DAV.methods;

  M.register({
    key: "mida", name: "Maximum Independence DA", short: "MIDA", family: "kernel",
    blurb: "Learn a kernel-space projection of the pooled points whose coordinates are statistically independent (HSIC) of the domain label, while keeping variance.",
    facts: ["lives in kernel feature space, not the plane", "minimises domain dependence (HSIC), not a distance", "axes are learned components"],
    steps: ["pool", "kernel K", "solve", "re-embed", "done"],

    build(params) {
      return M.kernelReembed(params, {
        metricName: "domain gap",
        poolCaption: "Pool source + target (colour = domain, shape = class)",
        kernelCaption: "Build the domain kernel Kd — which points share a domain (the dependence to remove)",
        signature(K, ctx) {
          const { n, dom } = ctx;
          const Kd = root.DAV.lin.zeros(n, n);
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Kd[i][j] = dom[i] === dom[j] ? 1 : 0;
          return { matrix: Kd, title: "domain kernel Kd", blocks: [ctx.ns] };
        },
        solveCaption: "Solve max variance s.t. min domain dependence (HSIC with domain kernel Kd)",
        embedCaption: "Re-embed: each point glides to Z = Kx·W in kernel feature space",
        doneCaption: "Coordinates made independent of the domain label → domains overlap",
        Bcore(K, H, ctx) {
          const { n, dom } = ctx;
          // domain (linear) kernel Kd = D Dᵀ on one-hot domain labels
          const Kd = lin.zeros(n, n);
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Kd[i][j] = dom[i] === dom[j] ? 1 : 0;
          const KH = lin.matmul(K, H);
          return lin.matmul(lin.matmul(KH, Kd), lin.matmul(H, K)); // Kx H Kd H Kx
        },
      });
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
