const STORAGE_KEY = "overall-standing-config";
const CHANNEL_NAME = "overall-standing-sync";

let defaultConfigCache = null;

export function getStorageKey() {
  return STORAGE_KEY;
}

export function getChannelName() {
  return CHANNEL_NAME;
}

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

export function backgroundMediaType(bg) {
  if (!bg) return "image";
  if (bg.mediaType === "video") return "video";
  if (bg.mediaType === "image") return "image";
  if (bg.imageUrl && (bg.imageUrl.startsWith("data:video/") || VIDEO_EXT.test(bg.imageUrl))) return "video";
  return "image";
}

export async function uploadBackground(file) {
  const fd = new FormData();
  fd.append("background", file);
  const res = await fetch(`${getApiBase()}/overall-standing/upload-background`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function uploadAsset(file, field = "asset") {
  const fd = new FormData();
  fd.append(field, file);
  const res = await fetch(`${getApiBase()}/overall-standing/upload-asset`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload failed (${res.status})`);
  }
  return res.json();
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

export function ensureFeatured(config) {
  if (!config.featured || typeof config.featured !== "object") config.featured = {};
  if (!Array.isArray(config.featured.characterUrls)) {
    config.featured.characterUrls = [""];
  }
  const first = config.featured.characterUrls.find((u) => u && String(u).trim()) || config.featured.characterUrls[0] || "";
  config.featured.characterUrls = [first];
}

export function ensureLabels(config) {
  const defaults = {
    colPos: "POS.",
    colTeam: "TEAM NAME",
    colWwcd: "WWCD",
    colPlace: "PLACE",
    colFinish: "FINISH",
    colTotal: "TOTAL",
    featuredPoints: "TOTAL POINTS",
  };
  if (!config.labels || typeof config.labels !== "object") config.labels = {};
  for (const [k, v] of Object.entries(defaults)) {
    if (config.labels[k] == null || config.labels[k] === "") config.labels[k] = v;
  }
}

export function normalizeConfig(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  const config = structuredClone(base);
  if (!config.header) config.header = {};
  if (!config.background) config.background = {};
  if (!config.theme) config.theme = {};
  if (!config.animation) config.animation = {};
  if (!config.layout) config.layout = { mode: "contentOnly", dynamicColumns: true, showTitle: true, showFeatured: true, showTableHeader: true };
  if (!config.layout.mode) config.layout.mode = "contentOnly";
  if (config.layout.dynamicColumns == null) config.layout.dynamicColumns = true;
  if (config.layout.showTitle == null) config.layout.showTitle = true;
  ensureFeatured(config);
  ensureLabels(config);
  return config;
}

export async function getConfig() {
  const defaults = await loadDefaultConfig();
  const local = loadLocalConfig();
  let merged = normalizeConfig(defaults);
  if (local) merged = normalizeConfig({ ...defaults, ...local, header: { ...defaults.header, ...local.header }, background: { ...defaults.background, ...local.background }, theme: { ...defaults.theme, ...local.theme }, labels: { ...defaults.labels, ...local.labels }, featured: { ...defaults.featured, ...local.featured }, animation: { ...defaults.animation, ...local.animation }, layout: { ...defaults.layout, ...local.layout } });
  try {
    const res = await fetch(`${getApiBase()}/overall-standing/config`);
    if (res.ok) {
      const server = await res.json();
      if (server && !server.empty) {
        merged = normalizeConfig({ ...merged, ...server, header: { ...merged.header, ...server.header }, background: { ...merged.background, ...server.background }, theme: { ...merged.theme, ...server.theme }, labels: { ...merged.labels, ...server.labels }, featured: { ...merged.featured, ...server.featured }, animation: { ...merged.animation, ...server.animation }, layout: { ...merged.layout, ...server.layout } });
      }
    }
  } catch (e) {
    console.warn("[overall-standing] server load:", e.message);
  }
  return merged;
}

export async function saveConfig(config) {
  const normalized = normalizeConfig(config);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  broadcastConfig(normalized);
  const res = await fetch(`${getApiBase()}/overall-standing/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalized),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Save failed (${res.status})`);
  }
  return normalized;
}

export function subscribeConfig(cb) {
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        cb(normalizeConfig(JSON.parse(e.newValue)));
      } catch {
        /* ignore */
      }
    }
  };
  window.addEventListener("storage", onStorage);
  let ch = null;
  try {
    ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (e) => {
      if (e.data?.type === "config" && e.data.config) cb(normalizeConfig(e.data.config));
    };
  } catch {
    /* ignore */
  }
  return () => {
    window.removeEventListener("storage", onStorage);
    if (ch) ch.close();
  };
}

export function exportConfigJson(config) {
  return JSON.stringify(normalizeConfig(config), null, 2);
}

export async function importConfigJson(text) {
  const parsed = normalizeConfig(JSON.parse(text));
  await saveConfig(parsed);
  return parsed;
}
