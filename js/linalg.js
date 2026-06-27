/*
 * linalg.js — small, dependency-free linear-algebra helpers.
 *
 * Everything operates on plain JS arrays:
 *   - a vector is number[]
 *   - a matrix is number[][] (array of rows)
 *   - a point cloud is number[][] (array of 2-D points), same layout as a matrix
 *
 * The routines implement the core math behind the visualized domain-adaptation
 * methods (PCA/SVD, covariance whitening, RBF kernels, symmetric
 * eigendecomposition, Sinkhorn OT) so the animations stay faithful to the real
 * algorithms — only here they run in the browser on 2-D toy data.
 */
(function (root) {
  "use strict";

  const L = {};

  // ---- basic matrix/vector ops -------------------------------------------
  L.zeros = (n, m) => Array.from({ length: n }, () => new Array(m).fill(0));
  L.eye = (n) => { const A = L.zeros(n, n); for (let i = 0; i < n; i++) A[i][i] = 1; return A; };
  L.clone = (A) => A.map((r) => r.slice());
  L.transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));

  L.matmul = (A, B) => {
    const n = A.length, k = B.length, m = B[0].length;
    const C = L.zeros(n, m);
    for (let i = 0; i < n; i++)
      for (let t = 0; t < k; t++) {
        const a = A[i][t];
        if (a === 0) continue;
        for (let j = 0; j < m; j++) C[i][j] += a * B[t][j];
      }
    return C;
  };
  L.matvec = (A, x) => A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));
  L.add = (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j]));
  L.sub = (A, B) => A.map((r, i) => r.map((v, j) => v - B[i][j]));
  L.scale = (A, s) => A.map((r) => r.map((v) => v * s));

  // ---- point-cloud stats --------------------------------------------------
  L.mean = (X) => {
    const p = X[0].length, n = X.length, m = new Array(p).fill(0);
    for (const row of X) for (let j = 0; j < p; j++) m[j] += row[j];
    return m.map((v) => v / n);
  };
  L.centerWith = (X, mu) => X.map((row) => row.map((v, j) => v - mu[j]));
  L.center = (X) => { const mu = L.mean(X); return { X: L.centerWith(X, mu), mu }; };

  // sample covariance (ddof = 1); rows of X are observations
  L.cov = (X) => {
    const n = X.length, p = X[0].length, mu = L.mean(X);
    const C = L.zeros(p, p);
    for (const row of X)
      for (let i = 0; i < p; i++)
        for (let j = 0; j < p; j++) C[i][j] += (row[i] - mu[i]) * (row[j] - mu[j]);
    const d = Math.max(n - 1, 1);
    return C.map((r) => r.map((v) => v / d));
  };

  // ---- symmetric eigendecomposition (cyclic Jacobi) -----------------------
  // Returns { values:number[], vectors:number[][] } with vectors as COLUMNS,
  // sorted by eigenvalue descending. Works for any symmetric n×n matrix.
  L.eigSym = (Ain) => {
    const n = Ain.length;
    const A = L.clone(Ain);
    const V = L.eye(n);
    const maxSweeps = 100;
    for (let sweep = 0; sweep < maxSweeps; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          if (Math.abs(A[p][q]) < 1e-300) continue;
          const app = A[p][p], aqq = A[q][q], apq = A[p][q];
          const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
          const c = Math.cos(phi), s = Math.sin(phi);
          for (let i = 0; i < n; i++) {
            const aip = A[i][p], aiq = A[i][q];
            A[i][p] = c * aip - s * aiq;
            A[i][q] = s * aip + c * aiq;
          }
          for (let i = 0; i < n; i++) {
            const api = A[p][i], aqi = A[q][i];
            A[p][i] = c * api - s * aqi;
            A[q][i] = s * api + c * aqi;
          }
          for (let i = 0; i < n; i++) {
            const vip = V[i][p], viq = V[i][q];
            V[i][p] = c * vip - s * viq;
            V[i][q] = s * vip + c * viq;
          }
        }
      }
    }
    const vals = A.map((r, i) => r[i]);
    const idx = vals.map((v, i) => i).sort((a, b) => vals[b] - vals[a]);
    const values = idx.map((i) => vals[i]);
    const vectors = L.zeros(n, n);
    idx.forEach((src, dst) => { for (let i = 0; i < n; i++) vectors[i][dst] = V[i][src]; });
    return { values, vectors };
  };

  // ---- derived symmetric ops (via eig) -----------------------------------
  L.symFunc = (A, f) => {
    const { values, vectors } = L.eigSym(A);
    const D = L.zeros(values.length, values.length);
    for (let i = 0; i < values.length; i++) D[i][i] = f(values[i]);
    return L.matmul(L.matmul(vectors, D), L.transpose(vectors));
  };
  L.sqrtmSym = (A) => L.symFunc(A, (v) => Math.sqrt(Math.max(v, 0)));
  L.invSqrtmSym = (A, eps = 1e-9) => L.symFunc(A, (v) => 1 / Math.sqrt(Math.max(v, eps)));
  L.invSym = (A, eps = 1e-9) => L.symFunc(A, (v) => 1 / Math.max(v, eps));
  L.logmSym = (A, eps = 1e-9) => L.symFunc(A, (v) => Math.log(Math.max(v, eps)));
  L.expmSym = (A) => L.symFunc(A, (v) => Math.exp(v));

  // Cholesky-like upper factor returned as R with R^T R = A (2-D friendly).
  L.chol = (A) => {
    const n = A.length;
    const Lm = L.zeros(n, n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = A[i][j];
        for (let k = 0; k < j; k++) sum -= Lm[i][k] * Lm[j][k];
        if (i === j) Lm[i][j] = Math.sqrt(Math.max(sum, 1e-12));
        else Lm[i][j] = sum / Lm[j][j];
      }
    }
    return Lm; // lower triangular, Lm Lm^T = A
  };

  // principal axes of a 2-D cloud: angle of major axis + eigenvalues (desc).
  L.principalAxes2D = (X) => {
    const C = L.cov(X);
    const { values, vectors } = L.eigSym(C);
    const angle = Math.atan2(vectors[1][0], vectors[0][0]);
    return { angle, l1: values[0], l2: values[1], C, vectors, values };
  };

  // ---- kernels & distances ------------------------------------------------
  L.pairwiseSq = (X, Y) => {
    const n = X.length, m = Y.length, D = L.zeros(n, m);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++) {
        let s = 0;
        for (let d = 0; d < X[i].length; d++) { const t = X[i][d] - Y[j][d]; s += t * t; }
        D[i][j] = s;
      }
    return D;
  };
  L.rbf = (X, Y, sigma) => {
    const D = L.pairwiseSq(X, Y), g = 1 / (2 * sigma * sigma);
    return D.map((r) => r.map((v) => Math.exp(-v * g)));
  };
  // median-of-pairwise-distance bandwidth used by the kernel visualizations
  L.sigmaMed = (X, Y) => {
    const Z = X.concat(Y), D = L.pairwiseSq(Z, Z), vals = [];
    for (let i = 0; i < Z.length; i++) for (let j = i + 1; j < Z.length; j++) vals.push(Math.sqrt(D[i][j]));
    vals.sort((a, b) => a - b);
    const med = vals[Math.floor(vals.length / 2)] || 1;
    return med || 1;
  };

  // centering matrix H = I - 1/n 11^T, returned applied: HKH
  L.doubleCenter = (K) => {
    const n = K.length;
    const rowMean = K.map((r) => r.reduce((s, v) => s + v, 0) / n);
    const grand = rowMean.reduce((s, v) => s + v, 0) / n;
    const colMean = rowMean; // K symmetric
    return K.map((r, i) => r.map((v, j) => v - rowMean[i] - colMean[j] + grand));
  };

  // ---- Sinkhorn entropic OT ----------------------------------------------
  // a,b uniform marginals; C cost (squared distance); returns coupling P plus
  // the per-iteration marginal residual history (for the animation).
  L.sinkhorn = (a, b, C, eps, iters) => {
    const n = a.length, m = b.length;
    const K = C.map((r) => r.map((v) => Math.exp(-v / eps)));
    let u = new Array(n).fill(1), v = new Array(m).fill(1);
    const history = [];
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) {
        let s = 0; for (let j = 0; j < m; j++) s += K[i][j] * v[j];
        u[i] = a[i] / (s + 1e-300);
      }
      for (let j = 0; j < m; j++) {
        let s = 0; for (let i = 0; i < n; i++) s += K[i][j] * u[i];
        v[j] = b[j] / (s + 1e-300);
      }
      if (it % 1 === 0) {
        const P = L.couplingFrom(u, v, K);
        const rs = P.map((r) => r.reduce((x, y) => x + y, 0));
        const res = Math.max(...rs.map((x, i) => Math.abs(x - a[i])));
        history.push({ P, res });
      }
    }
    return { P: L.couplingFrom(u, v, K), history };
  };
  L.couplingFrom = (u, v, K) => K.map((r, i) => r.map((kij, j) => u[i] * kij * v[j]));

  // barycentric map: each source point -> weighted mean of targets it sends mass to
  L.barycentric = (P, Y) => {
    return P.map((row) => {
      const w = row.reduce((s, v) => s + v, 0) + 1e-300;
      const acc = new Array(Y[0].length).fill(0);
      row.forEach((pij, j) => { for (let d = 0; d < acc.length; d++) acc[d] += pij * Y[j][d]; });
      return acc.map((x) => x / w);
    });
  };

  // apply a 2×2 (or p×p) linear map M to every row of X (row-vector convention X M)
  L.applyMap = (X, M) => X.map((row) => L.matvec(M, row));
  // rotate a 2-D cloud by angle (about origin)
  L.rotate2D = (X, ang) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    return X.map(([x, y]) => [c * x - s * y, s * x + c * y]);
  };
  L.lerp = (a, b, t) => a + (b - a) * t;
  L.lerpPts = (A, B, t) => A.map((p, i) => p.map((v, d) => v + (B[i][d] - v) * t));

  if (typeof module !== "undefined" && module.exports) module.exports = L;
  root.DAV = root.DAV || {};
  root.DAV.lin = L;
})(typeof window !== "undefined" ? window : globalThis);
