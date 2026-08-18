/* WWCD STATUS — admin editor */
import {
  getConfig,
  saveConfig,
  uploadBackground,
  resolveAssetUrl,
  backgroundMediaType,
  exportConfigJson,
  importConfigJson,
  getChannelName,
  ensureCards,
} from "./config-store.js";

const ANIM_TYPES = ["staggered", "slideUp", "slideDown", "fadeScale", "flip", "shutter", "glassWipe", "energySweep"];

let config = null;
let previewChannel = null;
try {
  previewChannel = new BroadcastChannel(getChannelName());
} catch {
  previewChannel = null;
}

const $ = (id) => document.getElementById(id);

function setStatus(text, off) {
  const el = $("save-status");
  el.textContent = text;
  el.classList.toggle("off", !!off);
}

/* push live (unsaved) preview to the iframe overlay */
function pushPreview() {
  if (previewChannel) {
    try {
      previewChannel.postMessage({ type: "config", config: structuredClone(config) });
    } catch {
      /* ignore */
    }
  }
}

function commit() {
  setStatus("Unsaved changes — click Save all settings", true);
  pushPreview();
}

/* ── form population ── */
function fillForm() {
  const h = config.header || {};
  $("cfg-title").value = h.title || "";
  $("cfg-subtitle").value = h.subtitle || "";
  $("cfg-title-color").value = toHex(h.titleColor, "#ffffff");
  $("cfg-title-size").value = h.titleSize ?? 118;
  $("cfg-subtitle-size").value = h.subtitleSize ?? 40;
  $("cfg-pos-x").value = h.position?.x ?? 96;
  $("cfg-pos-y").value = h.position?.y ?? 70;
  renderMediaPreview("logo-preview", h.logoUrl);

  const bg = config.background || {};
  $("cfg-bg-scale").value = Math.round((bg.scale ?? 1.05) * 100);
  $("cfg-bg-scale-val").textContent = `${(bg.scale ?? 1.05).toFixed(2)}×`;
  renderMediaPreview("bg-preview", bg.imageUrl);

  const t = config.theme || {};
  $("cfg-accent").value = toHex(t.accent, "#ff6600");
  $("cfg-card-bg").value = toHex(t.cardBg, "#0c1320");
  $("cfg-name-bar").value = toHex(t.nameBarColor, "#ff6600");
  $("cfg-name-text").value = toHex(t.nameTextColor, "#ffffff");
  $("cfg-stat-value").value = toHex(t.statValueColor, "#ffffff");
  $("cfg-media-top").value = toHex(t.mediaTintTop, "#15b6c4");
  $("cfg-media-bottom").value = toHex(t.mediaTintBottom, "#0a5a64");

  const a = config.animation || {};
  const sel = $("cfg-anim-type");
  sel.innerHTML = ANIM_TYPES.map((x) => `<option value="${x}">${x}</option>`).join("");
  sel.value = a.type || "staggered";
  $("cfg-anim-speed").value = a.speed ?? 1;
  $("cfg-anim-speed-val").textContent = a.speed ?? 1;
  $("cfg-anim-enabled").checked = a.enabled !== false;

  $("cfg-winner-source").value = config.winnerSource === "manual" ? "manual" : "live";
  $("cfg-team-name").value = config.team?.name || "";
  $("cfg-team-footer").checked = config.team?.showFooter !== false;
  $("cfg-team-label-color").value = toHex(config.team?.labelColor, "#ffffff");
  $("cfg-team-name-color").value = toHex(config.team?.nameColor, toHex(config.theme?.accent, "#ff6600"));

  renderPlayerStatsRow();
  renderCharGrid();
}

function renderPlayerStatsRow() {
  const row = $("player-stats-row");
  if (!row) return;
  row.innerHTML = "";
  (config.cards || []).slice(0, 4).forEach((card, i) => {
    const col = document.createElement("div");
    col.className = "player-stats-col";
    const manual = card.manualName || card.manualFinishes;
    col.innerHTML = `
      <div class="player-stats-col__head">Player ${i + 1}${manual ? ' <span class="player-stats-override">manual</span>' : ""}</div>
      <div class="field"><label>Player name</label><input type="text" data-char-name="${i}" value="${escapeAttr(card.name || "")}" placeholder="PLAYER ${i + 1}" autocomplete="off" /></div>
      <div class="field"><label>Finishes</label><input type="number" min="0" step="1" data-char-fin="${i}" value="${Number(card.finishes) || 0}" autocomplete="off" /></div>
      <button type="button" class="btn btn-sm" data-char-use-live="${i}" ${!manual ? "disabled" : ""}>Use live</button>`;
    row.appendChild(col);
  });

  bindPlayerStatInputs(row);
}

function toHex(v, fallback) {
  if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return fallback;
}

function renderMediaPreview(containerId, url) {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = "";
  if (!url) {
    el.innerHTML = `<span class="hint" style="padding:14px">None</span>`;
    return;
  }
  const resolved = resolveAssetUrl(url);
  if (backgroundMediaType({ imageUrl: url }) === "video") {
    const v = document.createElement("video");
    v.src = resolved;
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    el.appendChild(v);
  } else {
    const img = document.createElement("img");
    img.src = resolved;
    el.appendChild(img);
  }
}

function charTransformCss(tf) {
  const t = tf || {};
  const zoom = Number(t.zoom) || 1;
  const sx = ((Number(t.stretchX) || 1) * zoom).toFixed(3);
  const sy = ((Number(t.stretchY) || 1) * zoom).toFixed(3);
  const x = Number(t.x) || 0;
  const y = Number(t.y) || 0;
  return `translate(${x}%, ${y}%) scale(${sx}, ${sy})`;
}

function defaultTransform() {
  return { zoom: 1, x: 0, y: 0, stretchX: 1, stretchY: 1 };
}

function applyThumbTransform(i) {
  const img = document.querySelector(`[data-char-thumb="${i}"]`);
  if (img) {
    img.style.transformOrigin = "bottom center";
    img.style.transform = charTransformCss(config.cards[i].transform);
  }
}

function bindPlayerStatInputs(container) {
  const root = container || document;
  root.querySelectorAll("[data-char-name]").forEach((inp) =>
    inp.addEventListener("input", (e) => {
      const i = Number(e.target.dataset.charName);
      config.cards[i].name = e.target.value;
      config.cards[i].manualName = true;
      commit();
      syncPlayerStatRowMeta(i);
    })
  );
  root.querySelectorAll("[data-char-fin]").forEach((inp) =>
    inp.addEventListener("input", (e) => {
      const i = Number(e.target.dataset.charFin);
      config.cards[i].finishes = Number(e.target.value) || 0;
      config.cards[i].manualFinishes = true;
      commit();
      syncPlayerStatRowMeta(i);
    })
  );
  root.querySelectorAll("[data-char-use-live]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.charUseLive);
      config.cards[i].manualName = false;
      config.cards[i].manualFinishes = false;
      config.cards[i].name = `PLAYER ${i + 1}`;
      config.cards[i].finishes = 0;
      renderPlayerStatsRow();
      commit();
    })
  );
}

function syncPlayerStatRowMeta(i) {
  const col = $("player-stats-row")?.children[i];
  if (!col) return;
  const card = config.cards[i];
  const manual = card.manualName || card.manualFinishes;
  const head = col.querySelector(".player-stats-col__head");
  if (head) {
    head.innerHTML = `Player ${i + 1}${manual ? ' <span class="player-stats-override">manual</span>' : ""}`;
  }
  const btn = col.querySelector("[data-char-use-live]");
  if (btn) btn.disabled = !manual;
}

function renderCharGrid() {
  const grid = $("char-grid");
  grid.innerHTML = "";
  (config.cards || []).slice(0, 4).forEach((card, i) => {
    if (!card.transform) card.transform = defaultTransform();
    const tf = card.transform;
    const wrap = document.createElement("div");
    wrap.className = "char-card";
    const src = card.characterImageUrl ? resolveAssetUrl(card.characterImageUrl) : `assets/characters/char-${i}.png`;
    const zoomPct = Math.round((Number(tf.zoom) || 1) * 100);
    const sxPct = Math.round((Number(tf.stretchX) || 1) * 100);
    const syPct = Math.round((Number(tf.stretchY) || 1) * 100);
    const px = Math.round(Number(tf.x) || 0);
    const py = Math.round(Number(tf.y) || 0);
    wrap.innerHTML = `
      <h3>Player ${i + 1}</h3>
      <div class="char-thumb"><img alt="" src="${src}" data-char-thumb="${i}" style="transform-origin:bottom center;transform:${charTransformCss(tf)}" /></div>
      <div class="field"><label>Character image</label><input type="file" accept="image/*" data-char-upload="${i}" /></div>
      <button type="button" class="btn" data-char-clear="${i}" style="margin-bottom:10px">Reset to default</button>
      <div class="field"><label>Zoom <b data-val="zoom-${i}">${zoomPct}%</b></label><input type="range" min="40" max="300" step="1" value="${zoomPct}" data-char-tf="zoom" data-i="${i}" /></div>
      <div class="field-row">
        <div class="field"><label>Width <b data-val="sx-${i}">${sxPct}%</b></label><input type="range" min="40" max="220" step="1" value="${sxPct}" data-char-tf="stretchX" data-i="${i}" /></div>
        <div class="field"><label>Height <b data-val="sy-${i}">${syPct}%</b></label><input type="range" min="40" max="220" step="1" value="${syPct}" data-char-tf="stretchY" data-i="${i}" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Move X <b data-val="x-${i}">${px}%</b></label><input type="range" min="-100" max="100" step="1" value="${px}" data-char-tf="x" data-i="${i}" /></div>
        <div class="field"><label>Move Y <b data-val="y-${i}">${py}%</b></label><input type="range" min="-100" max="100" step="1" value="${py}" data-char-tf="y" data-i="${i}" /></div>
      </div>
      <button type="button" class="btn" data-char-reset-adjust="${i}" style="margin-bottom:10px">Reset adjust</button>`;
    grid.appendChild(wrap);
  });

  const tfKeyToConfig = { zoom: 100, stretchX: 100, stretchY: 100, x: 1, y: 1 };
  const tfValLabel = { zoom: "zoom", stretchX: "sx", stretchY: "sy", x: "x", y: "y" };
  grid.querySelectorAll("[data-char-tf]").forEach((inp) =>
    inp.addEventListener("input", (e) => {
      const key = e.target.dataset.charTf;
      const i = Number(e.target.dataset.i);
      const raw = Number(e.target.value);
      config.cards[i].transform[key] = raw / tfKeyToConfig[key];
      const suffix = key === "x" || key === "y" ? "%" : "%";
      const lbl = grid.querySelector(`[data-val="${tfValLabel[key]}-${i}"]`);
      if (lbl) lbl.textContent = `${Math.round(raw)}${suffix}`;
      applyThumbTransform(i);
      commit();
    })
  );
  grid.querySelectorAll("[data-char-reset-adjust]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.charResetAdjust);
      config.cards[i].transform = defaultTransform();
      renderCharGrid();
      commit();
    })
  );

  grid.querySelectorAll("[data-char-upload]").forEach((inp) =>
    inp.addEventListener("change", async (e) => {
      const i = Number(e.target.dataset.charUpload);
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        setStatus("Uploading character…", true);
        const { url } = await uploadBackground(file);
        config.cards[i].characterImageUrl = url;
        renderCharGrid();
        renderPlayerStatsRow();
        commit();
      } catch (err) {
        alert(String(err?.message || err));
        setStatus("Upload failed", true);
      }
    })
  );
  grid.querySelectorAll("[data-char-clear]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.charClear);
      config.cards[i].characterImageUrl = "";
      renderCharGrid();
      renderPlayerStatsRow();
      commit();
    })
  );
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/* ── bindings ── */
function bind() {
  $("cfg-title").addEventListener("input", (e) => { config.header.title = e.target.value; commit(); });
  $("cfg-subtitle").addEventListener("input", (e) => { config.header.subtitle = e.target.value; commit(); });
  $("cfg-title-color").addEventListener("input", (e) => { config.header.titleColor = e.target.value; commit(); });
  $("cfg-title-size").addEventListener("input", (e) => { config.header.titleSize = Number(e.target.value) || 118; commit(); });
  $("cfg-subtitle-size").addEventListener("input", (e) => { config.header.subtitleSize = Number(e.target.value) || 40; commit(); });
  $("cfg-pos-x").addEventListener("input", (e) => { config.header.position = { ...(config.header.position || {}), x: Number(e.target.value) || 0 }; commit(); });
  $("cfg-pos-y").addEventListener("input", (e) => { config.header.position = { ...(config.header.position || {}), y: Number(e.target.value) || 0 }; commit(); });

  $("cfg-bg-scale").addEventListener("input", (e) => {
    config.background.scale = Number(e.target.value) / 100;
    $("cfg-bg-scale-val").textContent = `${config.background.scale.toFixed(2)}×`;
    commit();
  });
  $("cfg-bg-clear").addEventListener("click", () => {
    config.background.imageUrl = "";
    config.background.mediaType = "image";
    renderMediaPreview("bg-preview", "");
    commit();
  });
  $("cfg-bg-upload").addEventListener("change", (e) => handleUpload(e, async (url, mediaType) => {
    config.background.imageUrl = url;
    config.background.mediaType = mediaType || "image";
    renderMediaPreview("bg-preview", url);
  }));

  $("cfg-logo-upload").addEventListener("change", (e) => handleUpload(e, async (url) => {
    config.header.logoUrl = url;
    renderMediaPreview("logo-preview", url);
  }, { imagesOnly: true }));
  $("cfg-logo-clear").addEventListener("click", () => { config.header.logoUrl = ""; renderMediaPreview("logo-preview", ""); commit(); });

  $("cfg-accent").addEventListener("input", (e) => { config.theme.accent = e.target.value; commit(); });
  $("cfg-card-bg").addEventListener("input", (e) => { config.theme.cardBg = e.target.value; commit(); });
  $("cfg-name-bar").addEventListener("input", (e) => { config.theme.nameBarColor = e.target.value; commit(); });
  $("cfg-name-text").addEventListener("input", (e) => { config.theme.nameTextColor = e.target.value; commit(); });
  $("cfg-stat-value").addEventListener("input", (e) => { config.theme.statValueColor = e.target.value; commit(); });
  const applyMediaTint = () => {
    const top = $("cfg-media-top").value;
    const bottom = $("cfg-media-bottom").value;
    config.theme.mediaTintTop = top;
    config.theme.mediaTintBottom = bottom;
    config.theme.mediaTint = `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
    commit();
  };
  $("cfg-media-top").addEventListener("input", applyMediaTint);
  $("cfg-media-bottom").addEventListener("input", applyMediaTint);

  $("cfg-anim-type").addEventListener("change", (e) => { config.animation.type = e.target.value; commit(); });
  $("cfg-anim-speed").addEventListener("input", (e) => { config.animation.speed = Number(e.target.value); $("cfg-anim-speed-val").textContent = e.target.value; commit(); });
  $("cfg-anim-enabled").addEventListener("change", (e) => { config.animation.enabled = e.target.checked; commit(); });

  $("cfg-winner-source").addEventListener("change", (e) => { config.winnerSource = e.target.value === "manual" ? "manual" : "live"; commit(); });
  $("cfg-team-name").addEventListener("input", (e) => { config.team.name = e.target.value; commit(); });
  $("cfg-team-footer").addEventListener("change", (e) => { config.team.showFooter = e.target.checked; commit(); });
  $("cfg-team-label-color").addEventListener("input", (e) => { config.team.labelColor = e.target.value; commit(); });
  $("cfg-team-name-color").addEventListener("input", (e) => { config.team.nameColor = e.target.value; commit(); });
  $("cfg-team-logo-upload").addEventListener("change", (e) => handleUpload(e, async (url) => { config.team.logoUrl = url; }, { imagesOnly: true }));
  $("cfg-team-logo-clear").addEventListener("click", () => { config.team.logoUrl = ""; commit(); });

  $("btn-save-all").addEventListener("click", save);
  $("btn-save-all-sticky").addEventListener("click", save);
  $("btn-replay").addEventListener("click", async () => {
    config.animation.replayKey = (config.animation.replayKey || 0) + 1;
    await save();
  });
  $("btn-reset").addEventListener("click", async () => {
    if (!confirm("Reset all WWCD STATUS settings to defaults?")) return;
    localStorage.removeItem("wwcd-status-config");
    const fresh = await getConfig();
    // getConfig may return server copy; force the bundled defaults instead
    const res = await fetch(new URL("../config/default-config.json", import.meta.url));
    config = await res.json();
    ensureCards(config);
    fillForm();
    await save();
    void fresh;
  });
  $("btn-export").addEventListener("click", () => {
    const blob = new Blob([exportConfigJson(config)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wwcd-status-config.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("btn-import").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      config = await importConfigJson(text);
      fillForm();
      setStatus("Imported & saved", false);
    } catch (err) {
      alert(String(err?.message || err));
    }
  });
}

async function handleUpload(e, apply, options = {}) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  if (options.imagesOnly && !(file.type || "").startsWith("image/")) {
    alert("Please choose an image file (PNG, JPG, WebP, GIF).");
    return;
  }
  try {
    setStatus("Uploading…", true);
    const { url, mediaType } = await uploadBackground(file);
    await apply(url, mediaType);
    commit();
    setStatus("Uploaded — click Save all settings to sync OBS", true);
  } catch (err) {
    const msg = String(err?.message || err);
    alert(msg.includes("404")
      ? "Upload failed (404). Restart npm run dev so Vite picks up WWCD STATUS API routes, then try again."
      : msg);
    setStatus("Upload failed", true);
  }
}

async function save() {
  try {
    setStatus("Saving…", true);
    const res = await saveConfig(config);
    if (res?.localOnly) setStatus(res.warning || "Saved locally only", true);
    else setStatus("Saved ✓ — refresh OBS browser source", false);
  } catch (err) {
    alert(String(err?.message || err));
    setStatus("Save failed", true);
  }
}

async function init() {
  config = await getConfig();
  ensureCards(config);
  bind();
  fillForm();

  const origin = window.location.origin;
  $("obs-url").textContent = `${origin}/wwcd-status/overlay.html`;
  $("preview-frame").src = "overlay.html";
}

init();
