import { isValidAliveId } from "../../overlay-engine/alive-styles/aliveCatalog";
import { getPresetConfig } from "../presets";
import { defaultAliveStyleForPathname } from "./overlayDefaultAlive";
import { themedMatchBoardPrefsApply } from "./overlayPrefsMatch";

/** URL ?alive= wins; then ?preset= aliveStyle; then saved prefs for /overlay/themed; then theme.alive.shape hint; else route default.
 * Saved shape must beat theme.defaults — otherwise Premium Gold etc. force "circle" whenever colors merge into the theme. */
export function resolveAliveStyle(searchOrParams, theme, savedPrefs = null) {
  const p = typeof searchOrParams === "string" ? new URLSearchParams(searchOrParams) : searchOrParams;
  const raw = p && typeof p.get === "function" ? p.get("alive") : null;
  if (raw && isValidAliveId(raw)) return raw;
  const presetName = p && typeof p.get === "function" ? p.get("preset") : null;
  if (presetName) {
    const pc = getPresetConfig(presetName);
    if (pc?.aliveStyle && isValidAliveId(pc.aliveStyle)) return pc.aliveStyle;
  }
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (
    savedPrefs &&
    typeof savedPrefs === "object" &&
    savedPrefs.aliveStyle &&
    isValidAliveId(savedPrefs.aliveStyle) &&
    themedMatchBoardPrefsApply(savedPrefs.overlayPath, path)
  ) {
    return savedPrefs.aliveStyle;
  }
  const shape = theme?.alive?.shape;
  if (shape === "circle") return "circle";
  if (shape === "diamond") return "diamond";
  if (shape === "square") return "square";
  return defaultAliveStyleForPathname(path);
}
