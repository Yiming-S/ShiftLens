/* app.js — wires the registry, theme, controls and player to the DOM. */
(function () {
  "use strict";
  const DAV = window.DAV, M = DAV.methods, data = DAV.data;

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
  let theme = matchMedia("(prefers-color-scheme: dark)").matches ? THEMES.dark : THEMES.light;
  const compactViewport = matchMedia("(max-width: 700px)");

  const dataFor = {
    sa: () => data.affineNear(), coral: () => data.affine(), art: () => data.affine(), pt: () => data.affine(),
    rd: () => data.rotationOnly(), gfk: () => data.affine(), ot: () => data.smallOT(),
    tca: () => data.twoClass(), mida: () => data.twoClass(), m3d: () => data.twoClass(),
  };

  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");
  let cssW = 900, cssH = 480;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    cssW = cv.clientWidth || 900;
    const compact = compactViewport.matches;
    const aspect = compact ? (showMatrices() ? 1.2 : 1.55) : 1.78;
    cssH = Math.round(cssW / aspect);
    cv.width = cssW * dpr; cv.height = cssH * dpr;
    cv.style.height = cssH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.render();
  }

  const elStep = document.getElementById("step");
  const elCap = document.getElementById("caption");
  const elRead = document.getElementById("readout");
  const elProg = document.getElementById("prog");
  const elPlay = document.getElementById("play");
  const elBlurb = document.getElementById("blurb");
  const elFacts = document.getElementById("facts");
  const elName = document.getElementById("mname");
  const elCtrls = document.getElementById("controls");
  const elStepper = document.getElementById("stepper");
  const elStatus = document.getElementById("sr-status");
  const elMatrixToggle = document.getElementById("showmat");

  function compactNumber(n) {
    return (Math.round(n * 1000) / 1000).toString();
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    const rawMethod = params.get("method");
    const rawProgress = parseFloat(params.get("p"));
    const rawMat = params.get("mat");
    const controls = {};
    params.forEach((value, key) => {
      if (key === "method" || key === "p" || key === "mat") return;
      const num = parseFloat(value);
      if (Number.isFinite(num)) controls[key] = num;
    });
    return {
      method: rawMethod && M.get(rawMethod) ? rawMethod : null,
      p: Number.isFinite(rawProgress) ? Math.max(0, Math.min(1, rawProgress)) : 0,
      mat: rawMat == null ? null : !(rawMat === "0" || rawMat === "false"),
      controls,
    };
  }

  const initialState = readUrlState();
  if (initialState.mat != null) elMatrixToggle.checked = initialState.mat;
  else if (compactViewport.matches) elMatrixToggle.checked = false;

  let stepCount = 0;
  function stepIndexOf(s) {
    if (!s) return 0;
    if (s.indexOf("done") >= 0) return stepCount - 1;
    const m = s.match(/^(\d+)/);
    return m ? Math.min(parseInt(m[1], 10) - 1, stepCount - 1) : 0;
  }
  function highlightStep(s) {
    const idx = stepIndexOf(s);
    const isDone = s && s.indexOf("done") >= 0;
    [...elStepper.children].forEach((li, i) => {
      li.classList.toggle("active", i === idx && !isDone);
      li.classList.toggle("done", i < idx || (isDone && i === idx));
    });
  }

  const player = DAV.engine.Player((scene, p) => {
    DAV.render.scene(ctx, cssW, cssH, scene, theme);
    elStep.textContent = scene.step || "";
    elCap.textContent = scene.caption || "";
    elRead.textContent = scene.readout || "";
    elStatus.textContent = [elName.textContent, scene.step, scene.caption, scene.readout].filter(Boolean).join(". ");
    elProg.value = Math.round(p * 1000);
    highlightStep(scene.step);
    syncPlayIcon();
  });

  let current = null, controlVals = {};
  const showMatrices = () => elMatrixToggle.checked;

  function syncUrl() {
    if (!current) return;
    const params = new URLSearchParams();
    params.set("method", current);
    if (player.progress() > 0.001) params.set("p", compactNumber(player.progress()));
    params.set("mat", showMatrices() ? "1" : "0");
    const desc = M.get(current);
    (desc.controls || []).forEach((c) => {
      const val = controlVals[current] && controlVals[current][c.key];
      if (val != null) params.set(c.key, compactNumber(val));
    });
    const next = window.location.pathname + "?" + params.toString() + window.location.hash;
    window.history.replaceState(null, "", next);
  }

  function clampControlValue(raw, spec) {
    const num = parseFloat(raw);
    if (!Number.isFinite(num)) return spec.value;
    return Math.min(spec.max, Math.max(spec.min, num));
  }

  function rebuild() {
    const desc = M.get(current);
    const d = dataFor[current]();
    const params = Object.assign({}, d, { showMatrices: showMatrices(), controls: controlVals[current] || {} });
    player.setFrames(desc.build(params));
  }

  function selectMethod(key, opts = {}) {
    current = key;
    const desc = M.get(key);
    document.querySelectorAll(".tab").forEach((b) => {
      const active = b.dataset.k === key;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });
    elName.textContent = desc.short + " · " + desc.name;
    elBlurb.textContent = desc.blurb;
    elFacts.replaceChildren();
    (desc.facts || []).forEach((f) => { const s = document.createElement("span"); s.className = "chip"; s.textContent = f; elFacts.appendChild(s); });
    // step list
    const steps = desc.steps || [];
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
    // method controls
    elCtrls.replaceChildren();
    controlVals[key] = controlVals[key] || {};
    (desc.controls || []).forEach((c) => {
      if (controlVals[key][c.key] == null) {
        controlVals[key][c.key] = key === initialState.method && initialState.controls[c.key] != null
          ? clampControlValue(initialState.controls[c.key], c)
          : c.value;
      }
      const wrap = document.createElement("label"); wrap.className = "ctrl";
      const out = document.createElement("span"); out.className = "ctrl-val"; out.textContent = controlVals[key][c.key];
      const lab = document.createElement("span"); lab.className = "ctrl-lab"; lab.textContent = c.label;
      const inp = document.createElement("input"); inp.type = "range"; inp.min = c.min; inp.max = c.max; inp.step = c.step; inp.value = controlVals[key][c.key];
      inp.setAttribute("aria-label", c.label);
      inp.addEventListener("input", () => {
        controlVals[key][c.key] = parseFloat(inp.value);
        out.textContent = inp.value;
        rebuild();
        syncUrl();
      });
      wrap.appendChild(lab); wrap.appendChild(inp); wrap.appendChild(out); elCtrls.appendChild(wrap);
    });
    rebuild();
    player.seek(opts.seek == null ? 0 : opts.seek);
    if (!opts.silent) syncUrl();
  }

  function syncPlayIcon() {
    elPlay.setAttribute("aria-label", player.isPlaying() ? "Pause animation" : "Play animation");
    elPlay.innerHTML = player.isPlaying()
      ? '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 4l13 8-13 8z"/></svg>';
  }

  // build tabs
  const tabsEl = document.getElementById("tabs");
  M.all().forEach((d) => {
    const b = document.createElement("button");
    b.className = "tab"; b.dataset.k = d.key; b.textContent = d.short;
    b.type = "button";
    b.title = d.name;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => selectMethod(d.key));
    tabsEl.appendChild(b);
  });

  elPlay.addEventListener("click", () => { player.toggle(); syncPlayIcon(); syncUrl(); });
  elProg.addEventListener("input", () => { player.pause(); player.seek(parseInt(elProg.value, 10) / 1000); syncUrl(); });
  elMatrixToggle.addEventListener("change", () => { rebuild(); resize(); syncUrl(); });
  window.addEventListener("resize", resize);
  compactViewport.addEventListener("change", resize);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => { theme = e.matches ? THEMES.dark : THEMES.light; player.render(); });

  selectMethod(initialState.method || "sa", { seek: initialState.p, silent: true });
  resize();
  player.seek(initialState.p);
  syncUrl();
})();
