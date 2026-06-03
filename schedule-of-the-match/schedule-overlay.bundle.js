/**
 * SCHEDULE OF THE MATCH — single-file overlay (no ES modules; OBS-safe)
 */
(function () {
  "use strict";

  const STORAGE_KEY = "schedule-of-the-match-config";
  const CHANNEL_NAME = "schedule-of-the-match-sync";
  let lastReplayKey = -1;
  let lastConfigJson = "";

  function getScheduleApiBase() {
    const { protocol, hostname, port } = window.location;
    if (port === "5173" || port === "5174" || port === "4173" || port === "4174") {
      return protocol + "//" + hostname + ":" + port + "/api";
    }
    if (port === "3001" || port === "") {
      return protocol + "//" + hostname + (port ? ":" + port : "");
    }
    return protocol + "//" + hostname + ":3001";
  }

  function resolveAssetUrl(url) {
    if (!url) return "";
    if (url.indexOf("data:") === 0 || url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
    if (url.indexOf("/uploads/") === 0) return window.location.origin + url;
    return url;
  }

  const scriptEl = document.currentScript;
  const BASE = scriptEl
    ? scriptEl.src.replace(/\/js\/[^/]*$/, "/")
    : new URL("./", window.location.href).href;

  const MAP_CATALOG = {
    erangel: { displayName: "ERANGEL", asset: "assets/maps/erangel.jpg" },
    miramar: { displayName: "MIRAMAR", asset: "assets/maps/miramar.jpg" },
    rondo: { displayName: "RONDO", asset: "assets/maps/rondo.jpg" },
  };

  const BUILTIN_DEFAULT = {
    matchCount: 6,
    header: {
      title: "SCHEDULE",
      subtitle: "SURVIVAL - DAY 1",
      titleFont: "Bebas Neue",
      subtitleFont: "Teko",
      titleColor: "#ffffff",
      subtitleColor: "#00d4e8",
      titleSize: 148,
      subtitleSize: 42,
      position: { x: 72, y: 48 },
    },
    background: { imageUrl: "", mediaType: "image", opacity: 1, fit: "cover", position: "center center", scale: 1.05 },
    layout: {
      cardGap: 22,
      cardsPaddingX: 64,
      cardsOffsetY: 48,
      headerReserveTop: 200,
      cardWidth: 248,
      cardMediaHeight: 336,
    },
    theme: {
      cardBackground: "#ffffff",
      cardBorderColor: "#1a1f26",
      cardBorderWidth: 1,
      accentColor: "#ff6600",
      mapLabelColor: "#ff6600",
      mapLabelBgColor: "#ffffff",
      footerTextColor: "#111111",
      footerTimeColor: "#ff6600",
      mapLabelFont: "Bebas Neue",
    },
    animation: { type: "staggered", speed: 1, enabled: true, replayKey: 0 },
    matches: [
      { id: "m1", matchNumber: "M1", matchTime: "16:00", mapName: "RONDO", mapKey: "rondo", mapImageUrl: "", showTeamLogo: false, teamLogoUrl: "", teamInitials: "", isWinner: false, showWwcd: false, showRankBadge: false, rankBadgeText: "" },
      { id: "m2", matchNumber: "M2", matchTime: "16:40", mapName: "ERANGEL", mapKey: "erangel", mapImageUrl: "", showTeamLogo: false, teamLogoUrl: "", teamInitials: "", isWinner: false, showWwcd: false, showRankBadge: false, rankBadgeText: "" },
      { id: "m3", matchNumber: "M3", matchTime: "17:20", mapName: "ERANGEL", mapKey: "erangel", mapImageUrl: "", showTeamLogo: false, teamLogoUrl: "", teamInitials: "", isWinner: false, showWwcd: false, showRankBadge: false, rankBadgeText: "" },
      { id: "m4", matchNumber: "M4", matchTime: "18:00", mapName: "ERANGEL", mapKey: "erangel", mapImageUrl: "", showTeamLogo: false, teamLogoUrl: "", teamInitials: "", isWinner: false, showWwcd: false, showRankBadge: false, rankBadgeText: "" },
      { id: "m5", matchNumber: "M5", matchTime: "18:40", mapName: "MIRAMAR", mapKey: "miramar", mapImageUrl: "", showTeamLogo: false, teamLogoUrl: "", teamInitials: "", isWinner: false, showWwcd: false, showRankBadge: false, rankBadgeText: "" },
      { id: "m6", matchNumber: "M6", matchTime: "19:20", mapName: "MIRAMAR", mapKey: "miramar", mapImageUrl: "", showTeamLogo: false, teamLogoUrl: "", teamInitials: "", isWinner: false, showWwcd: false, showRankBadge: false, rankBadgeText: "" },
      { id: "m7", matchNumber: "M7", matchTime: "20:00", mapName: "RONDO", mapKey: "rondo", mapImageUrl: "", showTeamLogo: false, teamLogoUrl: "", teamInitials: "", isWinner: false, showWwcd: false, showRankBadge: false, rankBadgeText: "" },
      { id: "m8", matchNumber: "M8", matchTime: "20:40", mapName: "ERANGEL", mapKey: "erangel", mapImageUrl: "", showTeamLogo: false, teamLogoUrl: "", teamInitials: "", isWinner: false, showWwcd: false, showRankBadge: false, rankBadgeText: "" },
    ],
    winner: {
      matchIndex: 0,
      teamName: "",
      teamLogoUrl: "",
      teamInitials: "TR",
      showChickenDinner: false,
      groupLabel: "GROUP - A&B",
      wwcdImageUrl: "",
    },
  };

  const DESIGN_W = 1920;
  const DESIGN_H = 1080;

  const viewport = document.getElementById("som-viewport");
  const stage = document.getElementById("som-stage");
  const content = document.getElementById("som-root");
  const bgLayer = document.getElementById("som-bg");
  const headerEl = document.getElementById("som-header");
  const titleEl = document.getElementById("som-title");
  const subtitleEl = document.getElementById("som-subtitle");
  const cardsEl = document.getElementById("som-cards");

  if (!stage || !cardsEl || !titleEl) {
    console.error("[schedule-overlay] Missing DOM nodes");
    return;
  }

  function applyViewportFit() {
    const vw = window.innerWidth || DESIGN_W;
    const vh = window.innerHeight || DESIGN_H;
    // OBS browser source should be exactly 1920×1080 — no scaling (1:1 pixels)
    if (Math.abs(vw - DESIGN_W) <= 2 && Math.abs(vh - DESIGN_H) <= 2) {
      stage.style.transform = "";
      return;
    }
    // Preview / odd sizes: scale DOWN to fit entire schedule (never crop header or cards)
    const scale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
    stage.style.transform = scale < 0.999 ? "scale(" + scale + ")" : "";
  }

  function isVideoBackground(bg) {
    if (!bg) return false;
    if (bg.mediaType === "video") return true;
    if (bg.mediaType === "image") return false;
    var u = (bg.imageUrl || "").toLowerCase();
    return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/.test(u) || u.indexOf("data:video/") === 0;
  }

  function sizeBackgroundCoverEl(el, bgConfig) {
    var nw = el.videoWidth || el.naturalWidth;
    var nh = el.videoHeight || el.naturalHeight;
    if (!nw || !nh) return;
    var bleed = Math.max(1, Number(bgConfig && bgConfig.scale) || 1.05);
    var cover = Math.max(DESIGN_W / nw, DESIGN_H / nh);
    var s = cover * bleed;
    el.style.width = Math.ceil(nw * s) + "px";
    el.style.height = Math.ceil(nh * s) + "px";
  }

  applyViewportFit();
  window.addEventListener("resize", applyViewportFit);

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function ensureMatchSlots(config) {
    const n = Math.max(1, Math.min(8, Number(config.matchCount) || 6));
    config.matchCount = n;
    if (!Array.isArray(config.matches)) config.matches = [];
    const seed = config.matches[0] || BUILTIN_DEFAULT.matches[0];
    while (config.matches.length < 8) {
      const i = config.matches.length + 1;
      config.matches.push({ ...clone(seed), id: "m" + i, matchNumber: "M" + i });
    }
    config.matches = config.matches.slice(0, 8);
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach((key) => {
      const sv = source[key];
      if (sv && typeof sv === "object" && !Array.isArray(sv) && target[key] && typeof target[key] === "object") {
        deepMerge(target[key], sv);
      } else {
        target[key] = sv;
      }
    });
    return target;
  }

  async function loadDefaultConfig() {
    try {
      const res = await fetch(BASE + "config/default-config.json");
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("[schedule-overlay] default-config.json", e);
    }
    return clone(BUILTIN_DEFAULT);
  }

  async function fetchServerConfig() {
    try {
      const res = await fetch(getScheduleApiBase() + "/schedule-of-the-match/config", {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && !data.empty && data.matchCount != null) return data;
    } catch (e) {
      console.warn("[schedule-overlay] server", e);
    }
    return null;
  }

  async function getConfig() {
    const server = await fetchServerConfig();
    const defaults = await loadDefaultConfig();
    const out = clone(defaults);
    if (server) deepMerge(out, server);
    else {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) deepMerge(out, JSON.parse(raw));
      } catch (_) {}
    }
    ensureMatchSlots(out);
    normalizeMatchMaps(out);
    if (out.background && !out.background.mediaType) {
      out.background.mediaType = isVideoBackground(out.background) ? "video" : "image";
    }
    return out;
  }

  function normalizeMapKey(mapKey) {
    const k = String(mapKey || "erangel").toLowerCase();
    return MAP_CATALOG[k] ? k : "erangel";
  }

  function normalizeMatchMaps(config) {
    if (!config || !config.matches) return;
    config.matches.forEach(function (m) {
      m.mapKey = normalizeMapKey(m.mapKey);
      if (!m.mapName) m.mapName = MAP_CATALOG[m.mapKey].displayName;
    });
  }

  function mapDisplayName(match) {
    if (match.mapName) return String(match.mapName).toUpperCase();
    const key = (match.mapKey || "erangel").toLowerCase();
    return (MAP_CATALOG[key] || MAP_CATALOG.erangel).displayName;
  }

  function resolveMapImage(match) {
    if (match.mapImageUrl) return match.mapImageUrl;
    const key = (match.mapKey || "erangel").toLowerCase();
    const entry = MAP_CATALOG[key] || MAP_CATALOG.erangel;
    return BASE + entry.asset;
  }

  function speedMult(speed) {
    const s = Number(speed);
    if (!Number.isFinite(s) || s <= 0) return 1;
    return Math.max(0.25, Math.min(3, s));
  }

  function applyAnimations(anim, force) {
    const type = (anim && anim.type) || "staggered";
    const enabled = !anim || anim.enabled !== false;
    const speed = speedMult(anim && anim.speed);
    const duration = Math.round(700 / speed);
    const replayKey = (anim && anim.replayKey) || 0;

    if (!force && replayKey === lastReplayKey && stage.dataset.anim === type) {
      return;
    }
    lastReplayKey = replayKey;

    stage.dataset.anim = type;
    stage.dataset.animEnabled = enabled ? "1" : "0";
    stage.style.setProperty("--anim-duration", duration + "ms");

    const cards = cardsEl.querySelectorAll(".match-card");
    cards.forEach(function (card, i) {
      card.style.setProperty("--stagger-delay", Math.round((80 + i * 90) / speed) + "ms");
      card.classList.remove("anim-play", "anim-pending");
      card.style.animation = "none";
      card.style.opacity = "";
      card.style.transform = "";
      card.style.clipPath = "";
      card.style.filter = "";
      void card.offsetWidth;
      if (!enabled) {
        card.classList.add("anim-play");
        return;
      }
      card.classList.add("anim-pending");
    });

    if (!enabled || !cards.length) return;

    setTimeout(function () {
      cards.forEach(function (card) {
        card.style.animation = "";
        card.classList.add("anim-play");
      });
    }, 60);

    setTimeout(function () {
      cards.forEach(function (c) {
        c.classList.add("anim-play");
        c.classList.remove("anim-pending");
      });
    }, duration + 1400);
  }

  function buildCard(match, index, config) {
    const t = config.theme || {};
    const winner = config.winner || {};
    const winnerIdx = Math.max(0, Math.min(7, Number(winner.matchIndex) || 0));
    const isWinnerSlot = !!(
      winner.showChickenDinner &&
      (index === winnerIdx || match.isWinner)
    );
    /* Finished match = WWCD only — never show map name / map art on this card */
    const showWwcd = isWinnerSlot;
    const logoUrl = match.teamLogoUrl || (isWinnerSlot ? winner.teamLogoUrl : "");
    const showLogo = match.showTeamLogo && logoUrl;

    const card = document.createElement("article");
    card.className = "match-card";
    if (showWwcd) card.classList.add("is-winner");
    card.style.borderColor = t.cardBorderColor || "#1a1f26";
    card.style.borderWidth = (t.cardBorderWidth != null ? t.cardBorderWidth : 1) + "px";

    const media = document.createElement("div");
    media.className = "match-card__media";

    if (showWwcd) {
      const winnerCfg = config.winner || {};
      const artUrl =
        winnerCfg.wwcdImageUrl ||
        match.wwcdImageUrl ||
        BASE + "assets/badges/wwcd-chicken.png";
      const wwcdImg = document.createElement("img");
      wwcdImg.className = "map-photo wwcd-photo";
      wwcdImg.alt = "WWCD";
      wwcdImg.decoding = "async";
      wwcdImg.src = resolveAssetUrl(artUrl) || artUrl;
      media.appendChild(wwcdImg);
    } else {
      const mapName = mapDisplayName(match);
      const mapImg = document.createElement("img");
      mapImg.className = "map-photo";
      mapImg.alt = mapName;
      mapImg.src = resolveMapImage(match);
      media.appendChild(mapImg);
      const label = document.createElement("div");
      label.className = "match-card__map-label";
      label.textContent = mapName;
      label.style.color = t.mapLabelColor || "#ff6600";
      label.style.background = t.mapLabelBgColor || "#fff";
      label.style.fontFamily = '"' + (t.mapLabelFont || "Bebas Neue") + '", sans-serif';
      if (mapName.length >= 8) label.dataset.len = "long";
      else if (mapName.length >= 6) label.dataset.len = "medium";
      media.appendChild(label);
    }

    const footer = document.createElement("footer");
    footer.className = "match-card__footer";
    const matchNo = document.createElement("span");
    matchNo.className = "match-card__match-no";
    matchNo.textContent = match.matchNumber || "M" + (index + 1);
    matchNo.style.color = t.footerTextColor || "#111";
    footer.appendChild(matchNo);

    if (showLogo) {
      footer.classList.add("has-logo");
      const wrap = document.createElement("div");
      wrap.className = "match-card__logo-wrap";
      const logo = document.createElement("img");
      logo.className = "match-card__logo";
      logo.src = logoUrl;
      wrap.appendChild(logo);
      footer.appendChild(wrap);
      const init = match.teamInitials || winner.teamInitials || "";
      if (init) {
        const span = document.createElement("span");
        span.className = "match-card__initials";
        span.textContent = init;
        span.style.color = t.accentColor || "#ff6600";
        footer.appendChild(span);
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

  function applyLayout(config) {
    const L = config.layout || {};
    stage.style.setProperty("--cards-gap", (L.cardGap != null ? L.cardGap : 22) + "px");
    stage.style.setProperty("--cards-pad-x", (L.cardsPaddingX != null ? L.cardsPaddingX : 64) + "px");
    stage.style.setProperty("--cards-offset-y", (L.cardsOffsetY != null ? L.cardsOffsetY : 48) + "px");
    stage.style.setProperty("--header-reserve", (L.headerReserveTop != null ? L.headerReserveTop : 200) + "px");
    stage.style.setProperty("--card-width", (L.cardWidth != null ? L.cardWidth : 248) + "px");
    stage.style.setProperty("--card-media-h", (L.cardMediaHeight != null ? L.cardMediaHeight : 336) + "px");
  }

  function render(config) {
    const t = config.theme || {};
    applyLayout(config);
    stage.style.setProperty("--card-bg", t.cardBackground || "#fff");
    stage.style.setProperty("--card-border-w", (t.cardBorderWidth != null ? t.cardBorderWidth : 1) + "px");
    stage.style.setProperty("--card-border-c", t.cardBorderColor || "rgba(12, 16, 22, 0.45)");
    stage.style.setProperty("--accent", t.accentColor || "#ff6600");
    if (content) content.style.setProperty("--accent", t.accentColor || "#ff6600");

    bgLayer.innerHTML = "";
    const bg = config.background || {};
    const hasBg = !!bg.imageUrl;
    if (viewport) viewport.classList.toggle("has-bg", hasBg);
    if (hasBg) {
      const url = resolveAssetUrl(bg.imageUrl);
      const fit = bg.fit === "contain" ? "contain" : "cover";
      const opacity = String(bg.opacity != null ? bg.opacity : 1);
      const isVideo = isVideoBackground(bg);

      if (isVideo && fit === "cover") {
        const video = document.createElement("video");
        video.className = "som-bg__cover som-bg__cover-video";
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.style.opacity = opacity;
        video.onloadedmetadata = function () {
          sizeBackgroundCoverEl(video, bg);
        };
        video.onerror = function () {
          console.warn("[schedule-overlay] background video failed:", url);
        };
        video.src = url;
        bgLayer.appendChild(video);
        var playP = video.play();
        if (playP && playP.catch) playP.catch(function () {});
      } else if (fit === "cover") {
        const img = document.createElement("img");
        img.className = "som-bg__cover";
        img.alt = "";
        img.decoding = "async";
        img.style.opacity = opacity;
        img.onload = function () {
          sizeBackgroundCoverEl(img, bg);
        };
        img.onerror = function () {
          console.warn("[schedule-overlay] background image failed:", url);
        };
        img.src = url;
        if (img.complete && img.naturalWidth) sizeBackgroundCoverEl(img, bg);
        bgLayer.appendChild(img);
      } else {
        const fill = document.createElement("div");
        fill.className = "som-bg__fill";
        fill.dataset.fit = "contain";
        if (isVideo) {
          const video = document.createElement("video");
          video.muted = true;
          video.loop = true;
          video.autoplay = true;
          video.playsInline = true;
          video.style.opacity = opacity;
          video.style.width = "100%";
          video.style.height = "100%";
          video.style.objectFit = "contain";
          video.src = url;
          fill.appendChild(video);
          var p2 = video.play();
          if (p2 && p2.catch) p2.catch(function () {});
        } else {
          fill.style.backgroundImage = "url(" + JSON.stringify(url) + ")";
          fill.style.backgroundPosition = bg.position || "center center";
          fill.style.opacity = opacity;
        }
        bgLayer.appendChild(fill);
      }
      bgLayer.style.display = "block";
    } else {
      bgLayer.style.display = "none";
    }
    applyViewportFit();

    const h = config.header || {};
    titleEl.textContent = h.title || "SCHEDULE";
    subtitleEl.textContent = h.subtitle || "";
    titleEl.style.fontFamily = '"' + (h.titleFont || "Bebas Neue") + '", sans-serif';
    subtitleEl.style.fontFamily = '"' + (h.subtitleFont || "Teko") + '", sans-serif';
    titleEl.style.color = h.titleColor || "#ffffff";
    subtitleEl.style.color = h.subtitleColor || "#00d4e8";
    titleEl.style.fontSize = (h.titleSize || 148) + "px";
    subtitleEl.style.fontSize = (h.subtitleSize || 42) + "px";
    headerEl.style.left = (h.position && h.position.x != null ? h.position.x : 72) + "px";
    headerEl.style.top = (h.position && h.position.y != null ? h.position.y : 48) + "px";

    const count = Math.max(1, Math.min(8, Number(config.matchCount) || 6));
    cardsEl.dataset.count = String(count);
    cardsEl.innerHTML = "";
    (config.matches || []).slice(0, count).forEach(function (m, i) {
      cardsEl.appendChild(buildCard(m, i, config));
    });

    applyAnimations(config.animation, true);
  }

  function onConfig(cfg) {
    const json = JSON.stringify(cfg);
    const replayChanged = (cfg.animation && cfg.animation.replayKey) !== lastReplayKey;
    if (json === lastConfigJson && !replayChanged) return;
    lastConfigJson = json;
    render(cfg);
  }

  function subscribe() {
    window.addEventListener("storage", function (e) {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          onConfig(JSON.parse(e.newValue));
        } catch (_) {}
      }
    });
    window.addEventListener("message", function (ev) {
      if (ev.data && (ev.data.type === "som-reload" || ev.data.type === "config") && ev.data.config) {
        onConfig(ev.data.config);
      }
    });
    try {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = function (ev) {
        if (ev.data && ev.data.type === "config" && ev.data.config) onConfig(ev.data.config);
      };
    } catch (_) {}

    setInterval(function () {
      fetchServerConfig().then(function (cfg) {
        if (cfg) onConfig(cfg);
      });
    }, 1500);
  }

  getConfig()
    .then(function (cfg) {
      onConfig(cfg);
    })
    .catch(function (err) {
      console.error("[schedule-overlay]", err);
      onConfig(clone(BUILTIN_DEFAULT));
    });

  subscribe();
})();
