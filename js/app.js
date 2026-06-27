/* app.js — UI shell, state, metrics, export, and player wiring. */
(function () {
  "use strict";
  const DAV = window.DAV, M = DAV.methods, data = DAV.data, lin = DAV.lin;

  const THEMES = {
    light: {
      font: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      colors: { src: "#2f6fb3", tgt: "#e08a16", accent: "#7a5af0", edge: "rgba(90,115,150,0.9)", grid: "rgba(0,0,0,0.06)", text: "#1c1c1c", textMute: "#6a6f78", bg: "#ffffff", panel: "rgba(0,0,0,0.02)", border: "rgba(0,0,0,0.16)", barMute: "#cbd0d8" },
      heat: { seq: [47, 111, 179], pos: [205, 90, 48], neg: [47, 111, 179] },
    },
    dark: {
      font: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      colors: { src: "#5aa0e6", tgt: "#f0a93a", accent: "#9b8af5", edge: "rgba(165,185,215,0.8)", grid: "rgba(255,255,255,0.07)", text: "#e8e8e8", textMute: "#9aa0aa", bg: "#181818", panel: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.16)", barMute: "#555b66" },
      heat: { seq: [120, 170, 235], pos: [240, 130, 90], neg: [120, 170, 235] },
    },
  };

  const METHOD_INFO = {
    sa: {
      goal: "align principal subspaces", transform: "PCA frames + W = Zs^T Zt",
      matched: "orientation", missed: "mean and scale", assumptions: "linear subspace shift",
      output: "reusable linear map", math: "Xs Zs Zs^T Zt",
      ref: ["Fernando et al. 2013", "https://openaccess.thecvf.com/content_iccv_2013/html/Fernando_Unsupervised_Visual_Domain_2013_ICCV_paper.html"],
    },
    coral: {
      goal: "match second-order statistics", transform: "whiten source, recolor to target",
      matched: "covariance", missed: "mean and labels", assumptions: "global covariance shift",
      output: "reusable affine map", math: "A = Cs^-1/2 Ct^1/2",
      ref: ["Sun et al. 2016", "https://arxiv.org/abs/1511.05547"],
    },
    rd: {
      goal: "diagnose and reduce SPD mismatch", transform: "rotate source covariance eigenframe",
      matched: "orientation", missed: "eigenvalue scale", assumptions: "covariance geometry matters",
      output: "rotation + distance", math: "dR(Cs,Ct)",
      ref: ["Zanini et al. 2018", "https://doi.org/10.1109/TBME.2017.2742541"],
    },
    art: {
      goal: "transport covariance and mean", transform: "SPD endpoint transport + shift",
      matched: "covariance and mean", missed: "class-conditional structure", assumptions: "one covariance per domain",
      output: "domain-level affine map", math: "Cs -> Ct on SPD",
      ref: ["Zanini et al. 2018", "https://doi.org/10.1109/TBME.2017.2742541"],
    },
    pt: {
      goal: "move covariance along SPD geometry", transform: "single congruence map + translation",
      matched: "covariance and mean", missed: "pointwise correspondence", assumptions: "SPD covariance summary",
      output: "transport operator", math: "E Cs E = Ct",
      ref: ["Zanini et al. 2018", "https://doi.org/10.1109/TBME.2017.2742541"],
    },
    tca: {
      goal: "learn transfer components", transform: "kernel projection with MMD penalty",
      matched: "marginal distribution", missed: "conditional/class gap", assumptions: "RKHS representation helps",
      output: "learned components", math: "min MMD, max variance",
      ref: ["Pan et al. 2011", "https://doi.org/10.1109/TNN.2010.2091281"],
    },
    mida: {
      goal: "remove domain dependence", transform: "kernel projection independent of domain features",
      matched: "domain-feature dependence", missed: "direct metric matching", assumptions: "domain variables are observed",
      output: "learned components", math: "min HSIC(domain,Z)",
      ref: ["Yan et al. 2017", "https://arxiv.org/pdf/1603.04535"],
    },
    gfk: {
      goal: "integrate subspaces between domains", transform: "Grassmann geodesic kernel",
      matched: "subspace path", missed: "point locations", assumptions: "low-dimensional subspaces",
      output: "kernel/metric", math: "G = integral Phi(t)Phi(t)^T dt",
      ref: ["Gong et al. 2012", "https://www.cs.utexas.edu/~grauman/papers/subspace-cvpr2012.pdf"],
    },
    ot: {
      goal: "match empirical distributions", transform: "Sinkhorn coupling + barycentric map",
      matched: "point mass distribution", missed: "out-of-sample transform", assumptions: "transductive target samples",
      output: "transport plan", math: "min <P,C> + eps H(P)",
      ref: ["Courty et al. 2017", "https://arxiv.org/abs/1507.00504"],
    },
    m3d: {
      goal: "align marginal then conditional gaps", transform: "multi-stage distribution alignment",
      matched: "global and class-centroid gaps", missed: "true labels if pseudo-labels fail", assumptions: "usable class signal",
      output: "pipeline transform", math: "marginal + conditional MMD",
      ref: ["Long et al. 2013", "https://openaccess.thecvf.com/content_iccv_2013/html/Long_Transfer_Feature_Learning_2013_ICCV_paper.html"],
    },
  };

  const DATASET_CONTROLS = [
    { key: "shift", label: "mean shift", min: 0.4, max: 1.8, step: 0.1, value: 1 },
    { key: "rot", label: "target rotation", min: -60, max: 60, step: 5, value: 0, suffix: "deg" },
    { key: "scale", label: "target scale", min: 0.6, max: 1.8, step: 0.1, value: 1 },
    { key: "noise", label: "noise", min: 0, max: 0.5, step: 0.05, value: 0 },
    { key: "points", label: "points/domain", min: 8, max: 64, step: 1, value: 64 },
  ];

  const dataFor = {
    sa: () => data.affineNear(), coral: () => data.affine(), art: () => data.affine(), pt: () => data.affine(),
    rd: () => data.rotationOnly(), gfk: () => data.affine(), ot: () => data.smallOT(),
    tca: () => data.twoClass(), mida: () => data.twoClass(), m3d: () => data.twoClass(),
  };

  let theme = matchMedia("(prefers-color-scheme: dark)").matches ? THEMES.dark : THEMES.light;
  const compactViewport = matchMedia("(max-width: 700px)");

  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");
  const stage = document.querySelector(".stage");
  const elStep = document.getElementById("step");
  const elCap = document.getElementById("caption");
  const elRead = document.getElementById("readout");
  const elProg = document.getElementById("prog");
  const elPlay = document.getElementById("play");
  const elPrev = document.getElementById("prev-step");
  const elNext = document.getElementById("next-step");
  const elExportPng = document.getElementById("export-png");
  const elExportWebm = document.getElementById("export-webm");
  const elFullscreen = document.getElementById("fullscreen");
  const elBlurb = document.getElementById("blurb");
  const elFacts = document.getElementById("facts");
  const elName = document.getElementById("mname");
  const elCtrls = document.getElementById("controls");
  const elStepper = document.getElementById("stepper");
  const elStatus = document.getElementById("sr-status");
  const elMatrixToggle = document.getElementById("showmat");
  const elCompare = document.getElementById("compare");
  const elCompareMethod = document.getElementById("compare-method");
  const elMethodInfo = document.getElementById("method-info");
  const elMetrics = document.getElementById("metrics");
  const elDatasetControls = document.getElementById("dataset-controls");
  const tabsEl = document.getElementById("tabs");

  let cssW = 900, cssH = 480, stepCount = 0;
  let current = null, compareKey = null, controlVals = {}, datasetVals = {};
  let currentFrames = [], compareFrames = [], activeStepText = "";
  const showMatrices = () => elMatrixToggle.checked;
  const compareEnabled = () => elCompare.checked && compareKey && M.get(compareKey);

  function compactNumber(n) {
    return (Math.round(n * 1000) / 1000).toString();
  }

  function clamp(raw, spec) {
    const num = parseFloat(raw);
    if (!Number.isFinite(num)) return spec.value;
    return Math.min(spec.max, Math.max(spec.min, num));
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    const controls = {}, dataset = {};
    const datasetKeys = new Set(DATASET_CONTROLS.map((d) => d.key));
    params.forEach((value, key) => {
      if (["method", "p", "mat", "compare", "with"].includes(key)) return;
      const num = parseFloat(value);
      if (!Number.isFinite(num)) return;
      if (datasetKeys.has(key)) dataset[key] = num;
      else controls[key] = num;
    });
    const p = parseFloat(params.get("p"));
    const method = params.get("method");
    const withMethod = params.get("with");
    const mat = params.get("mat");
    return {
      method: method && M.get(method) ? method : null,
      p: Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0,
      mat: mat == null ? null : !(mat === "0" || mat === "false"),
      compare: params.get("compare") === "1",
      with: withMethod && M.get(withMethod) ? withMethod : null,
      controls,
      dataset,
    };
  }

  const initialState = readUrlState();
  DATASET_CONTROLS.forEach((spec) => {
    datasetVals[spec.key] = initialState.dataset[spec.key] == null ? spec.value : clamp(initialState.dataset[spec.key], spec);
  });
  if (initialState.mat != null) elMatrixToggle.checked = initialState.mat;
  else if (compactViewport.matches) elMatrixToggle.checked = false;
  elCompare.checked = initialState.compare;

  function mean(X) {
    if (!X.length) return [0, 0];
    return lin.mean(X);
  }

  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s]; }
  function norm(a) { return Math.hypot(a[0], a[1]); }

  function rotatePoint(p, center, deg) {
    const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    const x = p[0] - center[0], y = p[1] - center[1];
    return [center[0] + c * x - s * y, center[1] + s * x + c * y];
  }

  function balancedSelect(points, labels, maxN) {
    const n = Math.min(maxN, points.length);
    if (!labels || labels.length !== points.length || n >= points.length) {
      return { points: points.slice(0, n), labels: labels ? labels.slice(0, n) : labels };
    }
    const groups = new Map();
    labels.forEach((lab, i) => {
      if (!groups.has(lab)) groups.set(lab, []);
      groups.get(lab).push(i);
    });
    const chosen = [];
    let cursor = 0;
    const buckets = [...groups.values()];
    while (chosen.length < n && buckets.some((b) => cursor < b.length)) {
      for (const b of buckets) {
        if (cursor < b.length && chosen.length < n) chosen.push(b[cursor]);
      }
      cursor += 1;
    }
    chosen.sort((a, b) => a - b);
    return { points: chosen.map((i) => points[i]), labels: chosen.map((i) => labels[i]) };
  }

  function perturbData(base) {
    const maxPoints = Math.round(datasetVals.points);
    const srcSel = balancedSelect(base.source, base.srcLabel, maxPoints);
    const tgtSel = balancedSelect(base.target, base.tgtLabel, maxPoints);
    let S = srcSel.points.map((p) => p.slice());
    let T = tgtSel.points.map((p) => p.slice());
    let srcLabel = srcSel.labels, tgtLabel = tgtSel.labels;

    const ms = mean(S), mt = mean(T), mid = mul(add(ms, mt), 0.5), shift = datasetVals.shift;
    const ns = add(mid, mul(sub(ms, mid), shift));
    const nt = add(mid, mul(sub(mt, mid), shift));
    S = S.map((p) => add(ns, sub(p, ms)));
    T = T.map((p) => add(nt, sub(p, mt)));

    const mt2 = mean(T), scale = datasetVals.scale;
    T = T.map((p) => add(mt2, mul(sub(p, mt2), scale))).map((p) => rotatePoint(p, mt2, datasetVals.rot));

    if (datasetVals.noise > 0) {
      const r = data.rng(20260627);
      const jitter = (pts) => pts.map((p) => [p[0] + datasetVals.noise * data.gauss(r), p[1] + datasetVals.noise * data.gauss(r)]);
      S = jitter(S); T = jitter(T);
    }
    const out = { source: S, target: T };
    if (srcLabel) out.srcLabel = srcLabel;
    if (tgtLabel) out.tgtLabel = tgtLabel;
    return out;
  }

  function datasetForMethod(key) {
    return perturbData(dataFor[key]());
  }

  function buildFrames(key) {
    const desc = M.get(key);
    const params = Object.assign({}, datasetForMethod(key), {
      showMatrices: showMatrices(),
      controls: controlVals[key] || {},
    });
    return desc.build(params);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    cssW = cv.clientWidth || 900;
    const compact = compactViewport.matches;
    const comparison = compareEnabled();
    const aspect = compact ? (showMatrices() ? 1.2 : 1.55) : (comparison ? 1.45 : 1.78);
    cssH = Math.round(cssW / aspect);
    cv.width = cssW * dpr; cv.height = cssH * dpr;
    cv.style.height = cssH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.render();
  }

  function stepIndexOf(s) {
    if (!s) return 0;
    if (s.indexOf("done") >= 0) return stepCount - 1;
    const m = s.match(/^(\d+)/);
    return m ? Math.min(parseInt(m[1], 10) - 1, stepCount - 1) : 0;
  }

  function highlightStep(s) {
    activeStepText = s || "";
    const idx = stepIndexOf(s);
    const isDone = s && s.indexOf("done") >= 0;
    [...elStepper.children].forEach((li, i) => {
      li.classList.toggle("active", i === idx && !isDone);
      li.classList.toggle("done", i < idx || (isDone && i === idx));
    });
  }

  function scalePanelRect(panel, x0, wScale) {
    const p = Object.assign({}, panel);
    const r = panel.rect || [0, 0, 1, 1];
    p.rect = [x0 + r[0] * wScale, r[1], r[2] * wScale, r[3]];
    return p;
  }

  function renderMethodLabel(text, x, y) {
    ctx.save();
    ctx.font = "12px " + theme.font;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = theme.colors.panel;
    roundRect(ctx, x - 8, y - 5, ctx.measureText(text).width + 16, 24, 7);
    ctx.fill();
    ctx.strokeStyle = theme.colors.border;
    ctx.stroke();
    ctx.fillStyle = theme.colors.text;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function renderComposite(primary, secondary) {
    const left = primary.panels.map((p) => scalePanelRect(p, 0, 0.492));
    const right = secondary.panels.map((p) => scalePanelRect(p, 0.508, 0.492));
    DAV.render.scene(ctx, cssW, cssH, { panels: left.concat(right) }, theme);
    renderMethodLabel(M.get(current).short, 16, 12);
    renderMethodLabel(M.get(compareKey).short, cssW * 0.508 + 16, 12);
  }

  function extractPoints(scene) {
    const out = { src: [], tgt: [], srcShape: {}, tgtShape: {} };
    (scene.panels || []).forEach((panel) => {
      if (panel.kind !== "plane") return;
      (panel.drawables || []).forEach((d) => {
        if (d.type !== "points" || !d.pts) return;
        const dom = d.color === "src" ? "src" : d.color === "tgt" ? "tgt" : null;
        if (!dom) return;
        const shape = d.shape || "circle";
        out[dom].push(...d.pts);
        const byShape = dom === "src" ? out.srcShape : out.tgtShape;
        byShape[shape] = byShape[shape] || [];
        byShape[shape].push(...d.pts);
      });
    });
    return out;
  }

  function covSafe(X) {
    if (X.length < 2) return [[1, 0], [0, 1]];
    const C = lin.cov(X);
    C[0][0] += 1e-6; C[1][1] += 1e-6;
    return C;
  }

  function frob(A, B) {
    let s = 0;
    for (let i = 0; i < A.length; i++) for (let j = 0; j < A[i].length; j++) s += (A[i][j] - B[i][j]) ** 2;
    return Math.sqrt(s);
  }

  function riemDist(Cs, Ct) {
    const W = lin.invSqrtmSym(Cs, 1e-6);
    const A = lin.matmul(lin.matmul(W, Ct), W);
    const eg = lin.eigSym(A).values;
    return Math.sqrt(eg.reduce((s, v) => s + Math.log(Math.max(v, 1e-6)) ** 2, 0));
  }

  function blockMean(A) {
    if (!A.length || !A[0].length) return 0;
    return A.flat().reduce((a, b) => a + b, 0) / (A.length * A[0].length);
  }

  function mmd(S, T) {
    if (!S.length || !T.length) return 0;
    const sigma = lin.sigmaMed(S, T);
    const v = blockMean(lin.rbf(S, S, sigma)) + blockMean(lin.rbf(T, T, sigma)) - 2 * blockMean(lin.rbf(S, T, sigma));
    return Math.sqrt(Math.max(v, 0));
  }

  function classGap(points) {
    const shapes = Object.keys(points.srcShape).filter((k) => points.tgtShape[k] && points.srcShape[k].length && points.tgtShape[k].length);
    if (shapes.length < 2) return null;
    const avg = shapes.reduce((s, shape) => s + norm(sub(mean(points.srcShape[shape]), mean(points.tgtShape[shape]))), 0) / shapes.length;
    return avg;
  }

  function metricsFor(scene) {
    const pts = extractPoints(scene);
    const Cs = covSafe(pts.src), Ct = covSafe(pts.tgt);
    return {
      n: Math.min(pts.src.length, pts.tgt.length),
      mean: norm(sub(mean(pts.src), mean(pts.tgt))),
      cov: frob(Cs, Ct),
      riem: riemDist(Cs, Ct),
      mmd: mmd(pts.src, pts.tgt),
      cls: classGap(pts),
    };
  }

  function metricText(v) {
    return v == null ? "--" : v.toFixed(v >= 10 ? 1 : 3);
  }

  function addMetric(label, value) {
    const item = document.createElement("div");
    item.className = "metric";
    const k = document.createElement("span");
    k.className = "metric-k";
    k.textContent = label;
    const v = document.createElement("span");
    v.className = "metric-v";
    v.textContent = value;
    item.append(k, v);
    elMetrics.appendChild(item);
  }

  function updateMetrics(primary, secondary) {
    const pm = metricsFor(primary);
    elMetrics.replaceChildren();
    addMetric("mean gap", metricText(pm.mean));
    addMetric("cov gap", metricText(pm.cov));
    addMetric("MMD", metricText(pm.mmd));
    addMetric("class gap", metricText(pm.cls));
    if (secondary) {
      const sm = metricsFor(secondary);
      addMetric(M.get(compareKey).short + " mean", metricText(sm.mean));
      addMetric(M.get(compareKey).short + " cov", metricText(sm.cov));
      addMetric(M.get(compareKey).short + " MMD", metricText(sm.mmd));
      addMetric(M.get(compareKey).short + " class", metricText(sm.cls));
    }
  }

  const player = DAV.engine.Player((scene, p) => {
    const secondary = compareEnabled() && compareFrames.length ? DAV.engine.interp(compareFrames, p, true) : null;
    if (secondary) renderComposite(scene, secondary);
    else DAV.render.scene(ctx, cssW, cssH, scene, theme);

    elStep.textContent = scene.step || "";
    elCap.textContent = secondary ? scene.caption + " | " + M.get(compareKey).short + ": " + secondary.caption : scene.caption || "";
    elRead.textContent = scene.readout || "";
    elStatus.textContent = [elName.textContent, scene.step, scene.caption, scene.readout].filter(Boolean).join(". ");
    elProg.value = Math.round(p * 1000);
    highlightStep(scene.step);
    updateMetrics(scene, secondary);
    syncPlayIcon();
  });

  function syncUrl() {
    if (!current) return;
    const params = new URLSearchParams();
    params.set("method", current);
    if (player.progress() > 0.001) params.set("p", compactNumber(player.progress()));
    params.set("mat", showMatrices() ? "1" : "0");
    if (compareEnabled()) {
      params.set("compare", "1");
      params.set("with", compareKey);
    }
    DATASET_CONTROLS.forEach((spec) => {
      if (datasetVals[spec.key] !== spec.value) params.set(spec.key, compactNumber(datasetVals[spec.key]));
    });
    const desc = M.get(current);
    (desc.controls || []).forEach((c) => {
      const val = controlVals[current] && controlVals[current][c.key];
      if (val != null) params.set(c.key, compactNumber(val));
    });
    window.history.replaceState(null, "", window.location.pathname + "?" + params.toString() + window.location.hash);
  }

  function rebuild() {
    if (!current) return;
    currentFrames = buildFrames(current);
    compareFrames = compareEnabled() ? buildFrames(compareKey) : [];
    player.setFrames(currentFrames);
  }

  function renderMethodInfo(key) {
    const info = METHOD_INFO[key] || {};
    const rows = [
      ["Goal", info.goal], ["Transform", info.transform], ["Matched", info.matched],
      ["Not matched", info.missed], ["Assumption", info.assumptions], ["Output", info.output],
      ["Math", info.math], ["Reference", info.ref],
    ];
    elMethodInfo.replaceChildren();
    rows.forEach(([label, val]) => {
      if (!val) return;
      const item = document.createElement("div");
      item.className = "info-item";
      const k = document.createElement("span");
      k.className = "info-k";
      k.textContent = label;
      const v = document.createElement("span");
      v.className = "info-v";
      if (Array.isArray(val)) {
        const a = document.createElement("a");
        a.href = val[1]; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = val[0];
        v.appendChild(a);
      } else {
        v.textContent = val;
      }
      item.append(k, v);
      elMethodInfo.appendChild(item);
    });
  }

  function selectMethod(key, opts = {}) {
    current = key;
    const desc = M.get(key);
    if (!compareKey || compareKey === key) compareKey = firstOtherMethod(key);
    elCompareMethod.value = compareKey;
    document.querySelectorAll(".tab").forEach((b) => {
      const active = b.dataset.k === key;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });
    elName.textContent = desc.short + " · " + desc.name;
    elBlurb.textContent = desc.blurb;
    elFacts.replaceChildren();
    (desc.facts || []).forEach((f) => {
      const s = document.createElement("span");
      s.className = "chip";
      s.textContent = f;
      elFacts.appendChild(s);
    });
    renderMethodInfo(key);
    renderStepper(desc.steps || []);
    renderMethodControls(key);
    rebuild();
    player.seek(opts.seek == null ? 0 : opts.seek);
    if (!opts.silent) syncUrl();
    resize();
  }

  function renderStepper(steps) {
    stepCount = steps.length;
    elStepper.replaceChildren();
    steps.forEach((s, i) => {
      const li = document.createElement("li");
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = i + 1;
      li.append(num, document.createTextNode(s));
      elStepper.appendChild(li);
    });
  }

  function renderMethodControls(key) {
    const desc = M.get(key);
    elCtrls.replaceChildren();
    controlVals[key] = controlVals[key] || {};
    (desc.controls || []).forEach((c) => {
      if (controlVals[key][c.key] == null) {
        controlVals[key][c.key] = key === initialState.method && initialState.controls[c.key] != null
          ? clamp(initialState.controls[c.key], c)
          : c.value;
      }
      elCtrls.appendChild(makeRangeControl(c, controlVals[key][c.key], (val, out) => {
        controlVals[key][c.key] = val;
        out.textContent = compactNumber(val);
        rebuild();
        syncUrl();
      }));
    });
  }

  function makeRangeControl(spec, value, onInput) {
    const wrap = document.createElement("label");
    wrap.className = "ctrl";
    const lab = document.createElement("span");
    lab.className = "ctrl-lab";
    lab.textContent = spec.label;
    const inp = document.createElement("input");
    inp.type = "range";
    inp.min = spec.min; inp.max = spec.max; inp.step = spec.step; inp.value = value;
    inp.setAttribute("aria-label", spec.label);
    const out = document.createElement("span");
    out.className = "ctrl-val";
    out.textContent = compactNumber(value) + (spec.suffix ? " " + spec.suffix : "");
    inp.addEventListener("input", () => {
      const val = clamp(inp.value, spec);
      out.textContent = compactNumber(val) + (spec.suffix ? " " + spec.suffix : "");
      onInput(val, out);
    });
    wrap.append(lab, inp, out);
    return wrap;
  }

  function renderDatasetControls() {
    elDatasetControls.replaceChildren();
    DATASET_CONTROLS.forEach((spec) => {
      elDatasetControls.appendChild(makeRangeControl(spec, datasetVals[spec.key], (val) => {
        datasetVals[spec.key] = spec.key === "points" ? Math.round(val) : val;
        rebuild();
        syncUrl();
      }));
    });
  }

  function firstOtherMethod(key) {
    const found = M.all().find((d) => d.key !== key);
    return found ? found.key : key;
  }

  function buildTabsAndCompareList() {
    M.all().forEach((d) => {
      const b = document.createElement("button");
      b.className = "tab";
      b.dataset.k = d.key;
      b.textContent = d.short;
      b.type = "button";
      b.title = d.name;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => selectMethod(d.key));
      tabsEl.appendChild(b);

      const opt = document.createElement("option");
      opt.value = d.key;
      opt.textContent = d.short + " · " + d.name;
      elCompareMethod.appendChild(opt);
    });
  }

  function syncPlayIcon() {
    elPlay.setAttribute("aria-label", player.isPlaying() ? "Pause animation" : "Play animation");
    elPlay.innerHTML = player.isPlaying()
      ? '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 4l13 8-13 8z"/></svg>';
  }

  function frameStepIndex(i) {
    if (!currentFrames.length) return 0;
    return Math.max(0, Math.min(currentFrames.length - 1, i));
  }

  function seekStep(delta) {
    const currentIdx = stepIndexOf(activeStepText);
    const target = Math.max(0, Math.min(stepCount - 1, currentIdx + delta));
    const frameIdx = currentFrames.findIndex((f) => stepIndexOf(f.step) >= target);
    const idx = frameStepIndex(frameIdx < 0 ? currentFrames.length - 1 : frameIdx);
    player.pause();
    player.seek(currentFrames.length <= 1 ? 0 : idx / (currentFrames.length - 1));
    syncUrl();
  }

  function downloadUrl(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function exportPng() {
    const name = "shiftlens-" + current + "-p" + compactNumber(player.progress()) + ".png";
    downloadUrl(cv.toDataURL("image/png"), name);
  }

  async function exportWebm() {
    if (!cv.captureStream || !window.MediaRecorder) {
      alert("This browser does not support WebM recording from canvas.");
      return;
    }
    const oldProgress = player.progress();
    player.pause();
    const stream = cv.captureStream(30);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((resolve) => { rec.onstop = resolve; });
    elExportWebm.disabled = true;
    elExportWebm.textContent = "Recording";
    rec.start();
    const duration = 5200, start = performance.now();
    await new Promise((resolve) => {
      function tick(now) {
        const p = Math.min(1, (now - start) / duration);
        player.seek(p);
        if (p < 1) requestAnimationFrame(tick);
        else setTimeout(resolve, 150);
      }
      requestAnimationFrame(tick);
    });
    rec.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: mime });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, "shiftlens-" + current + ".webm");
    URL.revokeObjectURL(url);
    player.seek(oldProgress);
    elExportWebm.disabled = false;
    elExportWebm.textContent = "WebM";
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen();
  }

  elPlay.addEventListener("click", () => { player.toggle(); syncPlayIcon(); syncUrl(); });
  elProg.addEventListener("input", () => { player.pause(); player.seek(parseInt(elProg.value, 10) / 1000); syncUrl(); });
  elPrev.addEventListener("click", () => seekStep(-1));
  elNext.addEventListener("click", () => seekStep(1));
  elExportPng.addEventListener("click", exportPng);
  elExportWebm.addEventListener("click", () => { exportWebm(); });
  elFullscreen.addEventListener("click", toggleFullscreen);
  elMatrixToggle.addEventListener("change", () => { rebuild(); resize(); syncUrl(); });
  elCompare.addEventListener("change", () => { rebuild(); resize(); syncUrl(); });
  elCompareMethod.addEventListener("change", () => {
    compareKey = elCompareMethod.value;
    if (compareKey === current) compareKey = firstOtherMethod(current);
    elCompareMethod.value = compareKey;
    rebuild(); resize(); syncUrl();
  });
  window.addEventListener("resize", resize);
  compactViewport.addEventListener("change", resize);
  document.addEventListener("fullscreenchange", () => {
    elFullscreen.textContent = document.fullscreenElement ? "Exit" : "Fullscreen";
    resize();
  });
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowLeft") { e.preventDefault(); seekStep(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); seekStep(1); }
    if (e.key === " ") { e.preventDefault(); player.toggle(); syncPlayIcon(); syncUrl(); }
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    theme = e.matches ? THEMES.dark : THEMES.light;
    player.render();
  });

  buildTabsAndCompareList();
  compareKey = initialState.with || firstOtherMethod(initialState.method || "sa");
  elCompareMethod.value = compareKey;
  renderDatasetControls();
  selectMethod(initialState.method || "sa", { seek: initialState.p, silent: true });
  resize();
  player.seek(initialState.p);
  syncUrl();
})();
