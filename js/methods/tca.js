/* TCA — Transfer Component Analysis: kernel components that minimise MMD while keeping variance. */
(function (root) {
  "use strict";
  const lin = root.DAV.lin, M = root.DAV.methods;

  M.register({
    key: "tca", name: "Transfer Component Analysis", short: "TCA", family: "kernel",
    blurb: "Learn components in RBF kernel space onto which both domains project so their means coincide (MMD ↓) while overall variance is preserved.",
    facts: ["lives in kernel feature space, not the plane", "axes are learned components, not features", "gap reduced approximately, not exactly"],
    steps: ["pool", "kernel K", "solve", "re-embed", "done"],

    build(params) {
      return M.kernelReembed(params, {
        poolCaption: "Pool source + target (colour = domain, shape = class)",
        kernelCaption: "Build the RBF kernel K — similarity of every pair of points",
        solveCaption: "Solve max variance (KHK) s.t. min MMD (KLK) → keep top-2 transfer components",
        embedCaption: "Re-embed: each point glides to Z = K·W in kernel feature space",
        doneCaption: "Domains overlap on the learned components (MMD reduced)",
        Bcore(K, H, ctx) {
          const { ns, nt, n, dom } = ctx;
          const L = lin.zeros(n, n);
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            if (dom[i] === 0 && dom[j] === 0) L[i][j] = 1 / (ns * ns);
            else if (dom[i] === 1 && dom[j] === 1) L[i][j] = 1 / (nt * nt);
            else L[i][j] = -1 / (ns * nt);
          }
          return lin.matmul(lin.matmul(K, L), K);
        },
      });
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
