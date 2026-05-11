import { useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider, useTheme } from "./ThemeContext";
import useAnimation from "./animations/useAnimation";
import keyframes from "./animations/keyframes";
import ThemedBoard from "./components/ThemedBoard";
import ThemedWWCD from "./components/ThemedWWCD";
import ThemeSwitcher from "./components/ThemeSwitcher";
import BackgroundEffects from "./effects/BackgroundEffects";
import { getPresetConfig } from "./presets";
import socket from "./socket";
import { engineKeyframeCss } from "../overlay-engine/animations/keyframes";
import { resolveAliveStyle } from "./utils/resolveAliveStyle";
import { resolveAliveLayout, resolveAliveCustomIcons } from "./utils/resolveAliveExtras";
import { mergeThemeOverride } from "./utils/mergeThemeOverride";
import { overlayPathMatches } from "./utils/overlayPrefsMatch";

function OverlayInner() {
  const { theme: baseTheme, themeName, config } = useTheme();
  const anim = useAnimation(config);
  const [urlTick, setUrlTick] = useState(0);
  const [engineSavedPrefs, setEngineSavedPrefs] = useState(null);
  const [themedSavedPrefs, setThemedSavedPrefs] = useState(null);
  const [themeColorOverrides, setThemeColorOverrides] = useState({});

  useEffect(() => {
    const onSettings = (s) => {
      setEngineSavedPrefs(s?.engineOverlayPrefs && typeof s.engineOverlayPrefs === "object" ? s.engineOverlayPrefs : null);
      setThemedSavedPrefs(s?.themedOverlayPrefs && typeof s.themedOverlayPrefs === "object" ? s.themedOverlayPrefs : null);
      setThemeColorOverrides(s?.themeColorOverrides && typeof s.themeColorOverrides === "object" ? s.themeColorOverrides : {});
    };
    socket.on("settingsUpdated", onSettings);
    socket.emit("requestSettings");
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

  const [teams, setTeams] = useState([]);
  const [showWWCD, setShowWWCD] = useState(false);
  const [winner, setWinner] = useState(null);
  const [wwcdColors, setWwcdColors] = useState(null);
  const teamsRef = useRef([]);

  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  useEffect(() => {
    const onColors = (c) => setWwcdColors(c);
    socket.on("wwcdColorsChanged", onColors);
    socket.emit("requestWwcdColors");
    return () => socket.off("wwcdColorsChanged", onColors);
  }, []);

  useEffect(() => {
    const onTeams = (data) => setTeams(Array.isArray(data) ? data : []);

    const onChicken = (data) => {
      setWinner(data);
      setShowWWCD(true);
      setTimeout(() => setShowWWCD(false), config.wwcd?.duration || 8000);
    };

    const onCommand = (cmd) => {
      if (cmd.type === "showChickenDinner") {
        let team = teamsRef.current.find((t) => t.eliminationRank === 1);
        if (!team) {
          const sorted = [...teamsRef.current].sort((a, b) => (b.points || 0) - (a.points || 0));
          team = sorted[0];
        }
        const winnerData = team
          ? { team: team.team, logo: team.logo }
          : { team: cmd.team || "CHAMPION", logo: null };
        setWinner(winnerData);
        setShowWWCD(true);
        setTimeout(() => setShowWWCD(false), config.wwcd?.duration || 8000);
      }
    };

    socket.on("teamsUpdated", onTeams);
    socket.on("chickenDinner", onChicken);
    socket.on("overlayCommand", onCommand);
    socket.emit("requestTeams");

    return () => {
      socket.off("teamsUpdated", onTeams);
      socket.off("chickenDinner", onChicken);
      socket.off("overlayCommand", onCommand);
    };
  }, [config.wwcd?.duration]);

  const wwcdTheme = useMemo(() => {
    if (!wwcdColors || (!wwcdColors.primary && !wwcdColors.gold && !wwcdColors.accent)) return theme;
    return {
      ...theme,
      colors: {
        ...theme.colors,
        ...(wwcdColors.primary && { primary: wwcdColors.primary }),
        ...(wwcdColors.gold && { gold: wwcdColors.gold }),
        ...(wwcdColors.accent && { accent: wwcdColors.accent }),
      },
    };
  }, [theme, wwcdColors]);

  const sorted = useMemo(
    () => [...teams].sort((a, b) => b.points - a.points || b.finishes - a.finishes),
    [teams]
  );

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "transparent",
        fontFamily: theme.typography.fontFamily,
        position: "relative",
      }}
    >
      <BackgroundEffects theme={theme} enabled={config.enableBackgroundEffects} />

      {showWWCD && winner && (
        <ThemedWWCD
          winner={winner}
          theme={wwcdTheme}
          anim={anim.wwcd}
          overlayAnim={anim.wwcdOverlay}
          config={config}
        />
      )}

      <ThemedBoard
        teams={sorted}
        theme={theme}
        anim={anim}
        config={config}
        aliveStyle={aliveDisplay.style}
        aliveLayout={aliveDisplay.layout}
        aliveCustomAlive={aliveDisplay.customAlive}
        aliveCustomDead={aliveDisplay.customDead}
      />
      <ThemeSwitcher />

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden; background: transparent; }
        ${keyframes}
        ${engineKeyframeCss}
      `}</style>
    </div>
  );
}

export default function ThemedOverlay() {
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
      <OverlayInner />
    </ThemeProvider>
  );
}
