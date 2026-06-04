import { getConfig, subscribeConfig, getScheduleApiBase } from "./config-store.js";
import { mountScheduleBackgroundIfChanged } from "./schedule-bg-render.js";
import { MAP_CATALOG, resolveMapImage, mapDisplayName } from "./map-catalog.js";
import { applyAnimationClasses, showCardsInstant, cardIntroTotalMs } from "./animations.js";
import { resolveCardsBannerFontPx, CARDS_BANNER_FONT } from "./schedule-header.js";
import { createWwcdMapImage } from "./wwcd-panel.js";
import {
  fetchLiveTournamentState,
  liveCardsSignature,
  matchNumberFromCard,
  shouldShowWwcdForCard,
  resolveWwcdTeamForMatch,
  teamInitialsFromName,
} from "./schedule-live.js";

let liveState = { number: 1, status: "live", teams: [], history: [] };

const root = document.getElementById("som-root");
const stage = document.getElementById("som-stage");
const bgLayer = document.getElementById("som-bg");
const headerEl = document.getElementById("som-header");
const titleEl = document.getElementById("som-title");
const subtitleEl = document.getElementById("som-subtitle");
const cardsEyebrowEl = document.getElementById("som-cards-eyebrow");
const cardsEl = document.getElementById("som-cards");

const FONT_LINKS = {
  "Bebas Neue": "Bebas+Neue",
  Anton: "Anton",
  Teko: "Teko:wght@500;600;700",
  Oswald: "Oswald:wght@500;600;700",
  Rajdhani: "Rajdhani:wght@500;600;700",
  Orbitron: "Orbitron:wght@500;700",
  "Exo 2": "Exo+2:wght@500;600;700",
};

const loadedFonts = new Set();

function ensureFont(name) {
  if (!name || loadedFonts.has(name)) return;
  const spec = FONT_LINKS[name];
  if (!spec) return;
  loadedFonts.add(name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  document.head.appendChild(link);
}

function basePath() {
  const p = window.location.pathname.replace(/\/[^/]*$/, "/");
  return `${window.location.origin}${p}`;
}

function applyTheme(config) {
  const t = config.theme || {};
  stage.style.setProperty("--card-bg", t.cardBackground || "#ffffff");
  stage.style.setProperty("--card-border-w", `${t.cardBorderWidth ?? 1}px`);
  stage.style.setProperty("--card-border-c", t.cardBorderColor || "rgba(12, 16, 22, 0.45)");
  stage.style.setProperty("--accent", t.accentColor || "#ff6600");
  root.style.setProperty("--accent", t.accentColor || "#ff6600");
}

function resolveBgUrl(url) {
  if (!url) return "";
  if (url.startsWith("/")) return `${window.location.origin}${url}`;
  return url;
}

function applyBackground(config) {
  const bg = config.background || {};
  const hasBg = mountScheduleBackgroundIfChanged(bgLayer, bg, resolveBgUrl);
  document.getElementById("som-viewport")?.classList.toggle("has-bg", hasBg);
}

function applyHeader(config) {
  const h = config.header || {};
  ensureFont(h.titleFont);
  ensureFont(h.subtitleFont);
  titleEl.textContent = h.title || "SCHEDULE";
  const banner = (h.subtitle || "").trim();
  if (subtitleEl) subtitleEl.textContent = banner;
  if (cardsEyebrowEl) {
    const bannerPx = resolveCardsBannerFontPx(h);
    cardsEyebrowEl.textContent = banner;
    ensureFont(CARDS_BANNER_FONT);
    cardsEyebrowEl.style.fontFamily = `"${CARDS_BANNER_FONT}", sans-serif`;
    cardsEyebrowEl.style.color = h.subtitleColor || "#ffffff";
    cardsEyebrowEl.style.fontSize = `${bannerPx}px`;
    cardsEyebrowEl.style.letterSpacing = "0.06em";
    stage.style.setProperty("--cards-eyebrow-size", `${bannerPx}px`);
    stage.style.setProperty("--cards-eyebrow-color", h.subtitleColor || "#ffffff");
  }
  titleEl.style.fontFamily = `"${h.titleFont || "Bebas Neue"}", sans-serif`;
  titleEl.style.color = h.titleColor || "#ffffff";
  titleEl.style.fontSize = `${h.titleSize || 148}px`;
  const pos = h.position || { x: 72, y: 48 };
  headerEl.style.left = `${pos.x}px`;
  headerEl.style.top = `${pos.y}px`;
}

function resolveTeamLogoUrl(team) {
  if (!team?.logo) return "";
  const logo = team.logo;
  if (logo.startsWith("http://") || logo.startsWith("https://") || logo.startsWith("data:")) return logo;
  if (logo.startsWith("/")) return `${window.location.origin}${logo}`;
  return logo;
}

function buildCard(match, index, config) {
  const t = config.theme || {};
  const matchNum = matchNumberFromCard(match, index);
  const showWwcd = shouldShowWwcdForCard(match, index, liveState);
  const wwcdTeam = showWwcd ? resolveWwcdTeamForMatch(matchNum, liveState) : null;
  const logoUrl = showWwcd ? resolveTeamLogoUrl(wwcdTeam) : "";
  const initials = showWwcd ? teamInitialsFromName(wwcdTeam?.team) : "";

  const card = document.createElement("article");
  card.className = "match-card";
  if (showWwcd) card.classList.add("is-winner");
  card.style.borderColor = t.cardBorderColor || "#1a1f26";
  card.style.borderWidth = `${t.cardBorderWidth ?? 1}px`;

  const media = document.createElement("div");
  media.className = "match-card__media";

  if (showWwcd) {
    const resolveUrl = (url) =>
      url.startsWith("/") ? `${window.location.origin}${url}` : url;
    media.appendChild(createWwcdMapImage(match, config, basePath(), resolveUrl));
  } else {
    const mapName = mapDisplayName(match);
    const mapImg = document.createElement("img");
    mapImg.className = "map-photo";
    mapImg.alt = mapName;
    mapImg.src = resolveMapImage(match, basePath());
    media.appendChild(mapImg);

    const label = document.createElement("div");
    label.className = "match-card__map-label";
    label.textContent = mapName;
    label.style.color = t.mapLabelColor || "#ff6600";
    label.style.background = t.mapLabelBgColor || "#ffffff";
    label.style.fontFamily = `"${t.mapLabelFont || "Bebas Neue"}", sans-serif`;
    if (mapName.length >= 8) label.dataset.len = "long";
    else if (mapName.length >= 6) label.dataset.len = "medium";
    media.appendChild(label);
  }

  if (match.showRankBadge && match.rankBadgeText) {
    const badge = document.createElement("div");
    badge.className = "match-card__rank-badge";
    badge.textContent = match.rankBadgeText;
    media.appendChild(badge);
  }

  const footer = document.createElement("footer");
  footer.className = "match-card__footer";
  if (showWwcd && (logoUrl || initials)) footer.classList.add("has-logo");

  const matchNo = document.createElement("span");
  matchNo.className = "match-card__match-no";
  matchNo.textContent = match.matchNumber || `M${index + 1}`;
  matchNo.style.color = t.footerTextColor || "#111111";
  footer.appendChild(matchNo);

  if (showWwcd && (logoUrl || initials)) {
    if (logoUrl) {
      const wrap = document.createElement("div");
      wrap.className = "match-card__logo-wrap";
      const logo = document.createElement("img");
      logo.className = "match-card__logo";
      logo.src = logoUrl;
      logo.alt = wwcdTeam?.team || "WWCD";
      wrap.appendChild(logo);
      footer.appendChild(wrap);
    }

    if (initials) {
      const init = document.createElement("span");
      init.className = "match-card__initials";
      init.textContent = initials;
      init.style.color = t.accentColor || "#ff6600";
      footer.appendChild(init);
    }
  } else {
    const time = document.createElement("span");
    time.className = "match-card__time";
    time.textContent = match.matchTime || "";
    time.style.color = t.footerTimeColor || t.accentColor || "#ff6600";
    footer.appendChild(time);
  }

  card.appendChild(media);
  card.appendChild(footer);
  return card;
}

function rebuildCards(config) {
  const count = Math.max(1, Math.min(8, Number(config.matchCount) || 6));
  cardsEl.dataset.count = String(count);
  cardsEl.innerHTML = "";
  (config.matches || []).slice(0, count).forEach((m, i) => {
    cardsEl.appendChild(buildCard(m, i, config));
  });
}

function refreshCardsLive(config) {
  if (Date.now() < cardsIntroUntil) return;
  const count = Math.max(1, Math.min(8, Number(config.matchCount) || 6));
  const existing = cardsEl.querySelectorAll(".match-card");
  if (existing.length !== count) {
    rebuildCards(config);
    showCardsInstant(stage, config.animation);
    return;
  }
  const matches = (config.matches || []).slice(0, count);
  matches.forEach((m, i) => {
    const next = buildCard(m, i, config);
    next.classList.add("anim-play");
    existing[i]?.replaceWith(next);
  });
}

let lastConfig = null;
let cardsIntroComplete = false;
let cardsIntroUntil = 0;
let lastAnimReplayKey = -1;
let lastLiveSig = "";

function render(config, { animateCards = false } = {}) {
  applyTheme(config);
  applyBackground(config);
  applyHeader(config);
  rebuildCards(config);

  const replayKey = config.animation?.replayKey ?? 0;
  const count = Math.max(1, Math.min(8, Number(config.matchCount) || 6));
  const shouldAnimate =
    (animateCards || !cardsIntroComplete || replayKey !== lastAnimReplayKey) &&
    config.animation?.enabled !== false;

  if (shouldAnimate) {
    applyAnimationClasses(stage, config.animation, replayKey);
    cardsIntroUntil = Date.now() + cardIntroTotalMs(config.animation, count);
    lastAnimReplayKey = replayKey;
    setTimeout(() => {
      cardsIntroComplete = true;
    }, cardsIntroUntil - Date.now());
  } else {
    showCardsInstant(stage, config.animation);
    cardsIntroComplete = true;
  }
}

async function refreshLiveState() {
  const live = await fetchLiveTournamentState(getScheduleApiBase());
  if (!lastConfig) return;
  const sig = liveCardsSignature(lastConfig, live);
  if (sig === lastLiveSig) return;
  lastLiveSig = sig;
  liveState = live;
  refreshCardsLive(lastConfig);
}

async function init() {
  lastConfig = await getConfig();
  liveState = await fetchLiveTournamentState(getScheduleApiBase());
  lastLiveSig = liveCardsSignature(lastConfig, liveState);
  render(lastConfig, { animateCards: true });
  subscribeConfig((cfg) => {
    const replayKey = cfg.animation?.replayKey ?? 0;
    const replay = replayKey !== lastAnimReplayKey;
    lastConfig = cfg;
    lastLiveSig = liveCardsSignature(cfg, liveState);
    render(cfg, { animateCards: replay });
  });
  setInterval(refreshLiveState, 2000);
}

init();
