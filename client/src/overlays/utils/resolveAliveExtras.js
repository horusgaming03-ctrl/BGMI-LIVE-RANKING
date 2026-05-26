import { themedMatchBoardPrefsApply } from "./overlayPrefsMatch";
import { getPresetConfig } from "../presets";

const ICON_PREFIX = "/uploads/alive-icons/";

export function sanitizeAliveIconPath(s) {
  if (typeof s !== "string" || !s.startsWith(ICON_PREFIX)) return null;
  if (s.includes("..") || s.includes("://")) return null;
  return s;
}

/** Grid 2×2 vs single horizontal line — orthogonal to ?alive= shape. */
export function normalizeAliveLayout(v) {
  return v === "line" ? "line" : "grid";
}

export function resolveAliveLayout(searchOrParams, savedPrefs = null) {
  const p = typeof searchOrParams === "string" ? new URLSearchParams(searchOrParams) : searchOrParams;
  const raw = p?.get?.("aliveLayout");
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (raw === "line" || raw === "grid") return raw;
  if (
    savedPrefs &&
    typeof savedPrefs === "object" &&
    savedPrefs.overlayPath &&
    themedMatchBoardPrefsApply(savedPrefs.overlayPath, path)
  ) {
    return normalizeAliveLayout(savedPrefs.aliveLayout);
  }
  const presetName = p?.get?.("preset");
  if (presetName) {
    const pc = getPresetConfig(presetName);
    if (pc?.aliveLayout === "line" || pc?.aliveLayout === "grid") return pc.aliveLayout;
  }
  return "grid";
}

/** Server-relative paths under /uploads/alive-icons/ — prepend API base when rendering <img>. */
export function resolveAliveCustomIcons(searchOrParams, savedPrefs = null) {
  const p = typeof searchOrParams === "string" ? new URLSearchParams(searchOrParams) : searchOrParams;
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const saved =
    savedPrefs && typeof savedPrefs === "object" && savedPrefs.overlayPath && themedMatchBoardPrefsApply(savedPrefs.overlayPath, path)
      ? savedPrefs
      : null;
  const urlA = p?.get?.("aliveIconAlive");
  const urlD = p?.get?.("aliveIconDead");
  let alive = null;
  let dead = null;
  if (urlA != null && urlA !== "") alive = sanitizeAliveIconPath(urlA);
  else if (saved?.aliveCustomAlive) alive = sanitizeAliveIconPath(saved.aliveCustomAlive);
  if (urlD != null && urlD !== "") dead = sanitizeAliveIconPath(urlD);
  else if (saved?.aliveCustomDead) dead = sanitizeAliveIconPath(saved.aliveCustomDead);
  return { alive, dead };
}
