/**
 * Side match banner (/overlay/side-banner) defaults.
 * Keep in sync with sanitizeSideOverlayPrefs() in backend-bgm/index.js
 */
export const SIDE_OVERLAY_DEFAULT_PREFS = {
  groupLabel: "GROUP A",
  useLiveMatchNumber: true,
  matchNumberManual: 4,
  useLiveMapName: true,
  mapNameManual: "",
  /** When set (1–999), appended to top row as ` · MAP n` */
  mapOrdinal: null,
  logoPanelBg: "#f7931e",
  topBarBg: "#ffffff",
  topBarText: "#151515",
  mapAreaBgStart: "#0f5f5f",
  mapAreaBgEnd: "#073030",
  mapNameColor: "#ffffff",
  sparkleColor: "#e63946",
  showSparkle: true,
  bannerScale: 1,
};

/** Palette keys sanitized to `#rrggbb` for HTML color inputs + API */
export const SIDE_OVERLAY_HEX_KEYS = Object.freeze([
  "logoPanelBg",
  "topBarBg",
  "topBarText",
  "mapAreaBgStart",
  "mapAreaBgEnd",
  "mapNameColor",
  "sparkleColor",
]);

/**
 * Coerce to `#rrggbb` for `<input type="color">` (6-digit hex only).
 * Accepts `#rgb`, `#rrggbb`, `#rrggbbaa` (alpha stripped).
 */
export function clampHexColor(value, fallback) {
  const fb =
    typeof fallback === "string" && /^#[0-9A-Fa-f]{6}$/.test(String(fallback).trim())
      ? String(fallback).trim().toLowerCase()
      : "#ffffff";
  if (value == null || typeof value !== "string") return fb;
  const s = value.trim();
  const m = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.exec(s);
  if (!m) return fb;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  else if (h.length === 8) h = h.slice(0, 6); /* rrggbbaa → rrggbb */
  if (h.length !== 6) return fb;
  return `#${h.toLowerCase()}`;
}

function clampAllColors(draft) {
  const o = { ...draft };
  for (const k of SIDE_OVERLAY_HEX_KEYS) {
    const def = SIDE_OVERLAY_DEFAULT_PREFS[k];
    o[k] = clampHexColor(o[k], def);
  }
  return o;
}

/** Merge server patch onto defaults + normalize palette hex codes. */
export function mergeSideOverlayPrefs(patch) {
  if (!patch || typeof patch !== "object") return clampAllColors({ ...SIDE_OVERLAY_DEFAULT_PREFS });
  return clampAllColors({ ...SIDE_OVERLAY_DEFAULT_PREFS, ...patch });
}

/** Stable stringify for detecting unsaved drafts (autosave gate). */
export function stableCanonSidePrefs(prefs) {
  const o = mergeSideOverlayPrefs(prefs);
  const keys = [...Object.keys(SIDE_OVERLAY_DEFAULT_PREFS)].sort();
  const norm = {};
  for (const k of keys) {
    norm[k] = o[k];
  }
  return JSON.stringify(norm);
}
