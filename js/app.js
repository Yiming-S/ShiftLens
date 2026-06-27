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
    cssH = Math.round(cssW / 1.78);
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
    elProg.value = Math.round(p * 1000);
    highlightStep(scene.step);
    syncPlayIcon();
  });

  let current = null, controlVals = {};
  const showMatrices = () => document.getElementById("showmat").checked;

  function rebuild() {
    const desc = M.get(current);
    const d = dataFor[current]();
    const params = Object.assign({}, d, { showMatrices: showMatrices(), controls: controlVals[current] || {} });
    player.setFrames(desc.build(params));
  }

  function selectMethod(key) {
    current = key;
    const desc = M.get(key);
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.k === key));
    elName.textContent = desc.short + " · " + desc.name;
    elBlurb.textContent = desc.blurb;
    elFacts.innerHTML = "";
    (desc.facts || []).forEach((f) => { const s = document.createElement("span"); s.className = "chip"; s.textContent = f; elFacts.appendChild(s); });
    // step list
    const steps = desc.steps || [];
    stepCount = steps.length;
    elStepper.innerHTML = "";
    steps.forEach((s, i) => {
      const li = document.createElement("li");
      li.innerHTML = '<span class="num">' + (i + 1) + "</span>" + s;
      elStepper.appendChild(li);
    });
    // method controls
    elCtrls.innerHTML = "";
    controlVals[key] = controlVals[key] || {};
    (desc.controls || []).forEach((c) => {
      controlVals[key][c.key] = controlVals[key][c.key] == null ? c.value : controlVals[key][c.key];
      const wrap = document.createElement("label"); wrap.className = "ctrl";
      const out = document.createElement("span"); out.className = "ctrl-val"; out.textContent = controlVals[key][c.key];
      const lab = document.createElement("span"); lab.className = "ctrl-lab"; lab.textContent = c.label;
      const inp = document.createElement("input"); inp.type = "range"; inp.min = c.min; inp.max = c.max; inp.step = c.step; inp.value = controlVals[key][c.key];
      inp.addEventListener("input", () => { controlVals[key][c.key] = parseFloat(inp.value); out.textContent = inp.value; rebuild(); });
      wrap.appendChild(lab); wrap.appendChild(inp); wrap.appendChild(out); elCtrls.appendChild(wrap);
    });
    rebuild();
    player.seek(0);
  }

  function syncPlayIcon() {
    elPlay.innerHTML = player.isPlaying()
      ? '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 4l13 8-13 8z"/></svg>';
  }

  // build tabs
  const tabsEl = document.getElementById("tabs");
  M.all().forEach((d) => {
    const b = document.createElement("button");
    b.className = "tab"; b.dataset.k = d.key; b.textContent = d.short;
    b.title = d.name;
    b.addEventListener("click", () => selectMethod(d.key));
    tabsEl.appendChild(b);
  });

  elPlay.addEventListener("click", () => { player.toggle(); syncPlayIcon(); });
  elProg.addEventListener("input", () => { player.pause(); player.seek(parseInt(elProg.value, 10) / 1000); });
  document.getElementById("showmat").addEventListener("change", rebuild);
  window.addEventListener("resize", resize);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => { theme = e.matches ? THEMES.dark : THEMES.light; player.render(); });

  selectMethod("sa");
  resize();
})();
