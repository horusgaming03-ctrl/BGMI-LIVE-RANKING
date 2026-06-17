import { clampHexColor } from "./sideOverlayPrefs";
import { broadcastElimStyleFromTheme, broadcastElimStyleFromPatch, broadcastWwcdStripColorsResolved, isLegacyWwcdStripCustom, isBroadcastGfxTheme, BROADCAST_ELIMINATION_COLOR_KEYS, BROADCAST_ELIMINATION_DEFAULTS, BROADCAST_WWCD_STRIP_COLOR_KEYS } from "./overlays/broadcastGfxUtils";

export const GFX_COLOR_MODE_THEME = "theme";
export const GFX_COLOR_MODE_CUSTOM = "custom";

/** `/overlay/wwcd-only` — fallback when theme has no matching tokens */
export const WWCD_STRIP_DEFAULT_COLORS = {
  footerBg: "#00c2c9",
  footerText: "#ffffff",
  barFilled: "#5cff72",
  barDead: "#4a4f54",
  barsBg: "#161616",
  logoBoxBg: "#0a3d45",
  initialsColor: "#ffffff",
};

export const WWCD_STRIP_COLOR_KEYS = Object.freeze([
  "footerBg",
  "footerText",
  "barFilled",
  "barDead",
  "barsBg",
  "logoBoxBg",
  "initialsColor",
]);

/** `/overlay/elimination` — fallback when theme has no matching tokens */
export const ELIMINATION_BANNER_DEFAULT_COLORS = {
  primary: "#ff4655",
  accent: "#00c2c9",
  gold: "#f0c040",
  secondary: "#0f1923",
  textMuted: "#8b9bb4",
};

export const ELIMINATION_BANNER_COLOR_KEYS = Object.freeze([
  "primary",
  "accent",
  "gold",
  "secondary",
  "textMuted",
]);

export function mergeWwcdStripColors(patch) {
  const o = { ...WWCD_STRIP_DEFAULT_COLORS };
  if (!patch || typeof patch !== "object") return clampWwcdStripColors(o);
  for (const k of WWCD_STRIP_COLOR_KEYS) {
    if (patch[k] != null) o[k] = patch[k];
  }
  const out = clampWwcdStripColors(o);
  if (patch.broadcastLayout) out.broadcastLayout = true;
  if (typeof patch.fontFamily === "string" && patch.fontFamily.length <= 120) {
    out.fontFamily = patch.fontFamily.trim();
  }
  for (const k of BROADCAST_WWCD_STRIP_COLOR_KEYS) {
    if (patch[k] != null) {
      out[k] = clampHexColor(patch[k], out.teamTagBg || out.footerBg || "#ffffff");
    }
  }
  if (out.broadcastLayout || BROADCAST_WWCD_STRIP_COLOR_KEYS.some((k) => patch[k] != null)) {
    out.broadcastLayout = true;
  }
  return out;
}

export function mergeEliminationBannerColors(patch) {
  const o = { ...ELIMINATION_BANNER_DEFAULT_COLORS };
  if (!patch || typeof patch !== "object") return clampEliminationBannerColors(o);
  for (const k of ELIMINATION_BANNER_COLOR_KEYS) {
    if (patch[k] != null) o[k] = patch[k];
  }
  const out = clampEliminationBannerColors(o);
  if (patch.broadcastLayout) out.broadcastLayout = true;
  for (const k of BROADCAST_ELIMINATION_COLOR_KEYS) {
    if (patch[k] != null) {
      out[k] = clampHexColor(patch[k], BROADCAST_ELIMINATION_DEFAULTS[k]);
    }
  }
  return out;
}

export function clampWwcdStripColors(obj) {
  const o = { ...obj };
  for (const k of WWCD_STRIP_COLOR_KEYS) {
    o[k] = clampHexColor(o[k], WWCD_STRIP_DEFAULT_COLORS[k]);
  }
  return o;
}

export function clampEliminationBannerColors(obj) {
  const o = { ...obj };
  for (const k of ELIMINATION_BANNER_COLOR_KEYS) {
    o[k] = clampHexColor(o[k], ELIMINATION_BANNER_DEFAULT_COLORS[k]);
  }
  return o;
}

export function stableCanonWwcdStripColors(prefs) {
  return JSON.stringify(mergeWwcdStripColors(prefs));
}

export function stableCanonEliminationBannerColors(prefs) {
  return JSON.stringify(mergeEliminationBannerColors(prefs));
}

/** False when API is an older build that omits gfx color fields on /settings */
export function settingsIncludeGfxColors(data) {
  return (
    data != null &&
    typeof data === "object" &&
    data.wwcdStripColors != null &&
    typeof data.wwcdStripColors === "object" &&
    typeof data.wwcdStripColors.footerBg === "string"
  );
}

export function normalizeGfxColorMode(mode) {
  return mode === GFX_COLOR_MODE_CUSTOM ? GFX_COLOR_MODE_CUSTOM : GFX_COLOR_MODE_THEME;
}

/** Older API builds saved colors but not mode — infer custom when palette ≠ static defaults */
export function inferWwcdStripColorMode(savedMode, savedColors) {
  if (savedMode === GFX_COLOR_MODE_CUSTOM || savedMode === GFX_COLOR_MODE_THEME) {
    return normalizeGfxColorMode(savedMode);
  }
  const merged = mergeWwcdStripColors(savedColors);
  return stableCanonWwcdStripColors(merged) === stableCanonWwcdStripColors(WWCD_STRIP_DEFAULT_COLORS)
    ? GFX_COLOR_MODE_THEME
    : GFX_COLOR_MODE_CUSTOM;
}

export function inferEliminationBannerColorMode(savedMode, savedColors) {
  if (savedMode === GFX_COLOR_MODE_CUSTOM || savedMode === GFX_COLOR_MODE_THEME) {
    return normalizeGfxColorMode(savedMode);
  }
  const merged = mergeEliminationBannerColors(savedColors);
  return stableCanonEliminationBannerColors(merged) ===
    stableCanonEliminationBannerColors(ELIMINATION_BANNER_DEFAULT_COLORS)
    ? GFX_COLOR_MODE_THEME
    : GFX_COLOR_MODE_CUSTOM;
}

/** Derive WWCD 4-squad strip palette from active live-ranking theme */
export function wwcdStripColorsFromTheme(theme) {
  if (isBroadcastGfxTheme(theme)) {
    return broadcastWwcdStripColorsResolved(theme, {});
  }

  const c = theme?.colors || {};
  const alive = theme?.alive || {};
  const row = theme?.row || {};
  const secondary = c.secondary || WWCD_STRIP_DEFAULT_COLORS.logoBoxBg;
  return clampWwcdStripColors({
    footerBg: c.accent || c.primary || WWCD_STRIP_DEFAULT_COLORS.footerBg,
    footerText: c.text || WWCD_STRIP_DEFAULT_COLORS.footerText,
    barFilled: alive.color || WWCD_STRIP_DEFAULT_COLORS.barFilled,
    barDead: alive.deadColor || WWCD_STRIP_DEFAULT_COLORS.barDead,
    barsBg: row.bgB || row.bgA || secondary || WWCD_STRIP_DEFAULT_COLORS.barsBg,
    logoBoxBg: secondary || WWCD_STRIP_DEFAULT_COLORS.logoBoxBg,
    initialsColor: c.gold || c.text || WWCD_STRIP_DEFAULT_COLORS.initialsColor,
  });
}

/** Derive elimination banner palette from active live-ranking theme */
export function eliminationBannerColorsFromTheme(theme) {
  if (isBroadcastGfxTheme(theme)) {
    const b = broadcastElimStyleFromTheme(theme);
    return {
      ...clampEliminationBannerColors({
        primary: b.elimBg,
        accent: b.panelBg,
        gold: b.nameTagBg,
        secondary: b.panelBg,
        textMuted: b.statsText,
      }),
      broadcastLayout: true,
      broadcastStyle: b,
    };
  }

  const c = theme?.colors || {};
  const wwcd = theme?.wwcd || {};
  return clampEliminationBannerColors({
    primary: wwcd.titleColor || c.accent || c.primary || ELIMINATION_BANNER_DEFAULT_COLORS.primary,
    accent: c.accent || c.primary || ELIMINATION_BANNER_DEFAULT_COLORS.accent,
    gold: c.gold || ELIMINATION_BANNER_DEFAULT_COLORS.gold,
    secondary: c.secondary || ELIMINATION_BANNER_DEFAULT_COLORS.secondary,
    textMuted: c.textMuted || ELIMINATION_BANNER_DEFAULT_COLORS.textMuted,
  });
}

export function resolveWwcdStripColors(mode, customColors, theme) {
  if (isBroadcastGfxTheme(theme)) {
    const useCustom =
      normalizeGfxColorMode(mode) === GFX_COLOR_MODE_CUSTOM &&
      customColors?.broadcastLayout === true &&
      !isLegacyWwcdStripCustom(customColors);
    if (useCustom) {
      return broadcastWwcdStripColorsResolved(theme, customColors);
    }
    return broadcastWwcdStripColorsResolved(theme, {});
  }
  if (normalizeGfxColorMode(mode) === GFX_COLOR_MODE_CUSTOM) {
    return mergeWwcdStripColors(customColors);
  }
  return wwcdStripColorsFromTheme(theme);
}

export function resolveEliminationBannerColors(mode, customColors, theme) {
  if (isBroadcastGfxTheme(theme)) {
    const base = broadcastElimStyleFromTheme(theme);
    if (normalizeGfxColorMode(mode) === GFX_COLOR_MODE_CUSTOM) {
      const merged = mergeEliminationBannerColors(customColors);
      const broadcastStyle = broadcastElimStyleFromPatch(base, merged);
      return {
        ...merged,
        broadcastLayout: true,
        broadcastStyle,
      };
    }
    return {
      ...clampEliminationBannerColors({
        primary: base.elimBg,
        accent: base.panelBg,
        gold: base.nameTagBg,
        secondary: base.panelBg,
        textMuted: base.statsText,
      }),
      broadcastLayout: true,
      broadcastStyle: base,
    };
  }

  if (normalizeGfxColorMode(mode) === GFX_COLOR_MODE_CUSTOM) {
    return mergeEliminationBannerColors(customColors);
  }
  return eliminationBannerColorsFromTheme(theme);
}
