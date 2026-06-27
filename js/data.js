/*
 * data.js — deterministic 2-D toy-data generators.
 *
 * Each scenario is seeded so the picture is identical on every run. The affine
 * family (SA, CORAL, ART, PT) shares ONE source/target pair so methods can be
 * compared on identical clouds; other families get bespoke data that makes
 * their mechanism most visible (equal means for RD, two classes for the kernel
 * methods, a handful of points for OT).
 */
(function (root) {
  "use strict";

  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    let u = 0, v = 0;
    while (!u) u = r();
    while (!v) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // anisotropic Gaussian: major-axis angle, eigenvalues (l1>=l2), center, count
  function gaussCloud(seed, angle, l1, l2, cx, cy, n) {
    const r = rng(seed), c = Math.cos(angle), s = Math.sin(angle), out = [];
    for (let i = 0; i < n; i++) {
      const a = gauss(r) * Math.sqrt(l1), b = gauss(r) * Math.sqrt(l2);
      out.push([c * a - s * b + cx, s * a + c * b + cy]);
    }
    return out;
  }

  const D2R = Math.PI / 180;

  const data = {
    rng, gauss, gaussCloud,

    // shared pair for the affine-warp family (fits M.VIEWS.affine)
    affine() {
      return {
        source: gaussCloud(7, 35 * D2R, 2.3, 0.42, -2.5, 0.9, 64),
        target: gaussCloud(99, -27 * D2R, 1.9, 0.62, 2.5, -0.9, 64),
      };
    },

    // SA: modest offset (so the centering step is visible) tuned to the tighter
    // centered camera
    affineNear() {
      return {
        source: gaussCloud(7, 35 * D2R, 2.0, 0.42, -1.2, 0.6, 64),
        target: gaussCloud(99, -27 * D2R, 1.7, 0.55, 1.2, -0.6, 64),
      };
    },

    // rotation-only: equal means so a rigid rotation is the whole story;
    // different eigenvalues so RD's residual scale gap is visible
    rotationOnly() {
      return {
        source: gaussCloud(11, 42 * D2R, 3.0, 0.5, 0, 0, 64),
        target: gaussCloud(23, -24 * D2R, 2.0, 0.9, 0, 0, 64),
      };
    },

    // two-class data for kernel methods (domain = colour, class = shape)
    twoClass() {
      const nc = 16;
      const src = gaussCloud(3, 20 * D2R, 0.5, 0.5, -2.2, 1.6, nc)
        .concat(gaussCloud(5, 20 * D2R, 0.5, 0.5, -3.6, -1.4, nc));
      const tgt = gaussCloud(13, -30 * D2R, 0.55, 0.55, 2.6, -1.2, nc)
        .concat(gaussCloud(17, -30 * D2R, 0.55, 0.55, 3.6, 1.6, nc));
      const srcLabel = src.map((_, i) => (i < nc ? 0 : 1));
      const tgtLabel = tgt.map((_, i) => (i < nc ? 0 : 1));
      return { source: src, target: tgt, srcLabel, tgtLabel };
    },

    // small clouds so the Sinkhorn coupling edges stay legible
    smallOT() {
      return {
        source: gaussCloud(31, 15 * D2R, 1.2, 0.6, -2.6, 0.9, 11),
        target: gaussCloud(41, -20 * D2R, 1.2, 0.6, 1.6, -0.7, 11),
      };
    },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = data;
  root.DAV = root.DAV || {};
  root.DAV.data = data;
})(typeof window !== "undefined" ? window : globalThis);
