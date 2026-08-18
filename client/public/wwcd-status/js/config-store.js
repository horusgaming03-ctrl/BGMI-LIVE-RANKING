/* WWCD STATUS — config store (modeled on schedule-of-the-match/config-store.js) */

const STORAGE_KEY = "wwcd-status-config";
const CHANNEL_NAME = "wwcd-status-sync";

let defaultConfigCache = null;

export function getStorageKey() {
  return STORAGE_KEY;
}

export function getChannelName() {
  return CHANNEL_NAME;
}

/** API base (Vite dev -> /api proxy, Node -> direct :3001). */
export function getApiBase() {
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;
  if (protocol === "file:" || !hostname) return "http://127.0.0.1:3001";
  if (port === "5173" || port === "5174" || port === "4173" || port === "4174") {
    return `${protocol}//${hostname}:${port}/api`;
  }
  if (port === "3001" || port === "") {
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }
  return `${protocol}//${hostname}:3001`;
}

export function resolveAssetUrl(url) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads/")) return `${window.location.origin}${url}`;
  return url;
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;

export function isVideoUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("data:video/")) return true;
  return VIDEO_EXT.test(url);
}

export function backgroundMediaType(bg) {
  if (!bg) return "image";
  if (bg.mediaType === "video") return "video";
  if (bg.mediaType === "image") return "image";
  return isVideoUrl(bg.imageUrl) ? "video" : "image";
}

/** Upload an image/video to the WWCD STATUS uploads folder. Returns { url, mediaType }. */
export async function uploadBackground(file) {
  const fd = new FormData();
  fd.append("background", file);
  const res = await fetch(`${getApiBase()}/wwcd-status/upload-background`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload failed (${res.status})`);
  }
  const data = await res.json();
  return { url: data.url, mediaType: data.mediaType };
}

export async function loadDefaultConfig() {
  if (defaultConfigCache) return structuredClone(defaultConfigCache);
  const url = new URL("../config/default-config.json", import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load default-config.json");
  defaultConfigCache = await res.json();
  return structuredClone(defaultConfigCache);
}

export function loadLocalConfig() {
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

/** Pull the first two hex colours out of a CSS gradient/colour string. */
function parseTintStops(str) {
  if (!str || typeof str !== "string") return [];
  const m = str.match(/#[0-9a-f]{3,8}/gi);
  return m || [];
}

export function ensureCards(config) {
  if (!Array.isArray(config.cards)) config.cards = [];
  while (config.cards.length < 4) {
    const i = config.cards.length + 1;
    config.cards.push({ name: `PLAYER ${i}`, finishes: 0, characterImageUrl: "" });
  }
  config.cards = config.cards.slice(0, 4);

  // Per-character image transform (zoom / move / stretch). Defaults = identity.
  config.cards.forEach((c, i) => {
    if (!c.transform || typeof c.transform !== "object") c.transform = {};
    const tf = c.transform;
    if (typeof tf.zoom !== "number") tf.zoom = 1;
    if (typeof tf.x !== "number") tf.x = 0;
    if (typeof tf.y !== "number") tf.y = 0;
    if (typeof tf.stretchX !== "number") tf.stretchX = 1;
    if (typeof tf.stretchY !== "number") tf.stretchY = 1;
    if (typeof c.manualName !== "boolean") c.manualName = false;
    if (typeof c.manualFinishes !== "boolean") c.manualFinishes = false;
    if (!c.name) c.name = `PLAYER ${i + 1}`;
    if (typeof c.finishes !== "number") c.finishes = 0;
  });

  // Character-background tint: ensure Top/Bottom hex pickers exist. Seed them from
  // an existing mediaTint gradient when possible, else the teal defaults.
  if (!config.theme || typeof config.theme !== "object") config.theme = {};
  const th = config.theme;
  if (!th.mediaTintTop || !th.mediaTintBottom) {
    const stops = parseTintStops(th.mediaTint);
    if (!th.mediaTintTop) th.mediaTintTop = stops[0] || "#15b6c4";
    if (!th.mediaTintBottom) th.mediaTintBottom = stops[1] || stops[0] || "#0a5a64";
  }
  if (!th.mediaTint) {
    th.mediaTint = `linear-gradient(180deg, ${th.mediaTintTop} 0%, ${th.mediaTintBottom} 100%)`;
  }
  if (!config.background) {
    config.background = { imageUrl: "", mediaType: "image", opacity: 1, fit: "cover", position: "center center", scale: 1.05 };
  } else if (!config.background.mediaType) {
    config.background.mediaType = backgroundMediaType(config.background);
  }
  if (!config.animation) config.animation = { type: "staggered", speed: 1, enabled: true, replayKey: 0 };
  if (!config.team) config.team = { name: "", logoUrl: "", showFooter: true };
  if (!config.team.labelColor) config.team.labelColor = "#ffffff";
  if (!config.team.nameColor) config.team.nameColor = config.theme?.accent || "#ff6600";
  if (!config.header) {
    config.header = {
      title: "WWCD TEAM STATS",
      subtitle: "",
      titleColor: "#ffffff",
      titleSize: 118,
      subtitleSize: 40,
      logoUrl: "",
      position: { x: 96, y: 70 },
    };
  } else if (!config.header.position) {
    config.header.position = { x: 96, y: 70 };
  }
  if (config.winnerSource !== "manual") config.winnerSource = "live";
}

export async function saveConfig(config) {
  ensureCards(config);
  const api = getApiBase();
  let serverSaved = false;
  let serverHint = "";

  try {
    const res = await fetch(`${api}/wwcd-status/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) serverSaved = true;
    else serverHint = `Server ${res.status}`;
  } catch (e) {
    serverHint = e?.message || "Network error";
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    if (e?.name === "QuotaExceededError") {
      throw new Error("Browser storage full — use a smaller image or upload via file picker.");
    }
    if (!serverSaved) throw e;
  }

  broadcastConfig(config);

  if (!serverSaved) {
    return { localOnly: true, warning: `${serverHint} — saved in this browser only. Is the backend running on port 3001?` };
  }
  return { ok: true };
}

export async function getConfig() {
  const defaults = await loadDefaultConfig();
  try {
    const res = await fetch(`${getApiBase()}/wwcd-status/config`);
    if (res.ok) {
      const server = await res.json();
      if (server && !server.empty && Array.isArray(server.cards)) {
        return mergeWithDefaults(server, defaults);
      }
    }
  } catch (e) {
    console.warn("[wwcd-status] server load:", e.message);
  }
  const saved = loadLocalConfig();
  if (saved) return mergeWithDefaults(saved, defaults);
  return defaults;
}

function mergeWithDefaults(saved, defaults) {
  const out = structuredClone(defaults);
  if (!saved || typeof saved !== "object") return out;
  deepMerge(out, saved);
  ensureCards(out);
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

export function exportConfigJson(config) {
  return JSON.stringify(config, null, 2);
}

export async function importConfigJson(text) {
  const parsed = JSON.parse(text);
  ensureCards(parsed);
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
