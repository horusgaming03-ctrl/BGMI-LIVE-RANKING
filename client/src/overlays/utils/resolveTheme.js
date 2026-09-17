import { getTheme, getThemeNames } from "../themes";

export function resolveTheme(themeName, customOverlayThemes = {}) {
  if (customOverlayThemes && customOverlayThemes[themeName]) {
    return customOverlayThemes[themeName];
  }
  return getTheme(themeName);
}

export function isKnownTheme(themeName, customOverlayThemes = {}) {
  if (typeof themeName !== "string" || !themeName.trim()) return false;
  return getThemeNames().includes(themeName) || Boolean(customOverlayThemes?.[themeName]);
}

export function listAvailableThemes(customOverlayThemes = {}) {
  const builtIn = getThemeNames();
  const custom = Object.keys(customOverlayThemes || {}).filter((id) => !builtIn.includes(id));
  return [...builtIn, ...custom];
}
