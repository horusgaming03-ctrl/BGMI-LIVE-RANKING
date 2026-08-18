/* TOP FRAGGERS — admin editor */
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

const ANIM_TYPES = ["staggered", "slideUp", "slideDown", "fadeScale", "flip", "shutter"];

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

function toHex(v, fallback) {
  if (!v || typeof v !== "string") return fallback;
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  return fallback;
}

function renderMediaPreview(id, url) {
  const el = $(id);
  if (!el) return;
  if (!url) {
    el.innerHTML = "";
    return;
  }
  const src = resolveAssetUrl(url);
  if (backgroundMediaType({ imageUrl: url }) === "video") {
    el.innerHTML = `<video src="${src}" muted loop autoplay playsinline style="max-width:100%;max-height:120px"></video>`;
  } else {
    el.innerHTML = `<img src="${src}" alt="" style="max-width:100%;max-height:120px;object-fit:contain" />`;
  }
}

function fillForm() {
  const h = config.header || {};
  $("cfg-title").value = h.title || "";
  $("cfg-title-color").value = toHex(h.titleColor, "#e8c547");
  $("cfg-title-size").value = h.titleSize ?? 132;
  $("cfg-brand-main").value = h.brandMain || "";
  $("cfg-brand-sub").value = h.brandSub || "";
  renderMediaPreview("left-logo-preview", h.leftLogoUrl);
  renderMediaPreview("right-logo-preview", h.rightLogoUrl);

  const f = config.footer || {};
  $("cfg-footer-text").value = f.text || "";
  $("cfg-footer-color").value = toHex(f.color, "#e8c547");
  $("cfg-footer-size").value = f.size ?? 36;
  $("cfg-footer-show").checked = f.show !== false;

  const bg = config.background || {};
  $("cfg-bg-scale").value = Math.round((bg.scale ?? 1.05) * 100);
  $("cfg-bg-scale-val").textContent = `${(bg.scale ?? 1.05).toFixed(2)}×`;
  renderMediaPreview("bg-preview", bg.imageUrl);

  const t = config.theme || {};
  $("cfg-rank-bg").value = toHex(t.rankBadgeBg, "#e8c547");
  $("cfg-rank-text").value = toHex(t.rankBadgeText, "#1a1a1a");
  $("cfg-name-bar").value = toHex(t.nameBarColor, "#e8c547");
  $("cfg-name-text").value = toHex(t.nameTextColor, "#1a1a1a");
  $("cfg-stat-label-bg").value = toHex(t.statLabelBg, "#1a4d7a");
  $("cfg-stat-value").value = toHex(t.statValueColor, "#1a4d7a");
  $("cfg-media-top").value = toHex(t.mediaTintTop, "#1a4d7a");
  $("cfg-media-bottom").value = toHex(t.mediaTintBottom, "#0a2840");
  $("cfg-card-accent").value = toHex(t.cardAccentLine, "#2a9fd4");

  const a = config.animation || {};
  const sel = $("cfg-anim-type");
  sel.innerHTML = ANIM_TYPES.map((x) => `<option value="${x}">${x}</option>`).join("");
  sel.value = a.type || "staggered";
  $("cfg-anim-speed").value = a.speed ?? 1;
  $("cfg-anim-speed-val").textContent = a.speed ?? 1;
  $("cfg-anim-enabled").checked = a.enabled !== false;

  $("cfg-data-source").value = config.dataSource === "manual" ? "manual" : "live";
  $("cfg-card-count").value = String(config.cardCount || 5);

  renderPlayerStatsRow();
  renderCharGrid();
}

function renderPlayerStatsRow() {
  const row = $("player-stats-row");
  if (!row) return;
  row.innerHTML = "";
  ensureCards(config);
  config.cards.forEach((card, i) => {
    const col = document.createElement("div");
    col.className = "player-stats-col";
    const manual = card.manualName || card.manualFinishes;
    col.innerHTML = `
      <div class="player-stats-col__head">#${i + 1}${manual ? ' <span class="player-stats-override">manual</span>' : ""}</div>
      <div class="field"><label>Player name</label><input type="text" value="${escapeAttr(card.name || "")}" data-char-name="${i}" /></div>
      <div class="field"><label>Finishes</label><input type="number" min="0" value="${Number(card.finishes) || 0}" data-char-fin="${i}" /></div>
      <button type="button" class="btn" data-char-use-live="${i}" ${manual ? "" : "disabled"}>Use live</button>`;
    row.appendChild(col);
  });
  bindPlayerStatInputs(row);
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function charTransformCss(tf) {
  const zoom = Number(tf?.zoom) || 1;
  const sx = (Number(tf?.stretchX) || 1) * zoom;
  const sy = (Number(tf?.stretchY) || 1) * zoom;
  const x = Number(tf?.x) || 0;
  const y = Number(tf?.y) || 0;
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
      renderPlayerStatsRow();
    }),
  );
  root.querySelectorAll("[data-char-fin]").forEach((inp) =>
    inp.addEventListener("input", (e) => {
      const i = Number(e.target.dataset.charFin);
      config.cards[i].finishes = Number(e.target.value) || 0;
      config.cards[i].manualFinishes = true;
      commit();
      renderPlayerStatsRow();
    }),
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
    }),
  );
}

function renderCharGrid() {
  ensureCards(config);
  const grid = $("char-grid");
  grid.innerHTML = "";
  config.cards.forEach((card, i) => {
    if (!card.transform) card.transform = defaultTransform();
    const tf = card.transform;
    const wrap = document.createElement("div");
    wrap.className = "char-card";
    const src = card.characterImageUrl
      ? resolveAssetUrl(card.characterImageUrl)
      : `../wwcd-status/assets/characters/char-${i % 4}.png`;
    const zoomPct = Math.round((Number(tf.zoom) || 1) * 100);
    const sxPct = Math.round((Number(tf.stretchX) || 1) * 100);
    const syPct = Math.round((Number(tf.stretchY) || 1) * 100);
    const px = Math.round(Number(tf.x) || 0);
    const py = Math.round(Number(tf.y) || 0);
    wrap.innerHTML = `
      <h3>#${i + 1}</h3>
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
      <button type="button" class="btn" data-char-reset-adjust="${i}">Reset adjust</button>`;
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
      const lbl = grid.querySelector(`[data-val="${tfValLabel[key]}-${i}"]`);
      if (lbl) lbl.textContent = `${Math.round(raw)}%`;
      applyThumbTransform(i);
      commit();
    }),
  );
  grid.querySelectorAll("[data-char-reset-adjust]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.charResetAdjust);
      config.cards[i].transform = defaultTransform();
      renderCharGrid();
      commit();
    }),
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
        commit();
      } catch (err) {
        alert(String(err?.message || err));
      }
    }),
  );
  grid.querySelectorAll("[data-char-clear]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.charClear);
      config.cards[i].characterImageUrl = "";
      renderCharGrid();
      commit();
    }),
  );
}

function bind() {
  $("cfg-title").addEventListener("input", (e) => {
    config.header.title = e.target.value;
    commit();
  });
  $("cfg-title-color").addEventListener("input", (e) => {
    config.header.titleColor = e.target.value;
    commit();
  });
  $("cfg-title-size").addEventListener("input", (e) => {
    config.header.titleSize = Number(e.target.value) || 132;
    commit();
  });
  $("cfg-brand-main").addEventListener("input", (e) => {
    config.header.brandMain = e.target.value;
    commit();
  });
  $("cfg-brand-sub").addEventListener("input", (e) => {
    config.header.brandSub = e.target.value;
    commit();
  });

  $("cfg-footer-text").addEventListener("input", (e) => {
    config.footer.text = e.target.value;
    commit();
  });
  $("cfg-footer-color").addEventListener("input", (e) => {
    config.footer.color = e.target.value;
    commit();
  });
  $("cfg-footer-size").addEventListener("input", (e) => {
    config.footer.size = Number(e.target.value) || 36;
    commit();
  });
  $("cfg-footer-show").addEventListener("change", (e) => {
    config.footer.show = e.target.checked;
    commit();
  });

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
  $("cfg-bg-upload").addEventListener("change", (e) =>
    handleUpload(e, async (url, mediaType) => {
      config.background.imageUrl = url;
      config.background.mediaType = mediaType || "image";
      renderMediaPreview("bg-preview", url);
    }),
  );

  $("cfg-left-logo-upload").addEventListener("change", (e) =>
    handleUpload(
      e,
      async (url) => {
        config.header.leftLogoUrl = url;
        renderMediaPreview("left-logo-preview", url);
      },
      { imagesOnly: true },
    ),
  );
  $("cfg-left-logo-clear").addEventListener("click", () => {
    config.header.leftLogoUrl = "";
    renderMediaPreview("left-logo-preview", "");
    commit();
  });
  $("cfg-right-logo-upload").addEventListener("change", (e) =>
    handleUpload(
      e,
      async (url) => {
        config.header.rightLogoUrl = url;
        renderMediaPreview("right-logo-preview", url);
      },
      { imagesOnly: true },
    ),
  );
  $("cfg-right-logo-clear").addEventListener("click", () => {
    config.header.rightLogoUrl = "";
    renderMediaPreview("right-logo-preview", "");
    commit();
  });

  const applyMediaTint = () => {
    const top = $("cfg-media-top").value;
    const bottom = $("cfg-media-bottom").value;
    config.theme.mediaTintTop = top;
    config.theme.mediaTintBottom = bottom;
    config.theme.mediaTint = `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
    commit();
  };
  $("cfg-rank-bg").addEventListener("input", (e) => {
    config.theme.rankBadgeBg = e.target.value;
    commit();
  });
  $("cfg-rank-text").addEventListener("input", (e) => {
    config.theme.rankBadgeText = e.target.value;
    commit();
  });
  $("cfg-name-bar").addEventListener("input", (e) => {
    config.theme.nameBarColor = e.target.value;
    commit();
  });
  $("cfg-name-text").addEventListener("input", (e) => {
    config.theme.nameTextColor = e.target.value;
    commit();
  });
  $("cfg-stat-label-bg").addEventListener("input", (e) => {
    config.theme.statLabelBg = e.target.value;
    commit();
  });
  $("cfg-stat-value").addEventListener("input", (e) => {
    config.theme.statValueColor = e.target.value;
    commit();
  });
  $("cfg-media-top").addEventListener("input", applyMediaTint);
  $("cfg-media-bottom").addEventListener("input", applyMediaTint);
  $("cfg-card-accent").addEventListener("input", (e) => {
    config.theme.cardAccentLine = e.target.value;
    commit();
  });

  $("cfg-anim-type").addEventListener("change", (e) => {
    config.animation.type = e.target.value;
    commit();
  });
  $("cfg-anim-speed").addEventListener("input", (e) => {
    config.animation.speed = Number(e.target.value);
    $("cfg-anim-speed-val").textContent = e.target.value;
    commit();
  });
  $("cfg-anim-enabled").addEventListener("change", (e) => {
    config.animation.enabled = e.target.checked;
    commit();
  });

  $("cfg-data-source").addEventListener("change", (e) => {
    config.dataSource = e.target.value === "manual" ? "manual" : "live";
    commit();
  });
  $("cfg-card-count").addEventListener("change", (e) => {
    config.cardCount = Number(e.target.value) || 5;
    ensureCards(config);
    renderPlayerStatsRow();
    renderCharGrid();
    commit();
  });

  $("btn-save-all").addEventListener("click", save);
  $("btn-save-all-sticky").addEventListener("click", save);
  $("btn-replay").addEventListener("click", async () => {
    config.animation.replayKey = (config.animation.replayKey || 0) + 1;
    await save();
  });
  $("btn-reset").addEventListener("click", async () => {
    if (!confirm("Reset all TOP FRAGGERS settings to defaults?")) return;
    localStorage.removeItem("top-fraggers-config");
    const res = await fetch(new URL("../config/default-config.json", import.meta.url));
    config = await res.json();
    ensureCards(config);
    fillForm();
    await save();
  });
  $("btn-export").addEventListener("click", () => {
    const blob = new Blob([exportConfigJson(config)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "top-fraggers-config.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("btn-import").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      config = await importConfigJson(await file.text());
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
    alert("Please choose an image file.");
    return;
  }
  try {
    setStatus("Uploading…", true);
    const { url, mediaType } = await uploadBackground(file);
    await apply(url, mediaType);
    commit();
  } catch (err) {
    alert(String(err?.message || err));
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
  $("obs-url").textContent = `${window.location.origin}/top-fraggers/overlay.html`;
  $("preview-frame").src = "overlay.html";
}

init();
