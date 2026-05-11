/**
 * Broadcast Overlay Engine — add-on layer only. Does not replace /overlay/themed.
 */
export { default as BroadcastEngineOverlay } from "./BroadcastEngineOverlay";
export { default as EngineCatalog } from "./EngineCatalog";
export { legacyThemeToEngineTheme, LEGACY_THEME_NAMES, LEGACY_TO_ENGINE } from "./configs/adminThemeBridge";
export { default as EngineOverlayProvider, useEngineOverlay } from "./EngineThemeContext";
export { getEngineTheme, getEngineThemeIds, getEngineThemeMap, ENGINE_THEME_COUNT } from "./themes";
export { getDesign, getDesignIds, getDesignCatalog, getEngineDesignCount } from "./designs";
export { ALIVE_STYLE_IDS, default as AliveIndicator } from "./alive-styles/AliveIndicator";
export { ANIMATION_PACKS, ANIMATION_PACK_IDS, getAnimationPack } from "./animations/packs";
export { default as useEngineAnimation } from "./animations/useEngineAnimation";
export { engineKeyframeCss } from "./animations/keyframes";
export { applyDesignToTheme } from "./utils/applyDesign";
export { defaultEngineConfig } from "./configs/defaultEngineConfig";
export { getWwcdEnginePreset, WWCD_ENGINE_PRESETS } from "./wwcd-presets";

import { ENGINE_THEME_COUNT } from "./themes";
import { getEngineDesignCount } from "./designs";

export const ENGINE_STATS = {
  themeCount: ENGINE_THEME_COUNT,
  designCount: getEngineDesignCount(),
};
