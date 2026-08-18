import {
  getConfig,
  saveConfig,
  loadDefaultConfig,
  uploadBackground,
  uploadAsset,
  resolveAssetUrl,
  backgroundMediaType,
  exportConfigJson,
  importConfigJson,
  getChannelName,
  ensureFeatured,
  ensureLabels,
} from "./config-store.js";
import { darkenColor } from "./title-colors.js";

let config = null;
let titleOutlineAuto = true;
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

function toHex(v, fallback) {
  if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return fallback;
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
    v.muted = v.loop = v.autoplay = v.playsInline = true;
    el.appendChild(v);
  } else {
    const img = document.createElement("img");
    img.src = resolved;
    el.appendChild(img);
  }
}

function fillForm() {
  const layout = config.layout || {};
  $("cfg-layout-mode").value = layout.mode === "broadcast" ? "broadcast" : "contentOnly";
  $("cfg-show-title").checked = layout.showTitle !== false;
  $("cfg-show-featured").checked = layout.showFeatured !== false;
  $("cfg-show-table-head").checked = layout.showTableHeader !== false;

  const h = config.header || {};
  $("cfg-show-header").checked = h.show === true;
  $("cfg-title").value = h.title || "";
  $("cfg-title-size").value = h.titleSize ?? 112;
  $("cfg-title-color").value = toHex(h.titleColor, "#ffd54a");
  titleOutlineAuto = !h.titleOutlineColor;
  $("cfg-title-outline-color").value = toHex(
    h.titleOutlineColor || darkenColor(h.titleColor || "#ffd54a", 0.72),
    "#001428",
  );
  $("cfg-left-brand").value = h.leftBrand || "";
  $("cfg-left-sub").value = h.leftSubBrand || "";
  $("cfg-footer").value = h.footer || "";
  $("cfg-footer-size").value = h.footerSize ?? 42;
  $("cfg-footer-color").value = toHex(h.footerColor, "#e8c547");

  const bg = config.background || {};
  $("cfg-bg-scale").value = Math.round((bg.scale ?? 1.05) * 100);
  $("cfg-bg-scale-val").textContent = `${(bg.scale ?? 1.05).toFixed(2)}×`;
  renderMediaPreview("bg-preview", bg.imageUrl);

  const t = config.theme || {};
  const L = config.labels || {};
  $("cfg-lbl-pos").value = L.colPos || "POS.";
  $("cfg-lbl-team").value = L.colTeam || "TEAM NAME";
  $("cfg-lbl-wwcd").value = L.colWwcd || "WWCD";
  $("cfg-lbl-place").value = L.colPlace || "PLACE";
  $("cfg-lbl-finish").value = L.colFinish || "FINISH";
  $("cfg-lbl-total").value = L.colTotal || "TOTAL";
  $("cfg-lbl-featured-pts").value = L.featuredPoints || "TOTAL POINTS";

  $("cfg-bg-navy").value = toHex(t.bgNavy, "#001a3d");
  $("cfg-brand-main-color").value = toHex(t.brandMainColor, "#ffffff");
  $("cfg-brand-sub-color").value = toHex(t.brandSubColor, "#ffffff");
  $("cfg-pos-top").value = toHex(t.posBgTop, "#fff2cc");
  $("cfg-pos-bottom").value = toHex(t.posBgBottom, "#ffd54a");
  $("cfg-pos-text").value = toHex(t.posText, "#001a3d");
  $("cfg-pos-leader-top").value = toHex(t.posLeaderTop, "#fff2cc");
  $("cfg-pos-leader-bottom").value = toHex(t.posLeaderBottom, "#ffd54a");
  $("cfg-pos-leader-text").value = toHex(t.posLeaderText, "#001a3d");
  $("cfg-bar-start").value = toHex(t.rowBarStart, "#0047ab");
  $("cfg-bar-end").value = toHex(t.rowBarEnd, "#0d5cb8");
  $("cfg-bar-deep").value = toHex(t.rowBarDeep, "#002850");
  $("cfg-row-text").value = toHex(t.rowText, "#ffffff");
  $("cfg-bar-leader-start").value = toHex(t.rowBarLeaderStart, "#fafafa");
  $("cfg-bar-leader-end").value = toHex(t.rowBarLeaderEnd, "#e8e8e8");
  $("cfg-leader-team-text").value = toHex(t.rowLeaderTeamColor, "#0047ab");
  $("cfg-stat-start").value = toHex(t.statCellStart, "#0a2d52");
  $("cfg-stat-end").value = toHex(t.statCellEnd, "#061a32");
  $("cfg-stat-text").value = toHex(t.statText, "#ffffff");
  $("cfg-leader-stat-start").value = toHex(t.rowLeaderStatStart, "#f4f4f4");
  $("cfg-leader-stat-end").value = toHex(t.rowLeaderStatEnd, "#e6e6e6");
  $("cfg-leader-stat-text").value = toHex(t.rowLeaderStatText, "#001a3d");
  $("cfg-head-bg").value = toHex(t.tableHeadBg, "#fff2cc");
  $("cfg-head-text").value = toHex(t.tableHeadText, "#001a3d");
  $("cfg-featured-cream").value = toHex(t.featuredCream, "#f5ecd8");
  $("cfg-featured-char-top").value = toHex(t.featuredCharGradTop, "#e8dfd0");
  $("cfg-featured-banner-top").value = toHex(t.featuredBannerTop, "#1a6bc4");
  $("cfg-featured-banner").value = toHex(t.featuredBanner, "#0047ab");
  $("cfg-featured-banner-bottom").value = toHex(t.featuredBannerBottom, "#003580");
  $("cfg-featured-banner-text").value = toHex(t.featuredBannerText, "#ffffff");
  $("cfg-featured-points-bg").value = toHex(t.featuredPointsBg, "#fff2cc");
  $("cfg-featured-points-text").value = toHex(t.featuredPointsText, "#001a3d");
  $("cfg-gap-color").value = toHex(t.gapColor, "#000000");
  $("cfg-row-gap").value = t.rowGap ?? 10;
  $("cfg-cell-gap").value = t.cellGap ?? 6;

  const a = config.animation || {};
  $("cfg-anim-speed").value = a.speed ?? 1;
  $("cfg-anim-speed-val").textContent = a.speed ?? 1;
  $("cfg-anim-enabled").checked = a.enabled !== false;

  renderCharGrid();
}

function renderCharGrid() {
  ensureFeatured(config);
  const grid = $("char-grid");
  grid.innerHTML = "";
  const url = config.featured.characterUrls[0] || "";
  const slot = document.createElement("div");
  slot.className = "char-slot";
  const src = url ? resolveAssetUrl(url) : "../wwcd-status/assets/characters/char-0.png";
  slot.innerHTML = `
    <strong>Character image</strong>
    <img src="${src}" alt="" data-char-preview="0" />
    <input type="file" accept="image/*" data-char-upload="0" />
    <button type="button" class="btn" data-char-clear="0" style="margin-top:8px">Use default</button>`;
  grid.appendChild(slot);

  slot.querySelector("[data-char-upload]")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { url: uploaded } = await uploadAsset(file, "asset");
      config.featured.characterUrls[0] = uploaded;
      commit();
      renderCharGrid();
    } catch (err) {
      alert(err.message || String(err));
    }
  });

  slot.querySelector("[data-char-clear]")?.addEventListener("click", () => {
    config.featured.characterUrls[0] = "";
    commit();
    renderCharGrid();
  });
}

function readForm() {
  if (!config.header) config.header = {};
  if (!config.background) config.background = {};
  if (!config.theme) config.theme = {};
  if (!config.labels) config.labels = {};
  if (!config.animation) config.animation = {};
  if (!config.layout) config.layout = {};

  const layout = config.layout;
  layout.mode = $("cfg-layout-mode").value === "broadcast" ? "broadcast" : "contentOnly";
  layout.showFeatured = $("cfg-show-featured").checked;
  layout.showTableHeader = $("cfg-show-table-head").checked;
  layout.dynamicColumns = true;
  layout.showTitle = $("cfg-show-title")?.checked !== false;

  const h = config.header;
  h.show = $("cfg-show-header").checked;
  h.title = $("cfg-title").value.trim() || "STANDINGS";
  h.titleSize = Number($("cfg-title-size").value) || 112;
  h.titleColor = $("cfg-title-color").value;
  h.titleOutlineColor = titleOutlineAuto ? "" : $("cfg-title-outline-color").value;
  h.leftBrand = $("cfg-left-brand").value.trim();
  h.leftSubBrand = $("cfg-left-sub").value.trim();
  h.footer = $("cfg-footer").value.trim();
  h.footerSize = Number($("cfg-footer-size").value) || 42;
  h.footerColor = $("cfg-footer-color").value;

  config.background.scale = Number($("cfg-bg-scale").value) / 100 || 1.05;

  const t = config.theme;
  t.bgNavy = $("cfg-bg-navy").value;
  t.brandMainColor = $("cfg-brand-main-color").value;
  t.brandSubColor = $("cfg-brand-sub-color").value;
  t.posBgTop = $("cfg-pos-top").value;
  t.posBgBottom = $("cfg-pos-bottom").value;
  t.posText = $("cfg-pos-text").value;
  t.posLeaderTop = $("cfg-pos-leader-top").value;
  t.posLeaderBottom = $("cfg-pos-leader-bottom").value;
  t.posLeaderText = $("cfg-pos-leader-text").value;
  t.rowBarStart = $("cfg-bar-start").value;
  t.rowBarEnd = $("cfg-bar-end").value;
  t.rowBarDeep = $("cfg-bar-deep").value;
  t.rowText = $("cfg-row-text").value;
  t.rowBarLeaderStart = $("cfg-bar-leader-start").value;
  t.rowBarLeaderEnd = $("cfg-bar-leader-end").value;
  t.rowLeaderTeamColor = $("cfg-leader-team-text").value;
  t.statCellStart = $("cfg-stat-start").value;
  t.statCellEnd = $("cfg-stat-end").value;
  t.statText = $("cfg-stat-text").value;
  t.rowLeaderStatStart = $("cfg-leader-stat-start").value;
  t.rowLeaderStatEnd = $("cfg-leader-stat-end").value;
  t.rowLeaderStatText = $("cfg-leader-stat-text").value;
  t.tableHeadBg = $("cfg-head-bg").value;
  t.tableHeadText = $("cfg-head-text").value;
  t.featuredCream = $("cfg-featured-cream").value;
  t.featuredCharGradTop = $("cfg-featured-char-top").value;
  t.featuredBannerTop = $("cfg-featured-banner-top").value;
  t.featuredBanner = $("cfg-featured-banner").value;
  t.featuredBannerBottom = $("cfg-featured-banner-bottom").value;
  t.featuredBannerText = $("cfg-featured-banner-text").value;
  t.featuredPointsBg = $("cfg-featured-points-bg").value;
  t.featuredPointsText = $("cfg-featured-points-text").value;
  t.gapColor = $("cfg-gap-color").value;
  t.rowGap = Number($("cfg-row-gap").value) || 10;
  t.cellGap = Number($("cfg-cell-gap").value) || 6;

  const L = config.labels;
  L.colPos = $("cfg-lbl-pos").value.trim() || "POS.";
  L.colTeam = $("cfg-lbl-team").value.trim() || "TEAM NAME";
  L.colWwcd = $("cfg-lbl-wwcd").value.trim() || "WWCD";
  L.colPlace = $("cfg-lbl-place").value.trim() || "PLACE";
  L.colFinish = $("cfg-lbl-finish").value.trim() || "FINISH";
  L.colTotal = $("cfg-lbl-total").value.trim() || "TOTAL";
  L.featuredPoints = $("cfg-lbl-featured-pts").value.trim() || "TOTAL POINTS";

  config.animation.speed = Number($("cfg-anim-speed").value) || 1;
  config.animation.enabled = $("cfg-anim-enabled").checked;
}

function bindInputs() {
  const ids = [
    "cfg-layout-mode", "cfg-show-title", "cfg-show-featured", "cfg-show-table-head",
    "cfg-show-header", "cfg-title", "cfg-title-size", "cfg-title-color", "cfg-title-outline-color",
    "cfg-left-brand", "cfg-left-sub", "cfg-footer", "cfg-footer-size", "cfg-footer-color",
    "cfg-bg-scale",
    "cfg-lbl-pos", "cfg-lbl-team", "cfg-lbl-wwcd", "cfg-lbl-place", "cfg-lbl-finish", "cfg-lbl-total", "cfg-lbl-featured-pts",
    "cfg-bg-navy", "cfg-brand-main-color", "cfg-brand-sub-color",
    "cfg-pos-top", "cfg-pos-bottom", "cfg-pos-text", "cfg-pos-leader-top", "cfg-pos-leader-bottom", "cfg-pos-leader-text",
    "cfg-bar-start", "cfg-bar-end", "cfg-bar-deep", "cfg-row-text",
    "cfg-bar-leader-start", "cfg-bar-leader-end", "cfg-leader-team-text",
    "cfg-stat-start", "cfg-stat-end", "cfg-stat-text",
    "cfg-leader-stat-start", "cfg-leader-stat-end", "cfg-leader-stat-text",
    "cfg-head-bg", "cfg-head-text",
    "cfg-featured-cream", "cfg-featured-char-top", "cfg-featured-banner-top", "cfg-featured-banner", "cfg-featured-banner-bottom",
    "cfg-featured-banner-text", "cfg-featured-points-bg", "cfg-featured-points-text",
    "cfg-gap-color", "cfg-row-gap", "cfg-cell-gap",
    "cfg-anim-speed", "cfg-anim-enabled",
  ];
  ids.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", () => {
      if (id === "cfg-title-outline-color") titleOutlineAuto = false;
      if (id === "cfg-title-color" && titleOutlineAuto) {
        $("cfg-title-outline-color").value = toHex(darkenColor($("cfg-title-color").value, 0.72), "#001428");
      }
      readForm();
      if (id === "cfg-bg-scale") $("cfg-bg-scale-val").textContent = `${config.background.scale.toFixed(2)}×`;
      if (id === "cfg-anim-speed") $("cfg-anim-speed-val").textContent = config.animation.speed;
      commit();
    });
    el.addEventListener("change", () => {
      readForm();
      commit();
    });
  });

  $("cfg-title-outline-auto")?.addEventListener("click", () => {
    titleOutlineAuto = true;
    $("cfg-title-outline-color").value = toHex(darkenColor($("cfg-title-color").value, 0.72), "#001428");
    readForm();
    commit();
  });

  $("cfg-bg-upload")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { url, mediaType } = await uploadBackground(file);
      config.background.imageUrl = url;
      config.background.mediaType = mediaType || "image";
      renderMediaPreview("bg-preview", url);
      commit();
    } catch (err) {
      alert(err.message || String(err));
    }
  });

  $("cfg-bg-clear")?.addEventListener("click", () => {
    config.background.imageUrl = "";
    renderMediaPreview("bg-preview", "");
    commit();
  });

  const logoUpload = async (file, key) => {
    const { url } = await uploadAsset(file, "asset");
    config.header[key] = url;
    commit();
  };

  $("cfg-left-logo-upload")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await logoUpload(file, "leftLogoUrl");
    } catch (err) {
      alert(err.message || String(err));
    }
  });
  $("cfg-left-logo-clear")?.addEventListener("click", () => {
    config.header.leftLogoUrl = "";
    commit();
  });
  $("cfg-right-logo-upload")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await logoUpload(file, "rightLogoUrl");
    } catch (err) {
      alert(err.message || String(err));
    }
  });
  $("cfg-right-logo-clear")?.addEventListener("click", () => {
    config.header.rightLogoUrl = "";
    commit();
  });
}

async function doSave() {
  readForm();
  try {
    await saveConfig(config);
    setStatus("Saved — refresh OBS browser source if needed", false);
  } catch (e) {
    setStatus(e.message || "Save failed", true);
    alert(e.message || "Save failed");
  }
}

async function init() {
  config = await getConfig();
  ensureLabels(config);
  fillForm();
  bindInputs();

  const saveBtns = ["btn-save-all", "btn-save-all-sticky"];
  saveBtns.forEach((id) => $(id)?.addEventListener("click", () => void doSave()));

  $("btn-export")?.addEventListener("click", () => {
    readForm();
    const blob = new Blob([exportConfigJson(config)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "overall-standing-config.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("btn-import")?.addEventListener("click", () => $("import-file").click());
  $("import-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      config = await importConfigJson(text);
      fillForm();
      setStatus("Imported — saved to server", false);
    } catch (err) {
      alert(err.message || String(err));
    }
  });

  $("btn-reset")?.addEventListener("click", async () => {
    if (!confirm("Reset all settings to defaults?")) return;
    config = await loadDefaultConfig();
    ensureFeatured(config);
    ensureLabels(config);
    await saveConfig(config);
    fillForm();
    setStatus("Reset to defaults", false);
  });

  $("btn-replay")?.addEventListener("click", () => {
    if (!config.animation) config.animation = {};
    config.animation.replayKey = (config.animation.replayKey || 0) + 1;
    commit();
  });

  const origin = window.location.origin;
  $("obs-url").textContent = `${origin}/overall-standing/overlay.html`;
  $("preview-frame").src = `${origin}/overall-standing/overlay.html`;
}

init();
