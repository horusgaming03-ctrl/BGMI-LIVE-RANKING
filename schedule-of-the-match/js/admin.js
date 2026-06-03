import {
  getConfig,
  saveConfig,
  loadDefaultConfig,
  exportConfigJson,
  importConfigJson,
  ensureMatchSlots,
  uploadScheduleBackground,
  compressImageFile,
  resolveScheduleAssetUrl,
  probeBackgroundFile,
  scheduleBackgroundMediaType,
  getScheduleApiBase,
} from "./config-store.js";
import {
  fetchLiveTournamentState,
  matchNumberFromCard,
  shouldShowWwcdForCard,
  resolveWwcdTeamForMatch,
} from "./schedule-live.js";
import { wireLoopingVideo } from "./schedule-bg-render.js";
import { MAP_CATALOG, MAP_KEYS, normalizeMatchMaps, normalizeMapKey } from "./map-catalog.js";
import { ANIMATION_TYPES } from "./animations.js";

const $ = (sel) => document.querySelector(sel);

let state = null;
let selectedMatchIndex = 0;
let liveTournament = { number: 1, status: "live", teams: [], history: [] };

const els = {
  title: $("#cfg-title"),
  subtitle: $("#cfg-subtitle"),
  titleFont: $("#cfg-title-font"),
  subtitleFont: $("#cfg-subtitle-font"),
  titleColor: $("#cfg-title-color"),
  subtitleColor: $("#cfg-subtitle-color"),
  titleSize: $("#cfg-title-size"),
  subtitleSize: $("#cfg-subtitle-size"),
  posX: $("#cfg-pos-x"),
  posY: $("#cfg-pos-y"),
  matchCount: $("#cfg-match-count"),
  bgUpload: $("#cfg-bg-upload"),
  bgClear: $("#cfg-bg-clear"),
  cardBg: $("#cfg-card-bg"),
  cardBorder: $("#cfg-card-border"),
  borderWidth: $("#cfg-border-width"),
  accent: $("#cfg-accent"),
  mapLabelColor: $("#cfg-map-label-color"),
  mapLabelBg: $("#cfg-map-label-bg"),
  mapLabelFont: $("#cfg-map-label-font"),
  footerText: $("#cfg-footer-text"),
  footerTime: $("#cfg-footer-time"),
  animType: $("#cfg-anim-type"),
  animSpeed: $("#cfg-anim-speed"),
  animEnabled: $("#cfg-anim-enabled"),
  winnerIndex: $("#cfg-winner-index"),
  winnerTeam: $("#cfg-winner-team"),
  winnerInitials: $("#cfg-winner-initials"),
  showChicken: $("#cfg-show-chicken"),
  winnerGroup: $("#cfg-winner-group"),
  wwcdArtUpload: $("#cfg-wwcd-art-upload"),
  wwcdArtClear: $("#cfg-wwcd-art-clear"),
  matchesContainer: $("#matches-container"),
  matchTabs: $("#match-tabs"),
  matchEditingLabel: $("#match-editing-label"),
  addMatch: $("#btn-add-match"),
  removeMatch: $("#btn-remove-match"),
  obsUrl: $("#obs-url"),
  preview: $("#preview-frame"),
  exportBtn: $("#btn-export"),
  importBtn: $("#btn-import"),
  importFile: $("#import-file"),
  resetBtn: $("#btn-reset"),
  replayBtn: $("#btn-replay"),
  saveBtn: $("#btn-save-all"),
  saveBtnSticky: $("#btn-save-all-sticky"),
  saveStatus: $("#save-status"),
  bgPreview: $("#bg-preview"),
  bgScale: $("#cfg-bg-scale"),
  bgScaleVal: $("#cfg-bg-scale-val"),
  animSpeedVal: $("#cfg-anim-speed-val"),
  cardGap: $("#cfg-card-gap"),
  cardsPadX: $("#cfg-cards-pad-x"),
  cardWidth: $("#cfg-card-width"),
  cardMediaH: $("#cfg-card-media-h"),
  cardsOffsetY: $("#cfg-cards-offset-y"),
  headerReserve: $("#cfg-header-reserve"),
};

const FONT_OPTIONS = [
  "Bebas Neue",
  "Anton",
  "Teko",
  "Oswald",
  "Rajdhani",
  "Orbitron",
  "Exo 2",
  "Agency FB",
  "Eurostile",
];

function fillFontSelect(select) {
  FONT_OPTIONS.forEach((f) => {
    const o = document.createElement("option");
    o.value = f;
    o.textContent = f;
    select.appendChild(o);
  });
}

function fillAnimationSelect() {
  ANIMATION_TYPES.forEach((a) => {
    const o = document.createElement("option");
    o.value = a.id;
    o.textContent = a.label;
    els.animType.appendChild(o);
  });
}

function overlayUrl() {
  const u = new URL("overlay.html", window.location.href);
  return u.href;
}

function readForm() {
  state.header.title = els.title.value;
  state.header.subtitle = els.subtitle.value;
  state.header.titleFont = els.titleFont.value;
  state.header.subtitleFont = els.subtitleFont.value;
  state.header.titleColor = els.titleColor.value;
  state.header.subtitleColor = els.subtitleColor.value;
  state.header.titleSize = Number(els.titleSize.value);
  state.header.subtitleSize = Number(els.subtitleSize.value);
  state.header.position.x = Number(els.posX.value);
  state.header.position.y = Number(els.posY.value);

  state.matchCount = Number(els.matchCount.value);
  ensureMatchSlots(state);

  state.theme.cardBackground = els.cardBg.value;
  state.theme.cardBorderColor = els.cardBorder.value;
  state.theme.cardBorderWidth = Number(els.borderWidth.value);
  state.theme.accentColor = els.accent.value;
  state.theme.mapLabelColor = els.mapLabelColor.value;
  state.theme.mapLabelBgColor = els.mapLabelBg.value;
  state.theme.mapLabelFont = els.mapLabelFont.value;
  state.theme.footerTextColor = els.footerText.value;
  state.theme.footerTimeColor = els.footerTime.value;

  state.animation.type = els.animType.value;
  state.animation.speed = Number(els.animSpeed.value);
  state.animation.enabled = els.animEnabled.checked;

  if (!state.winner) state.winner = {};
  if (els.winnerIndex) state.winner.matchIndex = Number(els.winnerIndex.value);
  if (els.winnerTeam) state.winner.teamName = els.winnerTeam.value;
  if (els.winnerInitials) state.winner.teamInitials = els.winnerInitials.value;
  if (els.showChicken) state.winner.showChickenDinner = els.showChicken.checked;
  if (els.winnerGroup) state.winner.groupLabel = els.winnerGroup.value?.trim() || "GROUP - A&B";

  if (!state.layout) state.layout = {};
  if (els.cardGap) state.layout.cardGap = Number(els.cardGap.value);
  if (els.cardsPadX) state.layout.cardsPaddingX = Number(els.cardsPadX.value);
  if (els.cardWidth) state.layout.cardWidth = Number(els.cardWidth.value);
  if (els.cardMediaH) state.layout.cardMediaHeight = Number(els.cardMediaH.value);
  if (els.cardsOffsetY) state.layout.cardsOffsetY = Number(els.cardsOffsetY.value);
  if (els.headerReserve) state.layout.headerReserveTop = Number(els.headerReserve.value);

  if (!state.background) state.background = { imageUrl: "", mediaType: "image", opacity: 1, fit: "cover" };
  const scalePct = Number(els.bgScale?.value ?? 112);
  state.background.scale = Math.max(1, Math.min(1.4, scalePct / 100));
  if (!state.background.mediaType && state.background.imageUrl) {
    state.background.mediaType = scheduleBackgroundMediaType(state.background);
  }

  return state;
}

function setSaveStatus(text, ok = true) {
  if (!els.saveStatus) return;
  els.saveStatus.textContent = text;
  els.saveStatus.classList.toggle("status-dot", ok);
  els.saveStatus.classList.toggle("status-dot-off", !ok);
}

function updateBgPreview(url, mediaType) {
  if (!els.bgPreview) return;
  if (!url) {
    els.bgPreview.innerHTML = '<span class="hint">No background saved yet.</span>';
    return;
  }
  const src = resolveScheduleAssetUrl(url);
  const safe = src.replace(/"/g, "&quot;");
  const isVideo = mediaType === "video" || scheduleBackgroundMediaType({ imageUrl: url, mediaType });
  els.bgPreview.replaceChildren();
  if (isVideo) {
    const video = wireLoopingVideo(document.createElement("video"));
    video.src = src;
    els.bgPreview.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Background preview";
    els.bgPreview.appendChild(img);
  }
}

async function persist() {
  readForm();
  try {
    const result = await saveConfig(state);
    if (result?.localOnly) {
      setSaveStatus("Saved in browser · " + (result.warning || ""), false);
    } else {
      setSaveStatus("Saved to server · " + new Date().toLocaleTimeString(), true);
    }
    notifyOverlay();
  } catch (e) {
    setSaveStatus("Save failed: " + (e?.message || e), false);
    console.error(e);
  }
}

function notifyOverlay() {
  try {
    const ch = new BroadcastChannel("schedule-of-the-match-sync");
    ch.postMessage({ type: "config", config: state });
    ch.close();
  } catch {
    /* ignore */
  }
  if (els.preview?.contentWindow) {
    try {
      els.preview.contentWindow.postMessage({ type: "som-reload", config: state }, "*");
    } catch {
      /* ignore */
    }
  }
  window.parent?.postMessage?.({ type: "som-reload", config: state }, "*");
}

function clampSelectedMatch() {
  const count = Math.max(1, Math.min(8, Number(state.matchCount) || 1));
  state.matchCount = count;
  if (selectedMatchIndex >= count) selectedMatchIndex = count - 1;
  if (selectedMatchIndex < 0) selectedMatchIndex = 0;
}

function renderMatchTabs() {
  if (!els.matchTabs) return;
  clampSelectedMatch();
  const count = Number(state.matchCount);
  els.matchTabs.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const m = state.matches[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "match-tab" + (i === selectedMatchIndex ? " active" : "");
    if (shouldShowWwcdForCard(m, i, liveTournament)) btn.classList.add("is-wwcd");
    btn.textContent = m.matchNumber || `M${i + 1}`;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", i === selectedMatchIndex ? "true" : "false");
    btn.addEventListener("click", () => {
      selectedMatchIndex = i;
      renderMatchTabs();
      renderSingleMatchEditor(i);
    });
    els.matchTabs.appendChild(btn);
  }
  if (els.matchEditingLabel) {
    els.matchEditingLabel.textContent = `Match ${selectedMatchIndex + 1}`;
  }
  if (els.matchCount) els.matchCount.value = String(count);
}

function liveWwcdHintForMatch(i) {
  const m = state.matches[i];
  const num = matchNumberFromCard(m, i);
  const cur = Number(liveTournament.number) || 1;
  const status = String(liveTournament.status || "live").toLowerCase();
  const show = shouldShowWwcdForCard(m, i, liveTournament);
  if (show) {
    const team = resolveWwcdTeamForMatch(num, liveTournament);
    const name = team?.team || "—";
    return `WWCD active — winner from live data: <strong>${esc(name)}</strong> (rank #1). Logo loads from team registration.`;
  }
  if (num === cur && status === "live") {
    return `Live match #${cur} in progress — WWCD chicken appears here when this match ends.`;
  }
  if (num > cur) {
    return `Scheduled (tournament on match #${cur}) — WWCD shows after this match is played.`;
  }
  return `WWCD will appear when match #${num} is completed in the tournament panel.`;
}

function matchEditorHtml(i) {
  const m = state.matches[i];
  return `
      <h3>Match ${i + 1} of ${state.matchCount}</h3>
      <div class="field-row">
        <div class="field"><label>Match number</label><input type="text" data-k="matchNumber" data-i="${i}" value="${esc(m.matchNumber)}" /></div>
        <div class="field"><label>Match time</label><input type="text" data-k="matchTime" data-i="${i}" value="${esc(m.matchTime)}" /></div>
      </div>
      <div class="field">
        <label>Map</label>
        <select data-k="mapKey" data-i="${i}">
          ${MAP_KEYS.map((k) => `<option value="${k}" ${normalizeMapKey(m.mapKey) === k ? "selected" : ""}>${MAP_CATALOG[k].label}</option>`).join("")}
        </select>
        <p class="hint" style="margin-top:6px">On-card label: <strong>${esc(MAP_CATALOG[normalizeMapKey(m.mapKey)]?.displayName || "ERANGEL")}</strong></p>
      </div>
      <div class="field"><label>Map image override (optional)</label><input type="url" data-k="mapImageUrl" data-i="${i}" value="${esc(m.mapImageUrl || "")}" placeholder="https://..." /></div>
      <div class="field"><label>Custom map upload</label><input type="file" accept="image/*" data-upload-map="${i}" /></div>
      <p class="hint" id="live-wwcd-hint">${liveWwcdHintForMatch(i)}</p>
      <div class="checkbox-field"><input type="checkbox" data-k="showRankBadge" data-i="${i}" ${m.showRankBadge ? "checked" : ""} /><label>Rank badge</label></div>
      <div class="field"><label>Rank badge text</label><input type="text" data-k="rankBadgeText" data-i="${i}" value="${esc(m.rankBadgeText || "")}" placeholder="#1" /></div>
    `;
}

function wireSingleMatchEditorEvents() {
  if (!els.matchesContainer) return;

  els.matchesContainer.querySelectorAll("[data-k]").forEach((input) => {
    const ev = input.type === "checkbox" ? "change" : "input";
    input.addEventListener(ev, () => {
      const i = Number(input.dataset.i);
      const k = input.dataset.k;
      if (input.type === "checkbox") state.matches[i][k] = input.checked;
      else state.matches[i][k] = input.value;
      if (k === "mapKey") {
        state.matches[i].mapName = MAP_CATALOG[input.value]?.displayName || state.matches[i].mapName;
        void persist();
        renderMatchTabs();
        renderSingleMatchEditor(i);
        return;
      }
      if (k === "matchNumber") {
        renderMatchTabs();
      }
      void persist();
    });
  });

  els.matchesContainer.querySelectorAll("[data-upload-map]").forEach((input) => {
    input.addEventListener("change", () => fileToDataUrl(input.files[0], (url) => {
      const i = Number(input.dataset.uploadMap);
      state.matches[i].mapImageUrl = url;
      void persist();
      renderSingleMatchEditor(i);
    }));
  });

}

function renderSingleMatchEditor(i) {
  if (!els.matchesContainer) return;
  els.matchesContainer.innerHTML = matchEditorHtml(i);
  wireSingleMatchEditorEvents();
}

function bindMatchEditors() {
  renderMatchTabs();
  renderSingleMatchEditor(selectedMatchIndex);
}

function addOneMatch() {
  const n = Math.min(8, Number(state.matchCount) + 1);
  state.matchCount = n;
  ensureMatchSlots(state);
  selectedMatchIndex = n - 1;
  if (els.matchCount) els.matchCount.value = String(n);
  bindMatchEditors();
  void persist();
}

function removeLastMatch() {
  const n = Math.max(1, Number(state.matchCount) - 1);
  state.matchCount = n;
  ensureMatchSlots(state);
  clampSelectedMatch();
  if (els.matchCount) els.matchCount.value = String(n);
  bindMatchEditors();
  void persist();
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function fileToDataUrl(file, cb) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => cb(reader.result);
  reader.readAsDataURL(file);
}

function populateForm() {
  const h = state.header;
  els.title.value = h.title;
  els.subtitle.value = h.subtitle;
  els.titleFont.value = h.titleFont;
  els.subtitleFont.value = h.subtitleFont;
  els.titleColor.value = h.titleColor;
  els.subtitleColor.value = h.subtitleColor;
  els.titleSize.value = h.titleSize;
  els.subtitleSize.value = h.subtitleSize;
  els.posX.value = h.position?.x ?? 72;
  els.posY.value = h.position?.y ?? 48;

  els.matchCount.value = state.matchCount;
  const L = state.layout || {};
  if (els.cardGap) els.cardGap.value = L.cardGap ?? 22;
  if (els.cardsPadX) els.cardsPadX.value = L.cardsPaddingX ?? 64;
  if (els.cardWidth) els.cardWidth.value = L.cardWidth ?? 248;
  if (els.cardMediaH) els.cardMediaH.value = L.cardMediaHeight ?? 336;
  if (els.cardsOffsetY) els.cardsOffsetY.value = L.cardsOffsetY ?? 48;
  if (els.headerReserve) els.headerReserve.value = L.headerReserveTop ?? 200;
  els.cardBg.value = state.theme.cardBackground;
  els.cardBorder.value = state.theme.cardBorderColor;
  els.borderWidth.value = state.theme.cardBorderWidth;
  els.accent.value = state.theme.accentColor;
  els.mapLabelColor.value = state.theme.mapLabelColor;
  els.mapLabelBg.value = state.theme.mapLabelBgColor;
  els.mapLabelFont.value = state.theme.mapLabelFont;
  els.footerText.value = state.theme.footerTextColor;
  els.footerTime.value = state.theme.footerTimeColor;

  els.animType.value = state.animation.type;
  els.animSpeed.value = state.animation.speed;
  els.animEnabled.checked = state.animation.enabled !== false;

  if (els.winnerIndex) els.winnerIndex.value = state.winner.matchIndex;
  if (els.winnerTeam) els.winnerTeam.value = state.winner.teamName || "";
  if (els.winnerInitials) els.winnerInitials.value = state.winner.teamInitials || "";
  if (els.showChicken) els.showChicken.checked = !!state.winner.showChickenDinner;
  if (els.winnerGroup) els.winnerGroup.value = state.winner.groupLabel || "GROUP - A&B";

  els.obsUrl.textContent = overlayUrl();
  els.preview.src = overlayUrl();
  if (els.animSpeedVal) els.animSpeedVal.textContent = String(state.animation?.speed ?? 1);
  updateBgPreview(state.background?.imageUrl || "", state.background?.mediaType);
  if (!state.background) state.background = { imageUrl: "", opacity: 1, fit: "cover", scale: 1.05 };
  if (state.background.scale == null) state.background.scale = 1.05;
  if (els.bgScale) els.bgScale.value = Math.round((state.background.scale || 1.05) * 100);
  if (els.bgScaleVal) els.bgScaleVal.textContent = (state.background.scale || 1.05).toFixed(2) + "×";

  bindMatchEditors();
}

function wireEvents() {
  [
    els.title, els.subtitle, els.titleFont, els.subtitleFont,
    els.titleColor, els.subtitleColor, els.titleSize, els.subtitleSize,
    els.posX, els.posY, els.matchCount, els.cardBg, els.cardBorder,
    els.borderWidth, els.accent, els.mapLabelColor, els.mapLabelBg,
    els.mapLabelFont, els.footerText, els.footerTime, els.animType,
    els.animSpeed, els.animEnabled, els.winnerIndex, els.winnerTeam,
    els.winnerInitials, els.showChicken, els.winnerGroup,
    els.cardGap, els.cardsPadX, els.cardWidth, els.cardMediaH, els.cardsOffsetY, els.headerReserve,
    els.bgScale,
  ].forEach((el) => {
    el?.addEventListener("input", () => {
      if (el === els.matchCount) {
        ensureMatchSlots(state);
        clampSelectedMatch();
        bindMatchEditors();
      }
      if (el === els.bgScale && els.bgScaleVal) {
        els.bgScaleVal.textContent = (Number(els.bgScale.value) / 100).toFixed(2) + "×";
      }
      void persist();
    });
    el?.addEventListener("change", () => void persist());
  });

  els.bgUpload?.addEventListener("change", async () => {
    const file = els.bgUpload.files?.[0];
    if (!file) return;
    if (!state.background) state.background = { imageUrl: "", mediaType: "image", opacity: 1, fit: "cover" };
    setSaveStatus("Uploading background…", true);
    try {
      const probe = await probeBackgroundFile(file);
      if (probe.isVideo) {
        if (!Number.isFinite(probe.duration) || probe.duration < 0.9 || probe.duration > 10.5) {
          setSaveStatus("Video must be between 1 and 10 seconds long.", false);
          els.bgUpload.value = "";
          return;
        }
      }
      const uploaded = await uploadScheduleBackground(file);
      const url = typeof uploaded === "string" ? uploaded : uploaded.url;
      state.background.imageUrl = url;
      state.background.mediaType =
        (typeof uploaded === "object" && uploaded.mediaType) ||
        (probe.isVideo ? "video" : "image");
      if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)) state.background.mediaType = "video";
      updateBgPreview(url, state.background.mediaType);
      await persist();
      setSaveStatus(probe.isVideo ? "Video background saved (loops in OBS)" : "Image background saved", true);
    } catch (e) {
      if ((file.type || "").startsWith("video/")) {
        setSaveStatus("Video upload failed: " + (e?.message || e) + " — start backend on port 3001.", false);
        els.bgUpload.value = "";
        return;
      }
      try {
        const dataUrl = await compressImageFile(file);
        state.background.imageUrl = dataUrl;
        state.background.mediaType = "image";
        updateBgPreview(dataUrl, "image");
        await persist();
        setSaveStatus("Background saved (compressed local fallback)", true);
      } catch (e2) {
        setSaveStatus("Background failed: " + (e?.message || e2?.message || e), false);
      }
    }
  });

  els.bgClear?.addEventListener("click", async () => {
    if (!state.background) state.background = { imageUrl: "", mediaType: "image", opacity: 1, fit: "cover" };
    state.background.imageUrl = "";
    state.background.mediaType = "image";
    els.bgUpload.value = "";
    updateBgPreview("");
    await persist();
  });

  els.wwcdArtUpload?.addEventListener("change", async () => {
    const file = els.wwcdArtUpload.files?.[0];
    if (!file) return;
    if (!state.winner) state.winner = {};
    setSaveStatus("Saving WWCD art…", true);
    try {
      const uploaded = await uploadScheduleBackground(file);
      state.winner.wwcdImageUrl = typeof uploaded === "string" ? uploaded : uploaded.url;
      await persist();
      setSaveStatus("WWCD art uploaded · saved", true);
    } catch (e) {
      try {
        state.winner.wwcdImageUrl = await compressImageFile(file, 800, 0.9);
        await persist();
        setSaveStatus("WWCD art saved (local fallback)", true);
      } catch (e2) {
        setSaveStatus("WWCD art failed: " + (e?.message || e2?.message || e), false);
      }
    }
  });

  els.wwcdArtClear?.addEventListener("click", async () => {
    if (!state.winner) state.winner = {};
    state.winner.wwcdImageUrl = "";
    if (els.wwcdArtUpload) els.wwcdArtUpload.value = "";
    await persist();
    setSaveStatus("WWCD art reset to default", true);
  });

  els.saveBtn?.addEventListener("click", () => void persist());
  els.saveBtnSticky?.addEventListener("click", () => void persist());

  els.replayBtn?.addEventListener("click", async () => {
    readForm();
    state.animation.replayKey = (state.animation.replayKey || 0) + 1;
    await saveConfig(state);
    setSaveStatus("Animation replay sent · " + new Date().toLocaleTimeString(), true);
    notifyOverlay();
  });

  els.animSpeed?.addEventListener("input", () => {
    if (els.animSpeedVal) els.animSpeedVal.textContent = els.animSpeed.value;
  });

  els.exportBtn?.addEventListener("click", () => {
    readForm();
    const blob = new Blob([exportConfigJson(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "schedule-of-the-match-config.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  els.importBtn?.addEventListener("click", () => els.importFile.click());
  els.importFile?.addEventListener("change", async () => {
    const file = els.importFile.files[0];
    if (!file) return;
    const text = await file.text();
    state = await importConfigJson(text);
    populateForm();
    els.importFile.value = "";
  });

  els.addMatch?.addEventListener("click", () => addOneMatch());
  els.removeMatch?.addEventListener("click", () => removeLastMatch());

  els.resetBtn?.addEventListener("click", async () => {
    if (!confirm("Reset all settings to default?")) return;
    state = await loadDefaultConfig();
    ensureMatchSlots(state);
    await saveConfig(state);
    populateForm();
    setSaveStatus("Reset to defaults · saved", true);
  });
}

async function pollLiveTournament() {
  liveTournament = await fetchLiveTournamentState(getScheduleApiBase());
  renderMatchTabs();
  renderSingleMatchEditor(selectedMatchIndex);
}

async function init() {
  fillFontSelect(els.titleFont);
  fillFontSelect(els.subtitleFont);
  fillFontSelect(els.mapLabelFont);
  fillAnimationSelect();

  try {
    state = await getConfig();
  } catch (e) {
    console.error(e);
    state = await loadDefaultConfig();
    setSaveStatus("Loaded defaults — " + (e?.message || e), false);
  }
  ensureMatchSlots(state);
  normalizeMatchMaps(state);
  if (!state.background) state.background = { imageUrl: "", opacity: 1, fit: "cover" };
  selectedMatchIndex = 0;
  populateForm();
  wireEvents();
  await pollLiveTournament();
  setInterval(pollLiveTournament, 2000);
}

init();
