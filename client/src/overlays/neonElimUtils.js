/** Neon tournament elimination banner — rank panel left, ELIMINATED + logo/stats right. */

import { isNeonElimBannerLayout } from "./eliminationBannerRegistry";

export function isNeonElimTheme(theme) {
  return isNeonElimBannerLayout(theme);
}

export { isNeonElimBannerLayout } from "./eliminationBannerRegistry";

export function neonElimStyleFromTheme(theme) {
  const el = theme?.elimination || {};
  const c = theme?.colors || {};
  const ty = theme?.typography || {};

  return {
    neonLayout: true,
    rankPanelBg: el.rankPanelBg || "#1a3fd4",
    rankText: el.rankText || "#ffe600",
    titleBg: el.titleBg || "#e8ecf4",
    titleText: el.titleText || "#1e2235",
    statsBg: el.statsBg || "#1e2235",
    statsText: el.statsText || "#ffffff",
    statNumColor: el.statNumColor || el.rankText || "#ffe600",
    statLabelColor: el.statLabelColor || "#ffffff",
    logoFallbackBg: el.logoFallbackBg || "#2a3048",
    logoFallbackText: el.logoFallbackText || "#ffffff",
    borderColor: el.borderColor || c.primary || "#00f0ff",
    fontFamily: el.fontFamily || ty.fontFamily || "'Rajdhani', 'Inter', sans-serif",
    glow: el.glow || "0 0 20px rgba(0,240,255,.35), 0 0 36px rgba(255,0,229,.15)",
  };
}

export const NEON_ELIMINATION_PICKERS = [
  ["rankPanelBg", "Rank panel bg"],
  ["rankText", "Rank # color"],
  ["titleBg", "Eliminated bar bg"],
  ["titleText", "Eliminated text"],
  ["statsBg", "Stats bar bg"],
  ["statNumColor", "Elims number"],
  ["statLabelColor", "Elims label"],
  ["borderColor", "Neon border"],
];
