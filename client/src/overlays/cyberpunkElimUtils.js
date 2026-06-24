/** Cyberpunk stacked elimination banner — logo left, title + stats right. */

import { isStackedElimBannerLayout } from "./eliminationBannerRegistry";

export function isCyberpunkElimTheme(theme) {
  return isStackedElimBannerLayout(theme);
}

export { isStackedElimBannerLayout } from "./eliminationBannerRegistry";

export function cyberpunkElimStyleFromTheme(theme) {
  const el = theme?.elimination || {};
  const c = theme?.colors || {};
  const g = theme?.gradients || {};
  const ty = theme?.typography || {};

  return {
    cyberpunkLayout: true,
    logoPanelBg: el.logoPanelBg || c.secondary || "#1a1a2e",
    logoBorder: el.logoBorder || c.primary || "#fcee09",
    titleBg: el.titleBg || "#ececf2",
    titleText: el.titleText || c.secondary || "#1a1a2e",
    statsBg: el.statsBg || g.header || "linear-gradient(90deg, #e94560 0%, #533483 100%)",
    statsText: el.statsText || "#ffffff",
    rankText: el.rankText || c.primary || "#fcee09",
    teamText: el.teamText || "#ffffff",
    killIconColor: el.killIconColor || "#ffffff",
    fontFamily: el.fontFamily || ty.fontFamily || "'Rajdhani', 'Inter', sans-serif",
    glow: el.glow || "0 0 18px rgba(252,238,9,.35), 0 0 32px rgba(233,69,96,.2)",
  };
}

export const CYBERPUNK_ELIMINATION_PICKERS = [
  ["logoPanelBg", "Logo panel bg"],
  ["logoBorder", "Logo border"],
  ["titleBg", "Title bar bg"],
  ["titleText", "Title text"],
  ["rankText", "Rank # color"],
  ["teamText", "Team name"],
  ["killIconColor", "Kill icon"],
];
