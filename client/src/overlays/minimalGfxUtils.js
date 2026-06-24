/** Minimal broadcast GFX — elimination banner + WWCD strip tokens. */

import { normalizeMinimalElimAnimation } from "./minimalElimAnimations";
import {
  isMinimalElimBannerLayout as isMinimalElimBannerLayoutResolved,
} from "./eliminationBannerRegistry";

function normalizeHexColor(c) {
  if (typeof c !== "string") return null;
  const t = c.trim();
  return /^#[0-9A-Fa-f]{3,8}$/.test(t) ? t.toLowerCase() : null;
}

/** Team row bg — prefer strip teamTagBg when panelBg was copied from board header. */
function resolveMinimalWwcdTeamRowBg(ws, bc) {
  const panelTop = bc.panelBgTop || "#1c1c1c";
  const panelBottom = bc.panelBgBottom || "#0a0a0a";
  const teamTag = normalizeHexColor(ws.teamTagBg);
  const panelRaw = ws.panelBg != null ? String(ws.panelBg).trim() : "";
  const panelHex = normalizeHexColor(panelRaw);
  const headerHex = normalizeHexColor(bc.headerBg);

  if (panelHex && teamTag && headerHex && panelHex === headerHex && panelHex !== teamTag) {
    return teamTag;
  }
  if (panelRaw) return panelRaw;
  if (teamTag) return teamTag;
  if (bc.panelBgTop || bc.panelBgBottom) {
    return `linear-gradient(180deg, ${panelTop} 0%, ${panelBottom} 100%)`;
  }
  return bc.panelBg || `linear-gradient(180deg, ${panelTop} 0%, ${panelBottom} 100%)`;
}

/** WWCD strip alive bars — only from theme.wwcdStrip, never live-ranking alive/status colors. */
function resolveWwcdStripBarFilled(ws, defaults) {
  if (ws.barFilled != null && String(ws.barFilled).trim()) return String(ws.barFilled).trim();
  return defaults.barFilled;
}

function resolveWwcdStripBarDead(ws, defaults) {
  if (ws.barDead != null && String(ws.barDead).trim()) return String(ws.barDead).trim();
  return defaults.barDead;
}

export function isMinimalBroadcastTheme(theme) {
  return theme?.broadcastVariant === "minimal";
}

export function isMinimalElimBannerLayout(theme) {
  return isMinimalElimBannerLayoutResolved(theme);
}

/** Minimal tournament card layout selected for this theme. */
export function usesMinimalElimBanner(theme) {
  return isMinimalElimBannerLayoutResolved(theme);
}

export function minimalElimStyleFromTheme(theme) {
  const bc = theme?.broadcast || {};
  const el = theme?.elimination || {};
  const ty = theme?.typography || {};

  return {
    minimalBroadcastLayout: true,
    leftPanelBg:
      el.leftPanelBg ||
      `linear-gradient(145deg, ${bc.knockedColor || "#e8c090"} 0%, ${bc.matchPointBg || "#d4a060"} 100%)`,
    rankBadgeText: el.rankBadgeText || "#2a2018",
    logoRingColor: el.logoRingColor || el.accentLine || bc.statusAlive || "#00c8c8",
    rankText: el.rankText || bc.rankNumColor || "#1a1a1a",
    elimBg: el.elimBg || bc.headerBg || "#085858",
    elimText: el.elimText || bc.headerText || "#ffffff",
    dividerColor: el.dividerColor || "rgba(255,255,255,.35)",
    accentLine: el.accentLine || bc.statusAlive || "#00c8c8",
    fontFamily: el.fontFamily || ty.fontFamily || "'Roboto Condensed', 'Arial Narrow', sans-serif",
    panelShadow: bc.panelShadow || "0 10px 40px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.05)",
    animation: normalizeMinimalElimAnimation(el.animation),
  };
}

export function minimalWwcdStripStyleFromTheme(theme) {
  const bc = theme?.broadcast || {};
  const ws = theme?.wwcdStrip || {};
  const alive = theme?.alive || {};
  const panelTop = bc.panelBgTop || "#1c1c1c";

  return {
    broadcastLayout: true,
    minimalBroadcastLayout: true,
    teamTagBg: ws.teamTagBg || panelTop,
    teamTagText: ws.teamTagText || bc.textColor || "#ffffff",
    panelBg: resolveMinimalWwcdTeamRowBg(ws, bc),
    accentLine: ws.accentLine || bc.statusAlive || alive.color || "#00c8c8",
    dividerColor: ws.dividerColor || bc.statusAlive || alive.color || "#00c8c8",
    footerBg: ws.footerBg || bc.legendBg || "#111111",
    footerText: ws.footerText || bc.knockedColor || "#ffcc00",
    pctTextColor: ws.pctTextColor || bc.textColor || "#ffffff",
    barFilled: resolveWwcdStripBarFilled(ws, MINIMAL_WWCD_STRIP_DEFAULTS),
    barDead: resolveWwcdStripBarDead(ws, MINIMAL_WWCD_STRIP_DEFAULTS),
    fontFamily: ws.fontFamily || theme?.typography?.fontFamily || "'Roboto Condensed', 'Arial Narrow', sans-serif",
    cardWidth: ws.cardWidth || 220,
  };
}

export const MINIMAL_ELIMINATION_PICKERS = [
  ["leftPanelBg", "Left panel bg"],
  ["rankBadgeText", "Rank # text"],
  ["logoRingColor", "Logo ring"],
  ["elimBg", "Right panel bg"],
  ["elimText", "Right panel text"],
  ["dividerColor", "Divider line"],
];

export const MINIMAL_WWCD_STRIP_PICKERS = [
  ["panelBg", "Team row bg"],
  ["accentLine", "Top accent"],
  ["teamTagText", "Team name"],
  ["barFilled", "Alive bar"],
  ["barDead", "Dead bar"],
  ["dividerColor", "Divider"],
  ["footerBg", "WWCD row bg"],
  ["footerText", "WWCD label"],
  ["pctTextColor", "% text"],
];

export const MINIMAL_WWCD_STRIP_COLOR_KEYS = MINIMAL_WWCD_STRIP_PICKERS.map(([key]) => key);

export const MINIMAL_WWCD_STRIP_DEFAULTS = {
  panelBg: "#1c1c1c",
  accentLine: "#00c8c8",
  teamTagText: "#ffffff",
  barFilled: "#00c8c8",
  barDead: "#e63946",
  dividerColor: "#00c8c8",
  footerBg: "#111111",
  footerText: "#ffcc00",
  pctTextColor: "#ffffff",
};

/** Solid hex for a minimal WWCD strip color picker. */
export function minimalWwcdPickerColor(theme, key, patch = null) {
  const ws = {
    ...(theme?.wwcdStrip || {}),
    ...(patch && typeof patch === "object" ? patch : {}),
  };
  const mergedTheme = { ...theme, wwcdStrip: ws };
  if (key === "barFilled" || key === "barDead") {
    if (ws[key] != null && typeof ws[key] === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(ws[key].trim())) {
      return ws[key].trim();
    }
    return MINIMAL_WWCD_STRIP_DEFAULTS[key];
  }
  const style = minimalWwcdStripStyleFromTheme(mergedTheme);
  const raw = ws[key] ?? style[key];
  if (typeof raw === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(raw.trim())) {
    return raw.trim();
  }
  if (key === "panelBg") {
    const teamTag = normalizeHexColor(ws.teamTagBg);
    const panelHex = normalizeHexColor(ws.panelBg);
    const headerHex = normalizeHexColor(theme?.broadcast?.headerBg);
    if (panelHex && teamTag && headerHex && panelHex === headerHex && panelHex !== teamTag) {
      return teamTag;
    }
    const resolved = resolveMinimalWwcdTeamRowBg(ws, theme?.broadcast || {});
    if (typeof resolved === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(resolved.trim())) {
      return resolved.trim();
    }
    const top = ws.teamTagBg || theme?.broadcast?.panelBgTop || MINIMAL_WWCD_STRIP_DEFAULTS.panelBg;
    if (typeof top === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(top.trim())) return top.trim();
  }
  return MINIMAL_WWCD_STRIP_DEFAULTS[key] || "#888888";
}

export function minimalWwcdDraftFromTheme(theme) {
  const resolved = minimalWwcdStripStyleFromTheme(theme);
  const out = {};
  for (const key of MINIMAL_WWCD_STRIP_COLOR_KEYS) {
    const val = resolved[key];
    out[key] =
      typeof val === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(val.trim())
        ? val.trim()
        : key === "panelBg"
          ? minimalWwcdPickerColor(theme, "panelBg")
          : MINIMAL_WWCD_STRIP_DEFAULTS[key];
  }
  return out;
}

export function minimalElimStyleToGfxDraft(style) {
  const s = style || {};
  return {
    broadcastLayout: true,
    minimalBroadcastLayout: true,
    leftPanelBg: s.leftPanelBg,
    rankBadgeText: s.rankBadgeText,
    logoRingColor: s.logoRingColor,
    elimBg: s.elimBg,
    elimText: s.elimText,
    dividerColor: s.dividerColor,
    accentLine: s.logoRingColor || s.accentLine,
    primary: s.elimBg,
    accent: s.logoRingColor,
    gold: s.leftPanelBg,
    secondary: s.rankBadgeText,
    textMuted: s.elimText,
    animation: s.animation,
  };
}

export function minimalWwcdStripToGfxDraft(draft) {
  const d = draft || {};
  return {
    broadcastLayout: true,
    minimalBroadcastLayout: true,
    teamTagBg: d.teamTagBg,
    teamTagText: d.teamTagText,
    panelBg: d.panelBg,
    accentLine: d.accentLine,
    dividerColor: d.dividerColor,
    footerBg: d.footerBg,
    footerText: d.footerText,
    pctTextColor: d.pctTextColor,
    barFilled: d.barFilled,
    barDead: d.barDead,
  };
}
