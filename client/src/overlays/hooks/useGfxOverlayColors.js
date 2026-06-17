import { useEffect, useMemo, useState } from "react";
import {
  GFX_COLOR_MODE_THEME,
  mergeWwcdStripColors,
  mergeEliminationBannerColors,
  normalizeGfxColorMode,
  inferWwcdStripColorMode,
  inferEliminationBannerColorMode,
  resolveWwcdStripColors,
  resolveEliminationBannerColors,
} from "../../overlayGfxColors";
import { useLiveRankingThemePalette } from "./useLiveRankingThemePalette";
import socket, { API } from "../socket";

const DEFAULT_GFX_SETTINGS = {
  wwcdStripColorMode: GFX_COLOR_MODE_THEME,
  wwcdStripColors: mergeWwcdStripColors({}),
  eliminationBannerColorMode: GFX_COLOR_MODE_THEME,
  eliminationBannerColors: mergeEliminationBannerColors({}),
};

function gfxFromSettings(s) {
  if (!s || typeof s !== "object") return { ...DEFAULT_GFX_SETTINGS };
  return {
    wwcdStripColorMode: inferWwcdStripColorMode(s.wwcdStripColorMode, s.wwcdStripColors),
    wwcdStripColors: mergeWwcdStripColors(s.wwcdStripColors),
    eliminationBannerColorMode: inferEliminationBannerColorMode(
      s.eliminationBannerColorMode,
      s.eliminationBannerColors,
    ),
    eliminationBannerColors: mergeEliminationBannerColors(s.eliminationBannerColors),
  };
}

/**
 * Resolved WWCD strip + elimination colors for OBS overlays.
 * Default: follow active live-ranking theme. Custom mode uses saved picker values.
 */
export function useGfxOverlayColors() {
  const { mergedTheme, themeName } = useLiveRankingThemePalette();
  const [gfxSettings, setGfxSettings] = useState(DEFAULT_GFX_SETTINGS);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const applySettings = (s) => {
      setGfxSettings(gfxFromSettings(s));
      setDraft((prev) => {
        if (!prev?.ts) return null;
        if (Date.now() - prev.ts < 2500) return prev;
        return null;
      });
    };
    const onGfxDraft = (payload) => {
      if (!payload || typeof payload !== "object") return;
      setDraft(payload);
    };
    socket.on("settingsUpdated", applySettings);
    socket.on("overlayGfxDraft", onGfxDraft);
    socket.emit("requestSettings");
    fetch(`${API}/settings`)
      .then((r) => r.json())
      .then(applySettings)
      .catch(() => {});
    return () => {
      socket.off("settingsUpdated", applySettings);
      socket.off("overlayGfxDraft", onGfxDraft);
    };
  }, []);

  const effectiveSettings = useMemo(() => {
    if (!draft) return gfxSettings;
    return {
      wwcdStripColorMode:
        draft.wwcdStripColorMode != null
          ? inferWwcdStripColorMode(draft.wwcdStripColorMode, draft.wwcdStripColors)
          : inferWwcdStripColorMode(null, draft.wwcdStripColors ?? gfxSettings.wwcdStripColors),
      wwcdStripColors:
        draft.wwcdStripColors && typeof draft.wwcdStripColors === "object"
          ? mergeWwcdStripColors(draft.wwcdStripColors)
          : gfxSettings.wwcdStripColors,
      eliminationBannerColorMode:
        draft.eliminationBannerColorMode != null
          ? inferEliminationBannerColorMode(draft.eliminationBannerColorMode, draft.eliminationBannerColors)
          : inferEliminationBannerColorMode(
              null,
              draft.eliminationBannerColors ?? gfxSettings.eliminationBannerColors,
            ),
      eliminationBannerColors:
        draft.eliminationBannerColors && typeof draft.eliminationBannerColors === "object"
          ? mergeEliminationBannerColors(draft.eliminationBannerColors)
          : gfxSettings.eliminationBannerColors,
    };
  }, [draft, gfxSettings]);

  const wwcdStripColors = useMemo(
    () =>
      resolveWwcdStripColors(
        effectiveSettings.wwcdStripColorMode,
        effectiveSettings.wwcdStripColors,
        mergedTheme,
      ),
    [effectiveSettings, mergedTheme],
  );

  const eliminationBannerColors = useMemo(
    () =>
      resolveEliminationBannerColors(
        effectiveSettings.eliminationBannerColorMode,
        effectiveSettings.eliminationBannerColors,
        mergedTheme,
      ),
    [effectiveSettings, mergedTheme],
  );

  return {
    themeName,
    mergedTheme,
    wwcdStripColorMode: effectiveSettings.wwcdStripColorMode,
    eliminationBannerColorMode: effectiveSettings.eliminationBannerColorMode,
    wwcdStripColors,
    eliminationBannerColors,
  };
}
