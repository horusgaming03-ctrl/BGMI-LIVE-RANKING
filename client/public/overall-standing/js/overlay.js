import {
  getConfig,
  getApiBase,
  resolveAssetUrl,
  backgroundMediaType,
  subscribeConfig,
} from "./config-store.js";
import { computeColumnSplit } from "./column-split.js";
import { applyTitleColorVars } from "./title-colors.js";

const WWCD_ICON = "/schedule-of-the-match/assets/badges/wwcd-chicken.png";
const DEFAULT_CHAR = "/wwcd-status/assets/characters/char-0.png";

const stage = document.getElementById("os-stage");
const contentEl = document.getElementById("os-content");
const bgFallback = document.getElementById("os-bg-fallback");
const bgLayer = document.getElementById("os-bg-layer");
const headerEl = document.getElementById("os-header");
const brandEl = document.getElementById("os-brand");
const brandSubEl = document.getElementById("os-brand-sub");
const leftLogoEl = document.getElementById("os-left-logo");
const titleEl = document.getElementById("os-title");
const rightLogoEl = document.getElementById("os-right-logo");
const cupBadgeEl = document.getElementById("os-cup-badge");
const featuredEl = document.getElementById("os-featured");
const tableHeadEl = document.getElementById("os-table-head");
const topLeftEl = document.getElementById("os-top-left");
const rightOffsetEl = document.getElementById("os-right-offset");
const pairsEl = document.getElementById("os-pairs");
const standingsTitleEl = document.getElementById("os-standings-title");
const bodyEl = document.getElementById("os-body");
const footerEl = document.getElementById("os-footer");
const emptyEl = document.getElementById("os-empty");

let currentConfig = null;
let teams = [];
let lastDataSig = "";
let lastReplayKey = -1;
let introRevealed = false;

function isContentOnly(config) {
  const mode = config?.layout?.mode;
  return mode !== "broadcast";
}

function applyTheme(config) {
  const t = config.theme || {};
  const set = (k, v) => {
    if (v != null && v !== "") stage.style.setProperty(k, v);
  };
  set("--os-navy", t.bgNavy);
  set("--os-gold", config.header?.titleColor || "#ffd54a");
  set("--os-brand-main", t.brandMainColor);
  set("--os-brand-sub", t.brandSubColor);
  set("--os-pos-top", t.posBgTop);
  set("--os-pos-bottom", t.posBgBottom);
  set("--os-pos-text", t.posText);
  set("--os-pos-leader-top", t.posLeaderTop || t.posBgTop);
  set("--os-pos-leader-bottom", t.posLeaderBottom || t.posBgBottom);
  set("--os-pos-leader-text", t.posLeaderText || t.posText);
  set("--os-bar-start", t.rowBarStart);
  set("--os-bar-end", t.rowBarEnd);
  set("--os-bar-deep", t.rowBarDeep || "#002850");
  set("--os-stat-start", t.statCellStart || t.rowBarStart);
  set("--os-stat-end", t.statCellEnd || "#061a32");
  set("--os-stat-text", t.statText || t.rowText);
  set("--os-bar-leader-start", t.rowBarLeaderStart);
  set("--os-bar-leader-end", t.rowBarLeaderEnd);
  set("--os-row-text", t.rowText);
  set("--os-leader-team", t.rowLeaderTeamColor);
  set("--os-leader-stat-start", t.rowLeaderStatStart);
  set("--os-leader-stat-end", t.rowLeaderStatEnd);
  set("--os-leader-stat-text", t.rowLeaderStatText);
  set("--os-head-bg", t.tableHeadBg);
  set("--os-head-text", t.tableHeadText);
  set("--os-featured-cream", t.featuredCream);
  set("--os-featured-char-top", t.featuredCharGradTop);
  set("--os-featured-banner-top", t.featuredBannerTop);
  set("--os-featured-banner", t.featuredBanner);
  set("--os-featured-banner-bottom", t.featuredBannerBottom);
  set("--os-featured-banner-text", t.featuredBannerText);
  set("--os-featured-points", t.featuredPointsBg);
  set("--os-featured-points-text", t.featuredPointsText);
  set("--os-line", t.divider);
  set("--os-bar-glow", t.barGlow || "rgba(100, 180, 255, 0.45)");
  set("--os-footer-color", config.header?.footerColor || "#e8c547");
  set("--os-row-gap", t.rowGap != null ? `${t.rowGap}px` : "10px");
  set("--os-cell-gap", t.cellGap != null ? `${t.cellGap}px` : "6px");
  set("--os-gap-bg", t.gapColor || "#000000");

  applyTitleColorVars(stage, config.header);

  const speed = Math.max(0.25, Math.min(3, Number(config.animation?.speed) || 1));
  stage.style.setProperty("--os-anim-duration", `${(0.45 / speed).toFixed(3)}s`);
  stage.style.setProperty("--os-slide-duration", `${(0.4 / speed).toFixed(3)}s`);
  stage.style.setProperty("--os-shutter-duration", `${(0.28 / speed).toFixed(3)}s`);
  bodyEl.dataset.animEnabled = config.animation?.enabled !== false ? "1" : "0";
}

function applyLabels(config) {
  const L = config.labels || {};
  const text = (key, fallback) => (L[key] != null && L[key] !== "" ? L[key] : fallback);

  const posEl = tableHeadEl?.querySelector(".os-table-head__pos .os-cell-text");
  const cells = tableHeadEl?.querySelectorAll(".os-table-head__cells > div .os-cell-text");
  if (posEl) posEl.textContent = text("colPos", "POS.");
  if (cells && cells.length >= 5) {
    cells[0].textContent = text("colTeam", "TEAM NAME");
    cells[1].textContent = text("colWwcd", "WWCD");
    cells[2].textContent = text("colPlace", "PLACE");
    cells[3].textContent = text("colFinish", "FINISH");
    cells[4].textContent = text("colTotal", "TOTAL");
  }
}

function applyHeaderBroadcast(config) {
  const h = config.header || {};
  headerEl.classList.toggle("os-hidden", h.show === false);
  titleEl.textContent = h.title || "STANDINGS";
  titleEl.style.fontSize = `${Math.max(48, Number(h.titleSize) || 118)}px`;
  if (h.titleFont) titleEl.style.fontFamily = `"${h.titleFont}", "Bebas Neue", sans-serif`;
  applyTitleColorVars(titleEl, h);

  const leftUrl = h.leftLogoUrl ? resolveAssetUrl(h.leftLogoUrl) : "";
  if (leftUrl) {
    leftLogoEl.src = leftUrl;
    leftLogoEl.classList.remove("os-hidden");
    brandEl.classList.add("os-hidden");
  } else {
    leftLogoEl.classList.add("os-hidden");
    brandEl.classList.remove("os-hidden");
    document.getElementById("os-brand-main").textContent = h.leftBrand || "MEA";
    brandSubEl.textContent = h.leftSubBrand || "MUMBAI ESPORTS";
  }

  const rightUrl = h.rightLogoUrl ? resolveAssetUrl(h.rightLogoUrl) : "";
  if (rightUrl) {
    rightLogoEl.src = rightUrl;
    rightLogoEl.classList.remove("os-hidden");
    cupBadgeEl.classList.add("os-hidden");
  } else {
    rightLogoEl.classList.add("os-hidden");
    cupBadgeEl.classList.remove("os-hidden");
  }

  const footer = h.footer || "";
  footerEl.textContent = footer;
  footerEl.classList.toggle("os-hidden", !footer);
  footerEl.style.fontSize = `${Math.max(20, Number(h.footerSize) || 42)}px`;
}

function applyStandingsTitle(config) {
  const h = config.header || {};
  const layout = config.layout || {};
  const contentOnly = isContentOnly(config);
  const show = contentOnly && layout.showTitle !== false;

  if (!standingsTitleEl) return;

  standingsTitleEl.classList.toggle("os-hidden", !show);
  if (!show) return;

  const text = h.title || "STANDINGS";
  const span = standingsTitleEl.querySelector(".os-standings-title__text");
  if (span) {
    span.textContent = text;
    span.setAttribute("data-text", text);
  } else {
    standingsTitleEl.textContent = text;
  }
  standingsTitleEl.style.fontSize = `${Math.max(72, Number(h.titleSize) || 112)}px`;
  if (h.titleFont) {
    standingsTitleEl.style.fontFamily = `"${h.titleFont}", "Bebas Neue", Impact, sans-serif`;
  }
  applyTitleColorVars(standingsTitleEl, h);
}

function applyLayoutMode(config) {
  const contentOnly = isContentOnly(config);
  const layout = config.layout || {};

  document.body.classList.toggle("os-transparent", contentOnly);
  stage.classList.toggle("os-mode-content", contentOnly);
  stage.classList.toggle("os-mode-broadcast", !contentOnly);

  if (contentOnly) {
    headerEl.classList.add("os-hidden");
    footerEl.classList.add("os-hidden");
    applyStandingsTitle(config);
  } else {
    if (standingsTitleEl) standingsTitleEl.classList.add("os-hidden");
    applyHeaderBroadcast(config);
  }

  tableHeadEl.classList.toggle("os-hidden", layout.showTableHeader === false);
}

function mountBackground(config) {
  const contentOnly = isContentOnly(config);
  const bg = config.background || {};
  const url = bg.imageUrl ? resolveAssetUrl(bg.imageUrl) : "";

  bgLayer.innerHTML = "";

  if (contentOnly && !url) {
    bgFallback.style.display = "none";
    return;
  }

  if (!url) {
    bgFallback.style.display = contentOnly ? "none" : "block";
    return;
  }

  bgFallback.style.display = "none";

  const op = bg.opacity != null ? bg.opacity : 1;
  const scale = Math.max(1, Number(bg.scale) || 1.05);
  const isVideo = backgroundMediaType(bg) === "video";

  if (isVideo) {
    const v = document.createElement("video");
    v.muted = v.loop = v.autoplay = v.playsInline = true;
    v.style.opacity = String(op);
    v.style.transform = `translate(-50%, -50%) scale(${scale})`;
    v.src = url;
    v.play?.().catch(() => {});
    bgLayer.appendChild(v);
  } else {
    const img = document.createElement("img");
    img.src = url;
    img.style.opacity = String(op);
    img.style.transform = `translate(-50%, -50%) scale(${scale})`;
    bgLayer.appendChild(img);
  }
}

function charUrl(config) {
  const urls = config.featured?.characterUrls || [];
  const u = urls[0];
  if (u && String(u).trim()) return resolveAssetUrl(u);
  return DEFAULT_CHAR;
}

function renderFeatured(leader, config) {
  const showFeatured = config.layout?.showFeatured !== false;
  bodyEl?.classList.toggle("os-no-featured", !showFeatured || !leader);
  tableHeadEl.classList.toggle("os-hidden", config.layout?.showTableHeader === false);

  if (!showFeatured || !leader) {
    featuredEl.innerHTML = "";
    return;
  }

  const charSrc = escapeAttr(charUrl(config));
  const ptsLabel = config.labels?.featuredPoints || "TOTAL POINTS";
  featuredEl.innerHTML = `
    <div class="os-featured">
      <div class="os-featured-chars"><img src="${charSrc}" alt="" /></div>
      <div class="os-featured-info">
        <div class="os-featured-banner"><div class="os-featured-team"><span class="os-cell-text">${escapeHtml(leader.team)}</span></div></div>
        <div class="os-featured-points"><span class="os-cell-text">${escapeHtml(ptsLabel)} - ${leader.totalPoints ?? 0}</span></div>
      </div>
    </div>`;
}

function rowHtml(team, rank, { leader = false } = {}) {
  const pos = String(rank).padStart(2, "0");
  const wwcd = team.chickenDinners ?? 0;
  const wwcdInner =
    wwcd > 0
      ? `<img class="os-wwcd-icon" src="${WWCD_ICON}" alt="" /><span>X${wwcd}</span>`
      : `<span>${wwcd}</span>`;
  const rowCls = ["os-row", leader ? "os-row--leader" : ""].filter(Boolean).join(" ");

  return `
    <div class="${rowCls}" data-rank="${rank}">
      <div class="os-pos"><span class="os-cell-text">${pos}</span></div>
      <div class="os-bar-wrap">
        <div class="os-team-cell"><span class="os-cell-text">${escapeHtml(team.team)}</span></div>
        <div class="os-stat-cell"><span class="os-cell-text">${wwcdInner}</span></div>
        <div class="os-stat-cell"><span class="os-cell-text">${team.totalPositionPoints ?? 0}</span></div>
        <div class="os-stat-cell"><span class="os-cell-text">${team.totalKills ?? 0}</span></div>
        <div class="os-stat-cell"><span class="os-cell-text">${team.totalPoints ?? 0}</span></div>
      </div>
    </div>`;
}

function showRevealInstant(config) {
  const animate = config.animation?.enabled !== false;
  bodyEl.dataset.animEnabled = animate ? "1" : "0";
  const sel =
    ".os-row, .os-table-head, .os-featured-chars, .os-featured-banner, .os-featured-points, .os-standings-title";
  bodyEl.querySelectorAll(sel).forEach((el) => {
    el.classList.remove("anim-pending");
    el.classList.add("anim-play");
  });
}

function applyRevealAnimations(config) {
  const animate = config.animation?.enabled !== false;
  const speed = Math.max(0.25, Math.min(3, Number(config.animation?.speed) || 1));
  bodyEl.dataset.animEnabled = animate ? "1" : "0";

  const targets = [];
  if (standingsTitleEl && !standingsTitleEl.classList.contains("os-hidden")) {
    standingsTitleEl.style.setProperty("--stagger-delay", "0s");
    targets.push(standingsTitleEl);
  }
  if (!tableHeadEl.classList.contains("os-hidden")) {
    tableHeadEl.style.setProperty("--stagger-delay", `${(0.12 / speed).toFixed(3)}s`);
    targets.push(tableHeadEl);
    tableHeadEl.querySelectorAll(".os-table-head__pos, .os-table-head__cells > div").forEach((cell, ci) => {
      cell.style.setProperty("--cell-delay", `${((ci * 0.04) / speed).toFixed(3)}s`);
    });
  }
  featuredEl.querySelectorAll(".os-featured-chars, .os-featured-banner, .os-featured-points").forEach((el, i) => {
    el.style.setProperty("--stagger-delay", `${((0.2 + i * 0.07) / speed).toFixed(3)}s`);
    el.style.setProperty("--cell-delay", "0s");
    targets.push(el);
  });

  pairsEl.querySelectorAll(".os-row").forEach((row, i) => {
    const pair = row.parentElement;
    const isRight = pair && pair.children[1] === row;
    row.dataset.slideFrom = isRight ? "right" : "left";
    row.style.setProperty("--stagger-delay", `${((0.45 + i * 0.055) / speed).toFixed(3)}s`);
    row.querySelectorAll(".os-pos, .os-team-cell, .os-stat-cell").forEach((cell, ci) => {
      cell.style.setProperty("--cell-delay", `${((ci * 0.045) / speed).toFixed(3)}s`);
    });
    targets.push(row);
  });

  targets.forEach((el) => {
    el.classList.remove("anim-play");
    el.classList.add("anim-pending");
  });

  if (!animate) {
    targets.forEach((el) => {
      el.classList.remove("anim-pending");
      el.classList.add("anim-play");
    });
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      targets.forEach((el) => {
        el.classList.add("anim-play");
        el.classList.remove("anim-pending");
      });
    });
  });
}

function syncRightOffset() {
  if (!rightOffsetEl || !topLeftEl) return;
  rightOffsetEl.style.height = `${topLeftEl.offsetHeight}px`;
}

function renderRows(config) {
  const total = teams.length;
  const { leftN, rightN, rightStartRank } = computeColumnSplit(total, config.layout || {});
  const left = teams.slice(0, leftN);
  const right = teams.slice(leftN, leftN + rightN);
  const replayKey = config.animation?.replayKey ?? 0;
  const dataSig = JSON.stringify({ teams, leftN, rightN, rightStartRank, layout: config.layout });
  const replayRequested = replayKey !== lastReplayKey;

  if (dataSig === lastDataSig && !replayRequested) return;

  const shouldAnimate =
    config.animation?.enabled !== false && (replayRequested || (!introRevealed && total > 0));

  lastDataSig = dataSig;

  const leader = teams[0] || null;
  renderFeatured(leader, config);
  tableHeadEl.classList.toggle("os-hidden", config.layout?.showTableHeader === false);

  pairsEl.innerHTML = "";

  emptyEl.classList.toggle("os-hidden", total > 0);

  const pairCount = Math.max(left.length, right.length);

  for (let i = 0; i < pairCount; i++) {
    const pair = document.createElement("div");
    pair.className = "os-pair";
    if (left[i]) {
      const wrap = document.createElement("div");
      wrap.innerHTML = rowHtml(left[i], i + 1, { leader: i === 0 });
      pair.appendChild(wrap.firstElementChild);
    } else {
      pair.appendChild(document.createElement("div"));
    }
    if (right[i]) {
      const wrap = document.createElement("div");
      wrap.innerHTML = rowHtml(right[i], rightStartRank + i);
      pair.appendChild(wrap.firstElementChild);
    } else {
      pair.appendChild(document.createElement("div"));
    }
    pairsEl.appendChild(pair);
  }

  if (shouldAnimate) {
    applyRevealAnimations(config);
    introRevealed = true;
    lastReplayKey = replayKey;
  } else {
    showRevealInstant(config);
  }

  requestAnimationFrame(() => {
    syncRightOffset();
    requestAnimationFrame(() => {
      syncRightOffset();
      fitStage();
    });
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function fitStage() {
  if (isContentOnly(currentConfig)) {
    const el = contentEl || stage;
    const w = el.offsetWidth || 1680;
    const h = el.offsetHeight || 800;
    const s = Math.min(window.innerWidth / w, window.innerHeight / h, 1);
    stage.style.width = `${w}px`;
    stage.style.height = `${h}px`;
    stage.style.transform = s < 0.999 ? `scale(${s})` : "none";
    return;
  }
  stage.style.width = "1920px";
  stage.style.height = "1080px";
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.transform = s < 0.999 ? `scale(${s})` : "none";
}

function applyConfig(config) {
  currentConfig = config;
  applyTheme(config);
  applyLabels(config);
  applyLayoutMode(config);
  mountBackground(config);
  renderRows(config);
  fitStage();
}

async function fetchTeams() {
  try {
    const res = await fetch(`${getApiBase()}/tournament/overall`);
    if (!res.ok) return;
    const data = await res.json();
    teams = Array.isArray(data) ? data : [];
  } catch {
    /* keep last */
  }
}

async function tick() {
  await fetchTeams();
  if (currentConfig) renderRows(currentConfig);
}

async function init() {
  const config = await getConfig();
  await fetchTeams();
  applyConfig(config);

  subscribeConfig((cfg) => {
    applyConfig(cfg);
  });

  window.addEventListener("resize", () => {
    syncRightOffset();
    fitStage();
  });

  if (topLeftEl && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => syncRightOffset()).observe(topLeftEl);
  }

  setInterval(tick, 3000);
}

init();
