/* TOP FRAGGERS — overlay renderer */
import {
  getConfig,
  getApiBase,
  resolveAssetUrl,
  backgroundMediaType,
  subscribeConfig,
  ensureCards,
} from "./config-store.js";

const viewport = document.getElementById("tf-viewport");
const stage = document.getElementById("tf-stage");
const bgLayer = document.getElementById("tf-bg");
const titleEl = document.getElementById("tf-title");
const brandEl = document.getElementById("tf-brand");
const brandMainEl = document.getElementById("tf-brand-main");
const brandSubEl = document.getElementById("tf-brand-sub");
const leftLogoEl = document.getElementById("tf-left-logo");
const rightLogoEl = document.getElementById("tf-right-logo");
const cardsEl = document.getElementById("tf-cards");
const footerEl = document.getElementById("tf-footer");

let currentConfig = null;
let livePlayers = [];
let lastCardsSig = "";

function padSquadNames(playerList, teamName) {
  const arr = Array.isArray(playerList) ? playerList.filter(Boolean).map((s) => String(s).trim()) : [];
  const t = String(teamName || "TEAM").toUpperCase();
  for (let i = arr.length; i < 4; i++) arr.push(`${t} · P${i + 1}`);
  return arr.slice(0, 4).map((s) => s.toUpperCase());
}

function splitFinishesAcrossSquad(total) {
  const n = 4;
  const t = Math.max(0, Number(total) || 0);
  const base = Math.floor(t / n);
  const r = t % n;
  return Array.from({ length: n }, (_, i) => base + (i < r ? 1 : 0));
}

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function charTransform(card) {
  const t = (card && card.transform) || {};
  const zoom = num(t.zoom, 1);
  const sx = (num(t.stretchX, 1) * zoom).toFixed(3);
  const sy = (num(t.stretchY, 1) * zoom).toFixed(3);
  const x = num(t.x, 0);
  const y = num(t.y, 0);
  return `translate(${x}%, ${y}%) scale(${sx}, ${sy})`;
}

function charSrc(card, i) {
  const custom = card?.characterImageUrl;
  if (custom && String(custom).trim()) return resolveAssetUrl(custom);
  return `../wwcd-status/assets/characters/char-${i % 4}.png?v=6`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sizeCover(el, bg) {
  const nw = el.videoWidth || el.naturalWidth;
  const nh = el.videoHeight || el.naturalHeight;
  if (!nw || !nh) return;
  const bleed = Math.max(1, Number(bg?.scale) || 1.05);
  const cover = Math.max(1920 / nw, 1080 / nh) * bleed;
  el.style.width = `${Math.ceil(nw * cover)}px`;
  el.style.height = `${Math.ceil(nh * cover)}px`;
}

function mountBackground(config) {
  const bg = config.background || {};
  const url = bg.imageUrl ? resolveAssetUrl(bg.imageUrl) : "";
  const key = [url, bg.fit || "cover", bg.opacity != null ? bg.opacity : 1, backgroundMediaType(bg), bg.scale != null ? bg.scale : 1.05].join("|");
  if (bgLayer.dataset.k === key && bgLayer.childNodes.length) {
    viewport.classList.toggle("has-bg", !!url);
    return;
  }
  bgLayer.dataset.k = key;
  bgLayer.innerHTML = "";
  viewport.classList.toggle("has-bg", !!url);
  if (!url) {
    bgLayer.style.display = "none";
    return;
  }
  bgLayer.style.display = "block";
  const fit = bg.fit === "contain" ? "contain" : "cover";
  const op = String(bg.opacity != null ? bg.opacity : 1);
  const isVideo = backgroundMediaType(bg) === "video";

  const wireVideo = (v) => {
    v.muted = v.defaultMuted = v.loop = v.autoplay = v.playsInline = true;
    ["muted", "loop", "autoplay", "playsinline", "webkit-playsinline"].forEach((a) => v.setAttribute(a, ""));
    v.preload = "auto";
    const play = () => {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    };
    v.addEventListener("loadeddata", play);
    v.addEventListener("canplay", play);
    return v;
  };

  if (isVideo && fit === "cover") {
    const v = wireVideo(document.createElement("video"));
    v.className = "tf-bg__cover tf-bg__cover-video";
    v.style.opacity = op;
    v.onloadedmetadata = () => sizeCover(v, bg);
    v.src = url;
    bgLayer.appendChild(v);
  } else if (fit === "cover") {
    const img = document.createElement("img");
    img.className = "tf-bg__cover";
    img.decoding = "async";
    img.style.opacity = op;
    img.onload = () => sizeCover(img, bg);
    img.src = url;
    if (img.complete && img.naturalWidth) sizeCover(img, bg);
    bgLayer.appendChild(img);
  } else {
    const fill = document.createElement("div");
    fill.className = "tf-bg__fill";
    fill.dataset.fit = "contain";
    if (isVideo) {
      const v = wireVideo(document.createElement("video"));
      v.style.width = "100%";
      v.style.height = "100%";
      v.style.objectFit = "contain";
      v.style.opacity = op;
      v.src = url;
      fill.appendChild(v);
    } else {
      fill.style.backgroundImage = `url(${JSON.stringify(url)})`;
      fill.style.backgroundPosition = bg.position || "center center";
      fill.style.opacity = op;
    }
    bgLayer.appendChild(fill);
  }
}

function applyTheme(config) {
  const t = config.theme || {};
  const set = (k, v) => {
    if (v != null && v !== "") stage.style.setProperty(k, v);
  };
  set("--accent", t.accent);
  set("--card-bg", t.cardBg);
  set("--card-border-c", t.cardBorderColor);
  if (t.cardBorderWidth != null) stage.style.setProperty("--card-border-w", `${t.cardBorderWidth}px`);
  const top = t.mediaTintTop;
  const bottom = t.mediaTintBottom;
  if (top && bottom) {
    stage.style.setProperty("--media-tint", `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`);
  } else {
    set("--media-tint", t.mediaTint);
  }
  set("--rank-badge-bg", t.rankBadgeBg);
  set("--rank-badge-text", t.rankBadgeText);
  set("--name-bar", t.nameBarColor);
  set("--name-text", t.nameTextColor);
  set("--stat-label", t.statLabelColor);
  set("--stat-label-bg", t.statLabelBg);
  set("--stat-value", t.statValueColor);
  set("--stat-value-bg-top", t.statValueBgTop);
  set("--stat-value-bg-bottom", t.statValueBgBottom);
  set("--card-accent", t.cardAccentLine);

  const h = config.header || {};
  if (h.titleColor) stage.style.setProperty("--title-color", h.titleColor);

  const f = config.footer || {};
  if (f.color) stage.style.setProperty("--footer-color", f.color);

  const a = config.animation || {};
  const speed = Math.max(0.25, Math.min(3, Number(a.speed) || 1));
  stage.style.setProperty("--anim-duration", `${(0.6 / speed).toFixed(3)}s`);
  stage.dataset.anim = a.type || "staggered";
  stage.dataset.animEnabled = a.enabled === false ? "0" : "1";
}

function applyHeader(config) {
  const h = config.header || {};
  titleEl.textContent = h.title || "TOP FRAGGERS";
  if (h.titleFont) titleEl.style.fontFamily = `"${h.titleFont}", "Bebas Neue", sans-serif`;
  if (h.titleColor) titleEl.style.color = h.titleColor;
  titleEl.style.fontSize = `${Math.max(40, Number(h.titleSize) || 132)}px`;

  brandMainEl.textContent = h.brandMain || "MEA";
  brandSubEl.textContent = h.brandSub || "MUMBAI ESPORTS";

  const leftUrl = h.leftLogoUrl ? resolveAssetUrl(h.leftLogoUrl) : "";
  const rightUrl = h.rightLogoUrl ? resolveAssetUrl(h.rightLogoUrl) : "";
  const showBrand = !leftUrl;

  brandEl.classList.toggle("tf-hidden", !showBrand);
  if (leftUrl) {
    leftLogoEl.src = leftUrl;
    leftLogoEl.classList.remove("tf-hidden");
  } else {
    leftLogoEl.classList.add("tf-hidden");
    leftLogoEl.removeAttribute("src");
  }
  if (rightUrl) {
    rightLogoEl.src = rightUrl;
    rightLogoEl.classList.remove("tf-hidden");
  } else {
    rightLogoEl.classList.add("tf-hidden");
    rightLogoEl.removeAttribute("src");
  }

  const f = config.footer || {};
  footerEl.textContent = f.text || "";
  footerEl.style.fontSize = `${Math.max(16, Number(f.size) || 36)}px`;
  footerEl.classList.toggle("tf-hidden", f.show === false || !f.text);
}

function computeView(config) {
  ensureCards(config);
  const count = config.cardCount || 5;
  const cfgCards = (config.cards || []).slice(0, count);
  const useLive = config.dataSource !== "manual" && livePlayers.length > 0;

  if (useLive) {
    return livePlayers.slice(0, count).map((p, i) => {
      const c = cfgCards[i] || {};
      return {
        rank: p.rank ?? i + 1,
        name: c.manualName && String(c.name || "").trim() ? String(c.name).toUpperCase() : String(p.name || "").toUpperCase(),
        finishes: c.manualFinishes ? Number(c.finishes) || 0 : Number(p.finishes) || 0,
        img: charSrc(c, i),
        transform: c?.transform,
      };
    });
  }

  return cfgCards.map((c, i) => ({
    rank: i + 1,
    name: String(c?.name || `PLAYER ${i + 1}`).toUpperCase(),
    finishes: Number(c?.finishes) || 0,
    img: charSrc(c, i),
    transform: c?.transform,
  }));
}

function renderCards(config) {
  const view = computeView(config);
  const count = config.cardCount || 5;
  const replayKey = config.animation?.replayKey ?? 0;
  const sig = JSON.stringify({ view, replayKey, anim: stage.dataset.anim, en: stage.dataset.animEnabled, count });
  if (sig === lastCardsSig) return;
  lastCardsSig = sig;

  cardsEl.dataset.count = String(count);
  cardsEl.innerHTML = "";

  const speed = Math.max(0.25, Math.min(3, Number(config.animation?.speed) || 1));
  const animate = config.animation?.enabled !== false;

  view.forEach((c, i) => {
    const card = document.createElement("div");
    card.className = "tf-card" + (animate ? " anim-pending" : "");
    card.style.setProperty("--stagger-delay", `${((i * 0.09) / speed).toFixed(3)}s`);
    card.innerHTML = `
      <div class="tf-card__rank">#${c.rank}</div>
      <div class="tf-card__media"><img class="tf-card__char" alt="" /></div>
      <div class="tf-card__name">${escapeHtml(c.name)}</div>
      <div class="tf-card__stat-label">FINISHES</div>
      <div class="tf-card__stat-value-wrap"><span class="tf-card__stat-value">${escapeHtml(c.finishes)}</span></div>
      <div class="tf-card__accent"></div>`;
    const charImg = card.querySelector(".tf-card__char");
    charImg.src = c.img;
    charImg.style.transform = charTransform(c);
    cardsEl.appendChild(card);
  });

  if (animate) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cardsEl.querySelectorAll(".tf-card").forEach((el) => el.classList.add("anim-play"));
      });
    });
  }
}

function fitStage() {
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.transform = s < 0.999 ? `scale(${s})` : "none";
}

function applyConfig(config) {
  currentConfig = config;
  applyTheme(config);
  applyHeader(config);
  mountBackground(config);
  renderCards(config);
  fitStage();
}

async function fetchLive() {
  const api = getApiBase();
  try {
    const res = await fetch(`${api}/top-fraggers/live`);
    if (!res.ok) return;
    const data = await res.json();
    livePlayers = Array.isArray(data.players) ? data.players : [];
  } catch {
    /* keep last */
  }
}

async function tickLive() {
  if (currentConfig && currentConfig.dataSource === "manual") return;
  await fetchLive();
  if (currentConfig) renderCards(currentConfig);
}

async function init() {
  const config = await getConfig();
  applyConfig(config);
  if (config.dataSource !== "manual") {
    await fetchLive();
    renderCards(config);
  }

  subscribeConfig((cfg) => {
    lastCardsSig = "";
    applyConfig(cfg);
  });

  window.addEventListener("resize", fitStage);
  setInterval(tickLive, 3000);
}

init();
