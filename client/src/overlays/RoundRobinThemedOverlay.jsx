import { useEffect, useMemo, useState, useCallback } from "react";
import { ThemeProvider, useTheme } from "./ThemeContext";
import useAnimation from "./animations/useAnimation";
import keyframes from "./animations/keyframes";
import ThemedBoard from "./components/ThemedBoard";
import EsportsRankingBoard from "./components/EsportsRankingBoard";
import { isEsportsTournamentGfxTheme } from "./esportsGfxUtils";
import BroadcastRankingBoard, { themeToBroadcastCssVars } from "./components/BroadcastRankingBoard";
import MinimalBroadcastRankingBoard, {
  minimalThemeToCssVars,
} from "./components/MinimalBroadcastRankingBoard";
import ThemeSwitcher from "./components/ThemeSwitcher";
import BackgroundEffects from "./effects/BackgroundEffects";
import { getPresetConfig } from "./presets";
import socket, { API } from "./socket";
import { engineKeyframeCss } from "../overlay-engine/animations/keyframes";
import { resolveAliveStyle } from "./utils/resolveAliveStyle";
import { resolveAliveLayout, resolveAliveCustomIcons } from "./utils/resolveAliveExtras";
import { mergeThemeOverride } from "./utils/mergeThemeOverride";
import { overlayPathMatches } from "./utils/overlayPrefsMatch";
import { buildOverlayStreamRankingOrder } from "../teamDisplayOrder";
import { normalizeMatchMeta } from "../normalizeMatchMeta";
import { useRoundRobinOverlay } from "./hooks/useRoundRobinOverlay";

function RoundRobinOverlayInner() {
  const { theme: baseTheme, themeName, config } = useTheme();
  const anim = useAnimation(config);
  const [urlTick, setUrlTick] = useState(0);
  const [engineSavedPrefs, setEngineSavedPrefs] = useState(null);
  const [themedSavedPrefs, setThemedSavedPrefs] = useState(null);
  const [themeColorOverrides, setThemeColorOverrides] = useState({});

  useEffect(() => {
    const onSettings = (s) => {
      if (!s || typeof s !== "object") return;
      setEngineSavedPrefs(s?.engineOverlayPrefs && typeof s.engineOverlayPrefs === "object" ? s.engineOverlayPrefs : null);
      setThemedSavedPrefs(s?.themedOverlayPrefs && typeof s.themedOverlayPrefs === "object" ? s.themedOverlayPrefs : null);
      setThemeColorOverrides(s?.themeColorOverrides && typeof s.themeColorOverrides === "object" ? s.themeColorOverrides : {});
    };
    socket.on("settingsUpdated", onSettings);
    socket.emit("requestSettings");
    fetch(`${API}/settings`)
      .then((r) => r.json())
      .then(onSettings)
      .catch(() => {});
    return () => socket.off("settingsUpdated", onSettings);
  }, []);

  const theme = useMemo(
    () => mergeThemeOverride(baseTheme, themeColorOverrides[themeName] || {}),
    [baseTheme, themeName, themeColorOverrides],
  );

  useEffect(() => {
    const onPop = () => setUrlTick((n) => n + 1);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const matchBoardSavedPrefs = useMemo(() => {
    if (themedSavedPrefs && typeof themedSavedPrefs === "object") {
      return { overlayPath: "/overlay/themed", ...themedSavedPrefs };
    }
    if (
      engineSavedPrefs &&
      typeof engineSavedPrefs === "object" &&
      engineSavedPrefs.overlayPath &&
      overlayPathMatches(engineSavedPrefs.overlayPath, "/overlay/themed")
    ) {
      return engineSavedPrefs;
    }
    return null;
  }, [themedSavedPrefs, engineSavedPrefs]);

  const aliveDisplay = useMemo(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const icons = resolveAliveCustomIcons(search, matchBoardSavedPrefs);
    return {
      style: resolveAliveStyle(search, theme, matchBoardSavedPrefs),
      layout: resolveAliveLayout(search, matchBoardSavedPrefs),
      customAlive: icons.alive,
      customDead: icons.dead,
    };
  }, [theme, urlTick, matchBoardSavedPrefs]);

  const { teams, matchMeta } = useRoundRobinOverlay();

  const sortLiveOrder = useCallback((list) => buildOverlayStreamRankingOrder(list, {}), []);

  const rondoRecallColumn = normalizeMatchMeta(matchMeta)?.map === "rondo";

  const boardTeams = useMemo(() => {
    const matchIsLive = String(matchMeta.status || "").toLowerCase() === "live";
    return sortLiveOrder(
      teams.map((t) => ({
        ...t,
        finishes: matchIsLive ? Math.max(0, Number(t.finishes) || 0) : Math.max(0, Number(t.finishes) || 0),
      })),
    );
  }, [teams, sortLiveOrder, matchMeta.status]);

  const broadcastCssVars = useMemo(() => themeToBroadcastCssVars(theme), [theme]);
  const minimalCssVars = useMemo(() => minimalThemeToCssVars(theme), [theme]);
  const useBroadcastLayout = Boolean(theme.broadcastLayout);
  const isMinimalBroadcast = theme.broadcastVariant === "minimal";
  const useEsportsTournamentGfx = isEsportsTournamentGfxTheme(theme);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: useEsportsTournamentGfx ? "flex-end" : "center",
        alignItems: useEsportsTournamentGfx ? "flex-start" : "center",
        padding: useEsportsTournamentGfx ? "20px 24px 20px 0" : 0,
        background: "transparent",
        fontFamily: theme.typography.fontFamily,
        position: "relative",
        overflow: useEsportsTournamentGfx ? "visible" : "hidden",
      }}
    >
      {!useBroadcastLayout && !useEsportsTournamentGfx ? (
        <BackgroundEffects theme={theme} enabled={config.enableBackgroundEffects} />
      ) : null}

      {useBroadcastLayout && isMinimalBroadcast ? (
        <MinimalBroadcastRankingBoard
          teams={boardTeams}
          cssVars={minimalCssVars}
          align="right"
          showRecall={rondoRecallColumn}
        />
      ) : useBroadcastLayout ? (
        <BroadcastRankingBoard
          teams={boardTeams}
          finishPointsRankingOnly={false}
          cssVars={broadcastCssVars}
          align="center"
          showRecall={rondoRecallColumn}
          hotRank={theme.broadcast?.hotRank}
        />
      ) : useEsportsTournamentGfx ? (
        <EsportsRankingBoard teams={boardTeams} theme={theme} finishPointsRankingOnly={false} />
      ) : (
        <ThemedBoard
          teams={boardTeams}
          theme={theme}
          anim={anim}
          config={config}
          finishPointsRankingOnly={false}
          rondoRecallColumn={rondoRecallColumn}
          aliveStyle={aliveDisplay.style}
          aliveLayout={aliveDisplay.layout}
          aliveCustomAlive={aliveDisplay.customAlive}
          aliveCustomDead={aliveDisplay.customDead}
        />
      )}
      {!useBroadcastLayout && !useEsportsTournamentGfx ? <ThemeSwitcher /> : null}

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: ${useEsportsTournamentGfx ? "visible" : "hidden"}; background: transparent; }
        ${keyframes}
        ${engineKeyframeCss}
        ${useEsportsTournamentGfx ? `@import url("https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@500;600;700;800&display=swap");` : ""}
      `}</style>
    </div>
  );
}

export default function RoundRobinThemedOverlay() {
  const params = new URLSearchParams(window.location.search);
  const themeName = params.get("theme") || undefined;
  const presetName = params.get("preset");
  const preset = presetName ? getPresetConfig(presetName) : null;

  return (
    <ThemeProvider
      initialTheme={preset?.theme || themeName}
      initialConfig={preset || undefined}
      listenForLive={true}
    >
      <RoundRobinOverlayInner />
    </ThemeProvider>
  );
}
