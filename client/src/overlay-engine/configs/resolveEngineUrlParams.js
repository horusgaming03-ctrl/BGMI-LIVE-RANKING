import { getPresetBundle } from "./presetBundles";
import { getDesignCatalog } from "../designs";
import { defaultEngineConfig } from "./defaultEngineConfig";
import { defaultAliveStyleForPathname } from "../../overlays/utils/overlayDefaultAlive";
import { overlayPathMatches } from "../../overlays/utils/overlayPrefsMatch";
import { sanitizeAliveIconPath, normalizeAliveLayout } from "../../overlays/utils/resolveAliveExtras";

function omitMeta(bundle) {
  if (!bundle) return {};
  const { label, bundleId, ...rest } = bundle;
  void label;
  void bundleId;
  return rest;
}

/**
 * URL + optional ?bundle= + optional JSON merge (from /broadcast-engine/bundles.json).
 * Explicit query keys always win over bundle defaults.
 * @param {string} search window.location.search
 * @param {Record<string, object>} jsonBundles merged bundle json
 * @param {string} [pathname] window.location.pathname — picks default alive style when ?alive= missing
 * @param {object|null} [savedPrefs] settings.engineOverlayPrefs from server — used when URL omits params
 */
export function resolveEngineUrlParams(search, jsonBundles = {}, pathname, savedPrefs = null) {
  const path = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const routeAliveDefault = defaultAliveStyleForPathname(path);
  const p = new URLSearchParams(search);
  const saved =
    savedPrefs && typeof savedPrefs === "object" && overlayPathMatches(savedPrefs.overlayPath, path) ? savedPrefs : null;
  const bundleKey = p.get("bundle");
  const jsonLayer = bundleKey && jsonBundles[bundleKey] && typeof jsonBundles[bundleKey] === "object"
    ? jsonBundles[bundleKey]
    : {};
  const staticBundle = getPresetBundle(bundleKey);
  const bundleLayer = { ...omitMeta(staticBundle), ...jsonLayer };
  const hasBundle = Boolean(bundleKey && (staticBundle || Object.keys(jsonLayer).length > 0));

  const fallbacks = {
    engineTheme: saved?.engineTheme || defaultEngineConfig.engineTheme,
    engineDesign: saved?.engineDesign || getDesignCatalog()[0]?.id || "dsgn_pro_wave0_000",
    aliveStyle: saved?.aliveStyle || routeAliveDefault,
    animationPack: saved?.animationPack || defaultEngineConfig.animationPack,
    engineAnimations:
      typeof saved?.engineAnimations === "boolean" ? saved.engineAnimations : true,
    aliveLayout: normalizeAliveLayout(saved?.aliveLayout),
    aliveIconAlive: sanitizeAliveIconPath(saved?.aliveCustomAlive) || null,
    aliveIconDead: sanitizeAliveIconPath(saved?.aliveCustomDead) || null,
  };

  const merged = hasBundle
    ? {
        engineTheme: bundleLayer.engineTheme || fallbacks.engineTheme,
        engineDesign: bundleLayer.engineDesign || fallbacks.engineDesign,
        aliveStyle: bundleLayer.aliveStyle || fallbacks.aliveStyle,
        animationPack: bundleLayer.animationPack || fallbacks.animationPack,
        engineAnimations:
          typeof bundleLayer.engineAnimations === "boolean"
            ? bundleLayer.engineAnimations
            : fallbacks.engineAnimations,
        aliveLayout:
          bundleLayer.aliveLayout != null && bundleLayer.aliveLayout !== ""
            ? normalizeAliveLayout(bundleLayer.aliveLayout)
            : fallbacks.aliveLayout,
        aliveIconAlive: sanitizeAliveIconPath(bundleLayer.aliveIconAlive) || fallbacks.aliveIconAlive,
        aliveIconDead: sanitizeAliveIconPath(bundleLayer.aliveIconDead) || fallbacks.aliveIconDead,
      }
    : fallbacks;

  const urlLayout = p.get("aliveLayout");
  const resolvedLayout =
    urlLayout === "line" || urlLayout === "grid" ? urlLayout : normalizeAliveLayout(merged.aliveLayout);

  return {
    engineTheme: p.get("engineTheme") || merged.engineTheme,
    engineDesign: p.get("engineDesign") || merged.engineDesign,
    aliveStyle: p.get("alive") || merged.aliveStyle,
    animationPack: p.get("anim") || merged.animationPack,
    engineAnimations: p.has("engineAnim") ? p.get("engineAnim") !== "0" : merged.engineAnimations,
    aliveLayout: resolvedLayout,
    aliveIconAlive: sanitizeAliveIconPath(p.get("aliveIconAlive")) || merged.aliveIconAlive,
    aliveIconDead: sanitizeAliveIconPath(p.get("aliveIconDead")) || merged.aliveIconDead,
    syncAdmin: p.get("syncAdmin") === "1",
    bundleId: bundleKey,
  };
}
