import { useEffect, useMemo, useState } from "react";
import { getTheme, getThemeNames } from "../themes";
import { mergeThemeOverride } from "../utils/mergeThemeOverride";
import { isValidEliminationBannerLayout } from "../eliminationBannerRegistry";
import socket, { API, apiUrl } from "../socket";

/** Fallback when theme not loaded yet — matches premiumGold-style defaults */
export const DEFAULT_ANNOUNCEMENT_PALETTE = {
  gold: "#f1c04e",
  accent: "#ff8c2a",
  text: "#f4f6f8",
  textMuted: "#9a7b2e",
  primary: "#f1c04e",
  secondary: "#121620",
  panelGradient:
    "linear-gradient(180deg, rgba(18, 22, 32, 0.97) 0%, rgba(6, 10, 16, 0.96) 100%)",
  headerGradient: "linear-gradient(90deg, rgba(241, 192, 78, 0.22), rgba(255, 140, 42, 0.08) 55%, transparent)",
  headLineGradient: "linear-gradient(90deg, #f1c04e, #9a7b2e 40%, transparent)",
  borderColor: "rgba(241, 192, 78, 0.55)",
  glowSoft: "rgba(255, 140, 42, 0.12)",
  glowStrong: "rgba(255, 140, 42, 0.22)",
};

function hexToRgba(hex, alpha) {
  const h = String(hex || "").replace("#", "");
  if (h.length < 6) return `rgba(255, 140, 42, ${alpha})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return `rgba(255, 140, 42, ${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Map merged live-ranking theme → announcement banner palette */
export function announcementPaletteFromTheme(theme) {
  if (!theme) return { ...DEFAULT_ANNOUNCEMENT_PALETTE };
  const c = theme.colors || {};
  const g = theme.gradients || {};
  const gold = c.gold || c.primary || DEFAULT_ANNOUNCEMENT_PALETTE.gold;
  const accent = c.accent || c.primary || DEFAULT_ANNOUNCEMENT_PALETTE.accent;
  const text = c.text || DEFAULT_ANNOUNCEMENT_PALETTE.text;
  const textMuted = c.textMuted || gold;
  const secondary = c.secondary || DEFAULT_ANNOUNCEMENT_PALETTE.secondary;

  return {
    gold,
    accent,
    text,
    textMuted,
    primary: c.primary || gold,
    secondary,
    panelGradient:
      g.panel ||
      `linear-gradient(180deg, ${hexToRgba(secondary, 0.97)} 0%, rgba(6, 10, 16, 0.96) 100%)`,
    headerGradient:
      g.header ||
      `linear-gradient(90deg, ${hexToRgba(gold, 0.22)}, ${hexToRgba(accent, 0.08)} 55%, transparent)`,
    headLineGradient: `linear-gradient(90deg, ${gold}, ${textMuted} 40%, transparent)`,
    borderColor: hexToRgba(gold, 0.55),
    glowSoft: hexToRgba(accent, 0.12),
    glowStrong: hexToRgba(accent, 0.22),
  };
}

/**
 * Same active theme + color overrides as /overlay/themed (live ranking).
 * Announcements & admin preview update when Theme Preview colors or Admin active theme change.
 */
function themeFromUrl() {
  if (typeof window === "undefined") return null;
  const t = new URLSearchParams(window.location.search).get("theme");
  if (typeof t === "string" && getThemeNames().includes(t)) return t;
  return null;
}

export function useLiveRankingThemePalette() {
  const [themeName, setThemeName] = useState("esports");
  const [themeColorOverrides, setThemeColorOverrides] = useState({});
  const [eliminationBannerLayouts, setEliminationBannerLayouts] = useState({});
  const urlTheme = useMemo(() => themeFromUrl(), []);

  useEffect(() => {
    let cancelled = false;

    const applySettings = (s) => {
      if (!s || typeof s !== "object") return;
      if (s.themeColorOverrides && typeof s.themeColorOverrides === "object") {
        setThemeColorOverrides(s.themeColorOverrides);
      }
      if (s.eliminationBannerLayouts && typeof s.eliminationBannerLayouts === "object") {
        setEliminationBannerLayouts(s.eliminationBannerLayouts);
      }
      const t = s.activeTheme;
      if (typeof t === "string" && getThemeNames().includes(t)) {
        setThemeName(t);
      }
    };

    fetch(apiUrl("/settings"), { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) applySettings(s);
      })
      .catch(() => {});

    fetch(`${API}/overlay/active-theme`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const t = d?.theme;
        if (typeof t === "string" && getThemeNames().includes(t)) setThemeName(t);
      })
      .catch(() => {});

    const onSettings = (s) => applySettings(s);
    const onActiveTheme = (name) => {
      if (typeof name === "string" && getThemeNames().includes(name)) setThemeName(name);
    };

    socket.on("settingsUpdated", onSettings);
    socket.on("activeThemeChanged", onActiveTheme);
    socket.emit("requestSettings");
    socket.emit("requestActiveTheme");

    return () => {
      cancelled = true;
      socket.off("settingsUpdated", onSettings);
      socket.off("activeThemeChanged", onActiveTheme);
    };
  }, []);

  const effectiveThemeName = urlTheme || themeName;

  const mergedTheme = useMemo(() => {
    let merged = mergeThemeOverride(
      getTheme(effectiveThemeName),
      themeColorOverrides[effectiveThemeName] || {},
    );
    const savedLayout = eliminationBannerLayouts[effectiveThemeName];
    if (savedLayout && isValidEliminationBannerLayout(savedLayout)) {
      merged = {
        ...merged,
        elimination: {
          ...(merged.elimination || {}),
          bannerLayout: savedLayout,
          layout: savedLayout,
        },
      };
    }
    return merged;
  }, [effectiveThemeName, themeColorOverrides, eliminationBannerLayouts]);

  const palette = useMemo(() => announcementPaletteFromTheme(mergedTheme), [mergedTheme]);

  return { palette, themeName: effectiveThemeName, mergedTheme };
}

/** Admin Live announcements preview — same palette as OBS overlay */
export function announcementAdminPreviewStyles(palette) {
  const p = palette || DEFAULT_ANNOUNCEMENT_PALETTE;
  return {
    label: { color: p.gold },
    hint: { color: p.textMuted },
    textarea: { border: `1px solid ${p.borderColor}` },
    uploadBtn: {
      border: `1px solid ${p.borderColor}`,
      background: p.headerGradient,
      color: p.gold,
    },
    broadcastBtn: {
      border: `1px solid ${p.borderColor}`,
      background: `linear-gradient(180deg, ${p.gold}, ${p.accent})`,
      color: "#1a1208",
      boxShadow: `0 8px 28px ${p.glowSoft}`,
    },
    card: {
      border: `1px solid ${p.borderColor}`,
      background: p.panelGradient,
      boxShadow: `0 16px 40px rgba(0,0,0,.5), 0 0 32px ${p.glowSoft}`,
    },
    head: {
      background: p.headerGradient,
      borderBottom: `1px solid ${p.borderColor}`,
    },
    tag: { color: p.gold, fontFamily: "'Bebas Neue', Impact, sans-serif" },
    live: {
      color: p.accent,
      border: `1px solid ${p.borderColor}`,
      fontFamily: "'Bebas Neue', Impact, sans-serif",
    },
    msg: { color: p.text },
    thumb: { border: `1px solid ${p.borderColor}` },
    caption: { color: p.textMuted },
  };
}
