import { getConfig, subscribeConfig } from "./config-store.js";
import { mountScheduleBackground } from "./schedule-bg-render.js";
import { MAP_CATALOG, resolveMapImage, mapDisplayName } from "./map-catalog.js";
import { applyAnimationClasses } from "./animations.js";
import { createWwcdMapImage } from "./wwcd-panel.js";

const root = document.getElementById("som-root");
const stage = document.getElementById("som-stage");
const bgLayer = document.getElementById("som-bg");
const headerEl = document.getElementById("som-header");
const titleEl = document.getElementById("som-title");
const subtitleEl = document.getElementById("som-subtitle");
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

function applyBackground(config) {
  const bg = config.background || {};
  const resolve = (url) => {
    if (!url) return "";
    if (url.startsWith("/")) return `${window.location.origin}${url}`;
    return url;
  };
  mountScheduleBackground(bgLayer, bg, resolve);
}

function applyHeader(config) {
  const h = config.header || {};
  ensureFont(h.titleFont);
  ensureFont(h.subtitleFont);
  titleEl.textContent = h.title || "SCHEDULE";
  subtitleEl.textContent = h.subtitle || "";
  titleEl.style.fontFamily = `"${h.titleFont || "Bebas Neue"}", sans-serif`;
  subtitleEl.style.fontFamily = `"${h.subtitleFont || "Teko"}", sans-serif`;
  titleEl.style.color = h.titleColor || "#ffffff";
  subtitleEl.style.color = h.subtitleColor || "#00d4e8";
  titleEl.style.fontSize = `${h.titleSize || 148}px`;
  subtitleEl.style.fontSize = `${h.subtitleSize || 42}px`;
  const pos = h.position || { x: 72, y: 48 };
  headerEl.style.left = `${pos.x}px`;
  headerEl.style.top = `${pos.y}px`;
}

function buildCard(match, index, config) {
  const t = config.theme || {};
  const winner = config.winner || {};
  const winnerIdx = Math.max(0, Math.min(7, Number(winner.matchIndex) || 0));
  const isWinnerSlot = !!(
    winner.showChickenDinner &&
    (index === winnerIdx || match.isWinner)
  );
  const showWwcd = isWinnerSlot;
  const showLogo = match.showTeamLogo && (match.teamLogoUrl || winner.teamLogoUrl);
  const logoUrl = match.teamLogoUrl || (isWinnerSlot ? winner.teamLogoUrl : "");
  const initials =
    match.teamInitials ||
    (isWinnerSlot ? winner.teamInitials : "") ||
    "";

  const card = document.createElement("article");
  card.className = "match-card anim-play";
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
  if (showLogo || (showWwcd && logoUrl)) footer.classList.add("has-logo");

  const matchNo = document.createElement("span");
  matchNo.className = "match-card__match-no";
  matchNo.textContent = match.matchNumber || `M${index + 1}`;
  matchNo.style.color = t.footerTextColor || "#111111";
  footer.appendChild(matchNo);

  if (showLogo || (showWwcd && logoUrl)) {
    const wrap = document.createElement("div");
    wrap.className = "match-card__logo-wrap";
    const logo = document.createElement("img");
    logo.className = "match-card__logo";
    logo.src = logoUrl;
    logo.alt = "Team";
    wrap.appendChild(logo);
    footer.appendChild(wrap);

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

function render(config) {
  applyTheme(config);
  applyBackground(config);
  applyHeader(config);

  const count = Math.max(1, Math.min(8, Number(config.matchCount) || 6));
  cardsEl.dataset.count = String(count);
  cardsEl.innerHTML = "";

  const matches = (config.matches || []).slice(0, count);
  matches.forEach((m, i) => {
    cardsEl.appendChild(buildCard(m, i, config));
  });

  applyAnimationClasses(stage, config.animation, config.animation?.replayKey);
}

async function init() {
  const config = await getConfig();
  render(config);
  subscribeConfig((cfg) => render(cfg));
}

init();
