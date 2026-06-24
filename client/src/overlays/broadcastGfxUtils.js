/** Shared BMPS / Clean Broadcast GFX tokens for elimination + WWCD strip. */

import {
  isMinimalBroadcastTheme,
  isMinimalElimBannerLayout,
  minimalElimStyleFromTheme,
  minimalWwcdStripStyleFromTheme,
  minimalElimStyleToGfxDraft,
  minimalWwcdStripToGfxDraft,
  MINIMAL_ELIMINATION_PICKERS,
  minimalWwcdDraftFromTheme,
} from "./minimalGfxUtils";
import { normalizeMinimalElimAnimation } from "./minimalElimAnimations";

export { isMinimalBroadcastTheme, minimalElimStyleToGfxDraft, minimalWwcdStripToGfxDraft };

export function broadcastElimStyleFromTheme(theme) {
  if (isMinimalElimBannerLayout(theme)) {
    return minimalElimStyleFromTheme(theme);
  }

  const bc = theme?.broadcast || {};
  const el = theme?.elimination || {};
  const c = theme?.colors || {};
  const ty = theme?.typography || {};

  return {
    panelBg: el.panelBg || bc.headerBg || c.primary || "#0d4a4f",
    rankText: el.rankText || "#ffffff",
    statsBg: el.statsBg || "#ffffff",
    statsText: el.statsText || c.text || "#0a0a0a",
    elimBg: el.elimBg || bc.knockedColor || "#ff3333",
    elimText: el.elimText || "#ffffff",
    nameTagBg: el.nameTagBg || c.textMuted || "#8b4789",
    nameTagText: el.nameTagText || "#ffffff",
    fontFamily: el.fontFamily || ty.fontFamily || "'Teko', sans-serif",
  };
}

export function broadcastWwcdStripStyleFromTheme(theme) {
  if (isMinimalBroadcastTheme(theme)) {
    return minimalWwcdStripStyleFromTheme(theme);
  }

  const bc = theme?.broadcast || {};
  const ws = theme?.wwcdStrip || {};
  const c = theme?.colors || {};

  return {
    broadcastLayout: true,
    teamTagBg: ws.teamTagBg || "#ffffff",
    teamTagText: ws.teamTagText || c.text || "#0a0a0a",
    logoBoxBg: ws.logoBoxBg || ws.teamTagBg || "#ffffff",
    barsBg: ws.barsBg || ws.teamTagBg || "#ffffff",
    barFilled:
      ws.barFilled != null && String(ws.barFilled).trim()
        ? String(ws.barFilled).trim()
        : BROADCAST_WWCD_STRIP_DEFAULTS.barFilled,
    barDead:
      ws.barDead != null && String(ws.barDead).trim()
        ? String(ws.barDead).trim()
        : BROADCAST_WWCD_STRIP_DEFAULTS.barDead,
    footerBg: ws.footerBg || ws.teamTagBg || "#ffffff",
    footerText: ws.footerText || bc.knockedColor || "#e50000",
    dividerColor: ws.dividerColor || ws.footerText || bc.knockedColor || "#e50000",
    pctTextColor: ws.pctTextColor || ws.teamTagText || c.text || "#0a0a0a",
    initialsColor: ws.initialsColor || ws.teamTagText || c.text || "#0a0a0a",
    fontFamily: ws.fontFamily || "'Roboto Condensed', 'Segoe UI', 'Arial Narrow', sans-serif",
  };
}

export const BROADCAST_WWCD_STRIP_PICKERS = [
  ["footerBg", "WWCD row bg"],
  ["teamTagBg", "Card bg"],
  ["footerText", "WWCD label"],
  ["pctTextColor", "% text"],
  ["teamTagText", "Team name"],
  ["dividerColor", "Divider line"],
  ["barFilled", "Alive player"],
  ["barDead", "Dead player"],
];

export const BROADCAST_WWCD_STRIP_COLOR_KEYS = BROADCAST_WWCD_STRIP_PICKERS.map(([key]) => key);

export const BROADCAST_WWCD_STRIP_DEFAULTS = {
  footerBg: "#ffffff",
  teamTagBg: "#ffffff",
  footerText: "#e50000",
  pctTextColor: "#0a0a0a",
  teamTagText: "#0a0a0a",
  dividerColor: "#e50000",
  barFilled: "#22c55e",
  barDead: "#4a4a4a",
};

/** True when saved WWCD custom palette is the old bar-card layout (pre–Clean Broadcast strip). */
export function isLegacyWwcdStripCustom(patch) {
  return patch && typeof patch === "object" && !patch.broadcastLayout;
}

/** Resolved overlay palette for Clean Broadcast WWCD strip cards. */
export function broadcastWwcdStripColorsResolved(theme, patch = {}) {
  const base = broadcastWwcdStripStyleFromTheme(theme);
  const p = patch && typeof patch === "object" ? patch : {};
  const minimal = isMinimalBroadcastTheme(theme) || p.minimalBroadcastLayout;
  if (minimal) {
    return {
      broadcastLayout: true,
      minimalBroadcastLayout: true,
      teamTagBg: p.teamTagBg ?? base.teamTagBg,
      teamTagText: p.teamTagText ?? base.teamTagText,
      panelBg: p.panelBg ?? base.panelBg,
      accentLine: p.accentLine ?? base.accentLine,
      dividerColor: p.dividerColor ?? base.dividerColor,
      pctTextColor: p.pctTextColor ?? base.pctTextColor,
      footerBg: p.footerBg ?? base.footerBg,
      footerText: p.footerText ?? base.footerText,
      barFilled: p.barFilled ?? base.barFilled,
      barDead: p.barDead ?? base.barDead,
      fontFamily: p.fontFamily ?? base.fontFamily,
      cardWidth: base.cardWidth,
    };
  }
  return {
    broadcastLayout: true,
    teamTagBg: p.teamTagBg ?? base.teamTagBg,
    teamTagText: p.teamTagText ?? base.teamTagText,
    dividerColor: p.dividerColor ?? base.dividerColor,
    pctTextColor: p.pctTextColor ?? base.pctTextColor,
    footerBg: p.footerBg ?? base.footerBg,
    footerText: p.footerText ?? base.footerText,
    barFilled: p.barFilled ?? base.barFilled,
    barDead: p.barDead ?? base.barDead,
    barsBg: p.barsBg ?? p.teamTagBg ?? base.barsBg,
    logoBoxBg: p.logoBoxBg ?? p.teamTagBg ?? base.logoBoxBg,
    initialsColor: p.initialsColor ?? p.teamTagText ?? base.initialsColor,
    fontFamily: p.fontFamily ?? base.fontFamily,
  };
}

/** Draft object for admin pickers from merged theme. */
export function broadcastWwcdDraftFromTheme(theme) {
  if (isMinimalBroadcastTheme(theme)) {
    return minimalWwcdDraftFromTheme(theme);
  }
  const resolved = broadcastWwcdStripColorsResolved(theme, {});
  const out = {};
  for (const k of BROADCAST_WWCD_STRIP_COLOR_KEYS) {
    out[k] = resolved[k] ?? BROADCAST_WWCD_STRIP_DEFAULTS[k];
  }
  return out;
}

/** Gfx draft payload for instant WWCD strip preview (OBS socket). */
export function broadcastWwcdStripToGfxDraft(draft, theme = null) {
  const patch = draft && typeof draft === "object" ? draft : {};
  const resolvedTheme =
    theme && typeof theme === "object"
      ? theme
      : patch.minimalBroadcastLayout || patch.panelBg != null || patch.accentLine != null
        ? { broadcastLayout: true, broadcastVariant: "minimal" }
        : { broadcastLayout: true };
  return broadcastWwcdStripColorsResolved(resolvedTheme, patch);
}

export function isBroadcastGfxTheme(theme) {
  return Boolean(theme?.broadcastLayout);
}

export const BROADCAST_ELIMINATION_PICKERS = [
  ["panelBg", "Rank / logo panel"],
  ["rankText", "Rank # text"],
  ["statsBg", "Finish bar bg"],
  ["statsText", "Finish text"],
  ["elimBg", "Eliminated bar"],
  ["elimText", "Eliminated text"],
  ["nameTagBg", "Team name tag"],
  ["nameTagText", "Name tag text"],
];

export const BROADCAST_ELIMINATION_COLOR_KEYS = BROADCAST_ELIMINATION_PICKERS.map(([key]) => key);

export const BROADCAST_ELIMINATION_DEFAULTS = {
  panelBg: "#0d4a4f",
  rankText: "#ffffff",
  statsBg: "#ffffff",
  statsText: "#0a0a0a",
  elimBg: "#ff3333",
  elimText: "#ffffff",
  nameTagBg: "#8b4789",
  nameTagText: "#ffffff",
};

/** Convert live broadcast elimination style → gfx draft payload (instant OBS preview). */
export function broadcastElimStyleToGfxDraft(style) {
  if (style?.minimalBroadcastLayout) {
    return minimalElimStyleToGfxDraft(style);
  }
  const s = style || {};
  return {
    broadcastLayout: true,
    panelBg: s.panelBg,
    rankText: s.rankText,
    statsBg: s.statsBg,
    statsText: s.statsText,
    elimBg: s.elimBg,
    elimText: s.elimText,
    nameTagBg: s.nameTagBg,
    nameTagText: s.nameTagText,
    primary: s.elimBg,
    accent: s.panelBg,
    gold: s.nameTagBg,
    secondary: s.panelBg,
    textMuted: s.statsText,
  };
}
/** Merge saved broadcast elimination patch onto a base style object. */
export function broadcastElimStyleFromPatch(baseStyle, patch = {}) {
  const out = { ...(baseStyle || broadcastElimStyleFromTheme({})) };
  const minimal = Boolean(patch.minimalBroadcastLayout || out.minimalBroadcastLayout);
  if (patch.minimalBroadcastLayout) out.minimalBroadcastLayout = true;
  const pickerList = minimal ? MINIMAL_ELIMINATION_PICKERS : BROADCAST_ELIMINATION_PICKERS;

  for (const [key] of pickerList) {
    if (patch[key] != null && typeof patch[key] === "string") out[key] = patch[key];
  }
  if (patch.animation != null) out.animation = normalizeMinimalElimAnimation(patch.animation);

  const hasLayoutPicker = pickerList.some(([k]) => patch[k] != null);
  if (hasLayoutPicker || patch.broadcastLayout || patch.minimalBroadcastLayout) {
    return out;
  }

  if (minimal) {
    if (patch.primary != null && patch.elimBg == null) out.elimBg = patch.primary;
    if (patch.gold != null && patch.leftPanelBg == null) out.leftPanelBg = patch.gold;
    if (patch.accent != null && patch.logoRingColor == null) out.logoRingColor = patch.accent;
    if (patch.secondary != null && patch.rankBadgeText == null) out.rankBadgeText = patch.secondary;
    if (patch.textMuted != null && patch.elimText == null) out.elimText = patch.textMuted;
  } else {
    if (patch.primary != null && patch.elimBg == null) out.elimBg = patch.primary;
    if (patch.accent != null && patch.panelBg == null) out.panelBg = patch.accent;
    if (patch.gold != null && patch.nameTagBg == null) out.nameTagBg = patch.gold;
    if (patch.secondary != null && patch.panelBg == null) out.panelBg = patch.secondary;
    if (patch.textMuted != null && patch.statsText == null) out.statsText = patch.textMuted;
    if (patch.logoPanelBg != null) out.logoPanelBg = patch.logoPanelBg;
  }
  return out;
}
