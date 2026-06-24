import { clampHexColor } from "./sideOverlayPrefs";
import { isBroadcastGfxTheme, broadcastElimStyleFromTheme, broadcastElimStyleFromPatch, broadcastWwcdStripColorsResolved, isLegacyWwcdStripCustom, BROADCAST_ELIMINATION_COLOR_KEYS, BROADCAST_ELIMINATION_DEFAULTS, BROADCAST_WWCD_STRIP_COLOR_KEYS } from "./overlays/broadcastGfxUtils";
import {
  resolveEliminationBannerLayout,
  eliminationBannerStyleFromTheme,
  layoutElimPatchFromDraft,
  eliminationPickerKeysForLayout,
} from "./overlays/eliminationBannerRegistry";
import { NEON_ELIMINATION_PICKERS } from "./overlays/neonElimUtils";
import { CYBERPUNK_ELIMINATION_PICKERS } from "./overlays/cyberpunkElimUtils";
import { MINIMAL_ELIMINATION_PICKERS, MINIMAL_WWCD_STRIP_COLOR_KEYS } from "./overlays/minimalGfxUtils";

const LAYOUT_ELIM_COLOR_KEYS = Object.freeze([
  ...new Set([
    ...BROADCAST_ELIMINATION_COLOR_KEYS,
    ...MINIMAL_ELIMINATION_PICKERS.map(([key]) => key),
    ...NEON_ELIMINATION_PICKERS.map(([key]) => key),
    ...CYBERPUNK_ELIMINATION_PICKERS.map(([key]) => key),
  ]),
]);

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
  for (const k of MINIMAL_WWCD_STRIP_COLOR_KEYS) {
    if (patch[k] != null && typeof patch[k] === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(patch[k].trim())) {
      out[k] = clampHexColor(patch[k], out[k] || "#1c1c1c");
    }
  }
  if (patch.minimalBroadcastLayout) out.minimalBroadcastLayout = true;
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
  for (const k of LAYOUT_ELIM_COLOR_KEYS) {
    if (patch[k] != null && typeof patch[k] === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(patch[k].trim())) {
      out[k] = clampHexColor(patch[k], out[k] || "#888888");
    }
  }
  if (patch.neonLayout) out.neonLayout = true;
  if (patch.cyberpunkLayout) out.cyberpunkLayout = true;
  if (patch.minimalBroadcastLayout) out.minimalBroadcastLayout = true;
  if (patch.animation != null) {
    out.animation = typeof patch.animation === "string" ? patch.animation.trim() : patch.animation;
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
  const layout = resolveEliminationBannerLayout(theme);
  const styles = eliminationBannerStyleFromTheme(theme);

  if (layout === "neonPanel") {
    const n = styles.neonStyle;
    return {
      ...clampEliminationBannerColors({
        primary: n.rankPanelBg,
        accent: n.borderColor,
        gold: n.statNumColor,
        secondary: n.statsBg,
        textMuted: n.titleText,
      }),
      neonLayout: true,
      neonStyle: n,
    };
  }

  if (layout === "minimalBroadcast") {
    const b = styles.broadcastStyle;
    return {
      ...clampEliminationBannerColors({
        primary: b.elimBg,
        accent: b.logoRingColor,
        gold: b.leftPanelBg,
        secondary: b.rankBadgeText,
        textMuted: b.elimText,
      }),
      broadcastLayout: true,
      minimalBroadcastLayout: true,
      animation: b.animation,
      broadcastStyle: b,
    };
  }

  if (layout === "stacked") {
    const cp = styles.cyberpunkStyle;
    return {
      ...clampEliminationBannerColors({
        primary: cp.statsBg?.includes?.("gradient") ? theme?.colors?.accent || "#e94560" : cp.statsBg,
        accent: theme?.colors?.accent || "#e94560",
        gold: cp.rankText,
        secondary: cp.logoPanelBg,
        textMuted: cp.titleText,
      }),
      cyberpunkLayout: true,
      cyberpunkStyle: cp,
    };
  }

  if (layout === "broadcast") {
    const b = styles.broadcastStyle;
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

/** True when saved custom palette is a deliberate full layout override (not stale partial saves). */
export function isLayoutAwareElimCustom(customColors, theme) {
  if (!customColors || typeof customColors !== "object") return false;
  const layout = resolveEliminationBannerLayout(theme);
  if (layout === "classic") {
    return isClassicElimCustom(customColors);
  }

  const countFilled = (keys) => keys.filter((k) => customColors[k] != null).length;

  if (layout === "broadcast") {
    return countFilled(BROADCAST_ELIMINATION_COLOR_KEYS) >= 3;
  }
  if (layout === "minimalBroadcast") {
    return countFilled(MINIMAL_ELIMINATION_PICKERS.map(([k]) => k)) >= 3;
  }
  if (layout === "neonPanel") {
    return countFilled(NEON_ELIMINATION_PICKERS.map(([k]) => k)) >= 3;
  }
  if (layout === "stacked") {
    return countFilled(CYBERPUNK_ELIMINATION_PICKERS.map(([k]) => k)) >= 3;
  }
  return false;
}

function isClassicElimCustom(customColors) {
  const merged = mergeEliminationBannerColors(customColors);
  return (
    stableCanonEliminationBannerColors(merged) !==
    stableCanonEliminationBannerColors(ELIMINATION_BANNER_DEFAULT_COLORS)
  );
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
  const layout = resolveEliminationBannerLayout(theme);
  const useCustom =
    normalizeGfxColorMode(mode) === GFX_COLOR_MODE_CUSTOM &&
    customColors &&
    typeof customColors === "object" &&
    (layout === "classic" ? isClassicElimCustom(customColors) : isLayoutAwareElimCustom(customColors, theme));

  if (useCustom) {
    const baseStyles = eliminationBannerStyleFromTheme(theme);

    if (layout === "classic") {
      return { ...mergeEliminationBannerColors(customColors) };
    }

    if (layout === "neonPanel") {
      const layoutPatch = layoutElimPatchFromDraft(customColors, layout);
      const neonStyle = { ...baseStyles.neonStyle, ...layoutPatch };
      return {
        ...clampEliminationBannerColors({
          primary: neonStyle.rankPanelBg,
          accent: neonStyle.borderColor,
          gold: neonStyle.statNumColor,
          secondary: neonStyle.statsBg,
          textMuted: neonStyle.titleText,
        }),
        neonLayout: true,
        neonStyle,
      };
    }

    if (layout === "minimalBroadcast") {
      const layoutPatch = layoutElimPatchFromDraft(customColors, layout);
      const broadcastStyle = broadcastElimStyleFromPatch(baseStyles.broadcastStyle, {
        ...layoutPatch,
        minimalBroadcastLayout: true,
        broadcastLayout: true,
      });
      return {
        broadcastLayout: true,
        minimalBroadcastLayout: true,
        animation: broadcastStyle.animation,
        broadcastStyle,
      };
    }

    if (layout === "stacked") {
      const layoutPatch = layoutElimPatchFromDraft(customColors, layout);
      const cyberpunkStyle = { ...baseStyles.cyberpunkStyle, ...layoutPatch };
      return {
        ...clampEliminationBannerColors({
          primary: cyberpunkStyle.statsBg,
          accent: theme?.colors?.accent || "#e94560",
          gold: cyberpunkStyle.rankText,
          secondary: cyberpunkStyle.logoPanelBg,
          textMuted: cyberpunkStyle.titleText,
        }),
        cyberpunkLayout: true,
        cyberpunkStyle,
      };
    }

    if (layout === "broadcast") {
      const layoutPatch = layoutElimPatchFromDraft(customColors, layout);
      const broadcastStyle = broadcastElimStyleFromPatch(baseStyles.broadcastStyle, {
        ...layoutPatch,
        broadcastLayout: true,
      });
      return {
        broadcastLayout: true,
        broadcastStyle,
      };
    }
  }

  return eliminationBannerColorsFromTheme(theme);
}
