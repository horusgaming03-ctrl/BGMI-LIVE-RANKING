/* WWCD STATUS — overlay renderer */
import {
  getConfig,
  getApiBase,
  resolveAssetUrl,
  backgroundMediaType,
  subscribeConfig,
} from "./config-store.js";

const viewport = document.getElementById("ws-viewport");
const stage = document.getElementById("ws-stage");
const bgLayer = document.getElementById("ws-bg");
const header = document.getElementById("ws-header");
const logoEl = document.getElementById("ws-logo");
const titleEl = document.getElementById("ws-title");
const subtitleEl = document.getElementById("ws-subtitle");
const cardsEl = document.getElementById("ws-cards");
const teambar = document.getElementById("ws-teambar");
const teambarName = document.getElementById("ws-teambar-name");
const teambarLogo = document.getElementById("ws-teambar-logo");

let currentConfig = null;
let live = { winner: null, matchNumber: null };
let lastCardsSig = "";

/* ── helpers replicated from the backend WWCD payload ── */
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

/** Per-character zoom / move / stretch -> CSS transform (origin: bottom center). */
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
  // ?v=6 cache-bust so OBS / browsers reload the freshly-extracted defaults.
  return `assets/characters/char-${i % 4}.png?v=6`;
}

/* ── background ── */
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
    const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    v.addEventListener("loadeddata", play);
    v.addEventListener("canplay", play);
    return v;
  };

  if (isVideo && fit === "cover") {
    const v = wireVideo(document.createElement("video"));
    v.className = "ws-bg__cover ws-bg__cover-video";
    v.style.opacity = op;
    v.onloadedmetadata = () => sizeCover(v, bg);
    v.src = url;
    bgLayer.appendChild(v);
  } else if (fit === "cover") {
    const img = document.createElement("img");
    img.className = "ws-bg__cover";
    img.decoding = "async";
    img.style.opacity = op;
    img.onload = () => sizeCover(img, bg);
    img.src = url;
    if (img.complete && img.naturalWidth) sizeCover(img, bg);
    bgLayer.appendChild(img);
  } else {
    const fill = document.createElement("div");
    fill.className = "ws-bg__fill";
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

/* ── theme + header ── */
function applyTheme(config) {
  const t = config.theme || {};
  const set = (k, v) => { if (v != null && v !== "") stage.style.setProperty(k, v); };
  set("--accent", t.accent);
  set("--card-bg", t.cardBg);
  set("--card-border-c", t.cardBorderColor);
  if (t.cardBorderWidth != null) stage.style.setProperty("--card-border-w", `${t.cardBorderWidth}px`);
  // Character-background tint: compose a vertical gradient from the Top/Bottom
  // colour pickers when present; otherwise fall back to the raw mediaTint string.
  const top = t.mediaTintTop;
  const bottom = t.mediaTintBottom;
  if (top && bottom) {
    stage.style.setProperty("--media-tint", `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`);
  } else {
    set("--media-tint", t.mediaTint);
  }
  set("--name-bar", t.nameBarColor);
  set("--name-text", t.nameTextColor);
  set("--stat-label", t.statLabelColor);
  set("--stat-value", t.statValueColor);

  const team = config.team || {};
  set("--team-label-color", team.labelColor);
  set("--team-name-color", team.nameColor);

  const a = config.animation || {};
  const speed = Math.max(0.25, Math.min(3, Number(a.speed) || 1));
  stage.style.setProperty("--anim-duration", `${(0.6 / speed).toFixed(3)}s`);
  stage.dataset.anim = a.type || "staggered";
  stage.dataset.animEnabled = a.enabled === false ? "0" : "1";
}

function applyHeader(config) {
  const h = config.header || {};
  titleEl.textContent = h.title || "";
  if (h.titleFont) titleEl.style.fontFamily = `"${h.titleFont}", "Bebas Neue", sans-serif`;
  if (h.titleColor) titleEl.style.color = h.titleColor;
  titleEl.style.fontSize = `${Math.max(40, Number(h.titleSize) || 118)}px`;

  subtitleEl.textContent = h.subtitle || "";
  subtitleEl.style.fontSize = `${Math.max(16, Number(h.subtitleSize) || 40)}px`;

  const pos = h.position || {};
  header.style.left = `${Number(pos.x) || 0}px`;
  header.style.top = `${Number(pos.y) || 0}px`;

  const logoUrl = h.logoUrl ? resolveAssetUrl(h.logoUrl) : "";
  if (logoUrl) {
    logoEl.src = logoUrl;
    logoEl.classList.remove("ws-hidden");
  } else {
    logoEl.classList.add("ws-hidden");
    logoEl.removeAttribute("src");
  }
}

/* ── cards ── */
function computeView(config) {
  const cfgCards = (config.cards || []).slice(0, 4);
  const useLive = config.winnerSource !== "manual" && live.winner;
  if (useLive) {
    const w = live.winner;
    const liveNames = padSquadNames(w.players, w.team);
    const liveFins = splitFinishesAcrossSquad(w.finishes);
    return {
      cards: liveNames.map((name, i) => {
        const c = cfgCards[i] || {};
        return {
          name: c.manualName && String(c.name || "").trim()
            ? String(c.name).toUpperCase()
            : name,
          finishes: c.manualFinishes ? Number(c.finishes) || 0 : liveFins[i],
          img: charSrc(c, i),
          transform: c?.transform,
        };
      }),
      teamName: String(w.team || "").toUpperCase(),
      teamLogo: w.logo ? resolveAssetUrl(w.logo) : "",
    };
  }
  const cards = (config.cards || []).slice(0, 4).map((c, i) => ({
    name: String(c?.name || `PLAYER ${i + 1}`).toUpperCase(),
    finishes: Number(c?.finishes) || 0,
    img: charSrc(c, i),
    transform: c?.transform,
  }));
  const team = config.team || {};
  return {
    cards,
    teamName: String(team.name || "").toUpperCase(),
    teamLogo: team.logoUrl ? resolveAssetUrl(team.logoUrl) : "",
  };
}

function renderCards(config) {
  const view = computeView(config);
  const replayKey = config.animation?.replayKey ?? 0;
  const sig = JSON.stringify({ view, replayKey, anim: stage.dataset.anim, en: stage.dataset.animEnabled });
  if (sig === lastCardsSig) return;
  lastCardsSig = sig;

  cardsEl.dataset.count = String(view.cards.length || 4);
  cardsEl.innerHTML = "";

  const speed = Math.max(0.25, Math.min(3, Number(config.animation?.speed) || 1));
  const animate = config.animation?.enabled !== false;

  view.cards.forEach((c, i) => {
    const card = document.createElement("div");
    card.className = "wwcd-card" + (animate ? " anim-pending" : "");
    card.style.setProperty("--stagger-delay", `${((i * 0.09) / speed).toFixed(3)}s`);
    card.innerHTML = `
      <div class="wwcd-card__media"><img class="wwcd-card__char" alt="" /></div>
      <div class="wwcd-card__name"></div>
      <div class="wwcd-card__stat">
        <span class="wwcd-card__stat-label">FINISHES</span>
        <span class="wwcd-card__stat-value"></span>
      </div>`;
    const charImg = card.querySelector(".wwcd-card__char");
    charImg.src = c.img;
    charImg.style.transform = charTransform(c);
    card.querySelector(".wwcd-card__name").textContent = c.name;
    card.querySelector(".wwcd-card__stat-value").textContent = c.finishes;
    cardsEl.appendChild(card);
  });

  if (animate) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cardsEl.querySelectorAll(".wwcd-card").forEach((el) => el.classList.add("anim-play"));
      });
    });
  }

  // Team footer
  const showFooter = config.team?.showFooter !== false && (view.teamName || view.teamLogo);
  teambar.classList.toggle("ws-hidden", !showFooter);
  teambarName.textContent = view.teamName || "";
  if (view.teamLogo) {
    teambarLogo.src = view.teamLogo;
    teambarLogo.classList.remove("ws-hidden");
  } else {
    teambarLogo.classList.add("ws-hidden");
    teambarLogo.removeAttribute("src");
  }
}

/* ── stage fit for non-1920 windows (admin preview) ── */
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

/* ── live winner polling ── */
async function fetchLive() {
  const api = getApiBase();
  try {
    const [tR, mR] = await Promise.all([fetch(`${api}/teams`), fetch(`${api}/match/current`)]);
    const teams = tR.ok ? await tR.json() : [];
    const match = mR.ok ? await mR.json() : {};
    const list = Array.isArray(teams) ? teams : [];
    let winner = list.find((t) => t.eliminationRank === 1);
    if (!winner && list.length) winner = list[0];
    live = { winner: winner || null, matchNumber: match?.number ?? null };
  } catch (e) {
    /* keep last known */
  }
}

async function tickLive() {
  if (currentConfig && currentConfig.winnerSource === "manual") return;
  await fetchLive();
  if (currentConfig) renderCards(currentConfig);
}

async function init() {
  const config = await getConfig();
  applyConfig(config);
  if (config.winnerSource !== "manual") {
    await fetchLive();
    renderCards(config);
  }

  subscribeConfig((cfg) => {
    lastCardsSig = ""; // force re-render on admin change
    applyConfig(cfg);
  });

  window.addEventListener("resize", fitStage);
  setInterval(tickLive, 3000);
}

init();
