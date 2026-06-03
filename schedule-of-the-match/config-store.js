import { normalizeMatchMaps } from "./map-catalog.js";

const STORAGE_KEY = "schedule-of-the-match-config";
const CHANNEL_NAME = "schedule-of-the-match-sync";

let defaultConfigCache = null;

export function getStorageKey() {
  return STORAGE_KEY;
}

export function getChannelName() {
  return CHANNEL_NAME;
}

/** API base for schedule admin/overlay (Vite → /api, Node → direct). */
export function getScheduleApiBase() {
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;
  if (port === "5173" || port === "5174" || port === "4173" || port === "4174") {
    return `${protocol}//${hostname}:${port}/api`;
  }
  if (port === "3001" || port === "") {
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }
  return `${protocol}//${hostname}:3001`;
}

export function resolveScheduleAssetUrl(url) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads/")) {
    return `${window.location.origin}${url}`;
  }
  return url;
}

export async function compressImageFile(file, maxW = 1920, quality = 0.82) {
  if (!file) throw new Error("No file");
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = blobUrl;
    });
    const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
    const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;

export function isScheduleVideoUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("data:video/")) return true;
  return VIDEO_EXT.test(url);
}

export function scheduleBackgroundMediaType(bg) {
  if (!bg) return "image";
  if (bg.mediaType === "video") return "video";
  if (bg.mediaType === "image") return "image";
  return isScheduleVideoUrl(bg.imageUrl) ? "video" : "image";
}

/** Client-side duration check for background video (1–10 s). */
export function probeBackgroundFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file"));
    const url = URL.createObjectURL(file);
    const isVideo = (file.type || "").startsWith("video/");
    const el = document.createElement(isVideo ? "video" : "img");
    el.preload = "metadata";
    const cleanup = () => URL.revokeObjectURL(url);
    el.onloadedmetadata = () => {
      const duration = isVideo ? el.duration : null;
      cleanup();
      resolve({ isVideo, duration });
    };
    el.onerror = () => {
      cleanup();
      reject(new Error("Could not read file"));
    };
    if (isVideo) {
      el.muted = true;
      el.playsInline = true;
    }
    el.src = url;
  });
}

export async function uploadScheduleBackground(file) {
  const fd = new FormData();
  fd.append("background", file);
  const res = await fetch(`${getScheduleApiBase()}/schedule-of-the-match/upload-background`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload failed (${res.status})`);
  }
  const data = await res.json();
  return data.url;
}

export async function loadDefaultConfig() {
  if (defaultConfigCache) return structuredClone(defaultConfigCache);
  const url = new URL("../config/default-config.json", import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load default-config.json");
  defaultConfigCache = await res.json();
  return structuredClone(defaultConfigCache);
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function broadcastConfig(config) {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage({ type: "config", config });
    ch.close();
  } catch {
    /* ignore */
  }
}

export async function saveConfig(config) {
  ensureMatchSlots(config);
  const api = getScheduleApiBase();
  let serverSaved = false;
  let serverHint = "";

  try {
    const res = await fetch(`${api}/schedule-of-the-match/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      serverSaved = true;
    } else {
      serverHint = `Server ${res.status}`;
    }
  } catch (e) {
    serverHint = e?.message || "Network error";
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    if (e?.name === "QuotaExceededError") {
      throw new Error("Browser storage full — use a smaller background image or upload via file picker.");
    }
    if (!serverSaved) throw e;
  }

  broadcastConfig(config);

  if (!serverSaved) {
    return {
      localOnly: true,
      warning:
        serverHint +
        " — saved in this browser only. Restart dev server (Ctrl+C, npm run dev) if OBS sync fails.",
    };
  }
  return { ok: true };
}

export async function getConfig() {
  const defaults = await loadDefaultConfig();
  try {
    const res = await fetch(`${getScheduleApiBase()}/schedule-of-the-match/config`);
    if (res.ok) {
      const server = await res.json();
      if (server && !server.empty && server.matchCount != null) {
        return mergeWithDefaults(server, defaults);
      }
    }
  } catch (e) {
    console.warn("[schedule] server load:", e.message);
  }
  const saved = loadConfig();
  if (saved) return mergeWithDefaults(saved, defaults);
  return defaults;
}

function mergeWithDefaults(saved, defaults) {
  const out = structuredClone(defaults);
  if (!saved || typeof saved !== "object") return out;
  deepMerge(out, saved);
  ensureMatchSlots(out);
  normalizeMatchMaps(out);
  if (!out.background) {
    out.background = { imageUrl: "", mediaType: "image", opacity: 1, fit: "cover", position: "center center", scale: 1.05 };
  } else if (!out.background.mediaType) {
    out.background.mediaType = scheduleBackgroundMediaType(out.background);
  }
  if (!out.animation) out.animation = { type: "staggered", speed: 1, enabled: true, replayKey: 0 };
  if (!out.layout) {
    out.layout = {
      cardGap: 22,
      cardsPaddingX: 64,
      cardsOffsetY: 48,
      headerReserveTop: 200,
      cardWidth: 248,
      cardMediaHeight: 336,
    };
  }
  return out;
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (sv && typeof sv === "object" && !Array.isArray(sv) && target[key] && typeof target[key] === "object") {
      deepMerge(target[key], sv);
    } else {
      target[key] = sv;
    }
  }
}

export function ensureMatchSlots(config) {
  const n = Math.max(1, Math.min(8, Number(config.matchCount) || 6));
  config.matchCount = n;
  if (!Array.isArray(config.matches)) config.matches = [];
  if (!config.background) config.background = { imageUrl: "", opacity: 1, fit: "cover" };
  if (!config.animation) config.animation = { type: "staggered", speed: 1, enabled: true, replayKey: 0 };
  if (!config.layout) {
    config.layout = {
      cardGap: 22,
      cardsPaddingX: 64,
      cardsOffsetY: 48,
      headerReserveTop: 200,
      cardWidth: 248,
      cardMediaHeight: 336,
    };
  }
  const defaults = config.matches[0] || {
    matchNumber: "M1",
    matchTime: "16:00",
    mapName: "ERANGEL",
    mapKey: "erangel",
    mapImageUrl: "",
    showTeamLogo: false,
    teamLogoUrl: "",
    teamInitials: "",
    isWinner: false,
    showWwcd: false,
    showRankBadge: false,
    rankBadgeText: "",
  };
  while (config.matches.length < 8) {
    const i = config.matches.length + 1;
    config.matches.push({
      ...structuredClone(defaults),
      id: `m${i}`,
      matchNumber: `M${i}`,
    });
  }
  config.matches = config.matches.slice(0, 8);
}

export function exportConfigJson(config) {
  return JSON.stringify(config, null, 2);
}

export async function importConfigJson(text) {
  const parsed = JSON.parse(text);
  ensureMatchSlots(parsed);
  await saveConfig(parsed);
  return parsed;
}

export function subscribeConfig(callback) {
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        callback(JSON.parse(e.newValue));
      } catch {
        /* ignore */
      }
    }
  };
  window.addEventListener("storage", onStorage);

  let channel = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (ev) => {
      if (ev.data?.type === "config" && ev.data.config) callback(ev.data.config);
    };
  } catch {
    /* ignore */
  }

  return () => {
    window.removeEventListener("storage", onStorage);
    if (channel) channel.close();
  };
}
