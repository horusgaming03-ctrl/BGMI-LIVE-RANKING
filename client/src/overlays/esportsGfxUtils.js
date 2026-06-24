/** Esports tournament live-ranking GFX tokens (reference board). */

export function isEsportsTournamentGfxTheme(theme) {
  return Boolean(theme?.esportsTournamentGfx);
}

export function esportsRankingTokensFromTheme(theme) {
  const e = theme?.esportsRanking || {};
  const c = theme?.colors || {};
  return {
    panelBg: e.panelBg || "#0c0c10",
    panelGlow: e.panelGlow || "rgba(230,57,70,.45)",
    headerLive: e.headerLive || "#ffffff",
    headerRank: e.headerRank || c.primary || "#ff3344",
    rowBg: e.rowBg || "#141418",
    rowBorder: e.rowBorder || "rgba(230,57,70,.55)",
    rankGold: e.rankGold || "#f0a030",
    rankSilver: e.rankSilver || "#b8bcc6",
    text: e.text || c.text || "#ffffff",
    muted: e.muted || c.textMuted || "#8b9bb4",
    aliveColor: e.aliveColor || theme?.alive?.color || "#5ec8f2",
    knockedColor: e.knockedColor || "#ff3344",
    damagedColor: e.damagedColor || theme?.alive?.deadColor || "#3a3a44",
    ptsColor: e.ptsColor || "#ffffff",
    elimsColor: e.elimsColor || "#ffffff",
    footerTag: e.footerTag || c.primary || "#ff3344",
    fontFamily: e.fontFamily || theme?.typography?.fontFamily || "'Rajdhani', sans-serif",
    titleFont: e.titleFont || "'Bebas Neue', Impact, sans-serif",
  };
}
