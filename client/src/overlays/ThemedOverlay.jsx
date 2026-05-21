import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ThemeProvider, useTheme } from "./ThemeContext";
import useAnimation from "./animations/useAnimation";
import keyframes from "./animations/keyframes";
import ThemedBoard from "./components/ThemedBoard";
import ThemedWWCD from "./components/ThemedWWCD";
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

function OverlayInner({ cumulativeOverall = false }) {
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

  const [teams, setTeams] = useState([]);
  const [tournamentStats, setTournamentStats] = useState([]);
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
    const onTour = (data) => setTournamentStats(Array.isArray(data) ? data : []);
    socket.on("tournamentUpdated", onTour);
    socket.emit("requestTournament");
    return () => socket.off("tournamentUpdated", onTour);
  }, []);

  useEffect(() => {
    const onTeams = (data) => setTeams(Array.isArray(data) ? data : []);

    const onChicken = (data) => {
      setWinner(data);
      setShowWWCD(true);
      setTimeout(() => setShowWWCD(false), config.wwcd?.duration || 8000);
    };

    const onCommand = (cmd) => {
      if (!cmd || typeof cmd !== "object" || cmd.type !== "showChickenDinner") return;
      let team = teamsRef.current.find((t) => t.eliminationRank === 1);
      if (!team) {
        const sorted = buildOverlayStreamRankingOrder(teamsRef.current);
        team = sorted[0];
      }
      const winnerData = team
        ? { team: team.team, logo: team.logo }
        : { team: cmd.team || "CHAMPION", logo: null };
      setWinner(winnerData);
      setShowWWCD(true);
      setTimeout(() => setShowWWCD(false), config.wwcd?.duration || 8000);
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

  const sortLiveOrder = useCallback((list) => buildOverlayStreamRankingOrder(list), []);

  const boardTeams = useMemo(() => {
    if (!cumulativeOverall) return sortLiveOrder(teams);

    const byName = {};
    tournamentStats.forEach((s) => {
      const k = String(s.team || "").toUpperCase();
      if (k) byName[k] = s;
    });

    const merged = teams.map((t) => {
      const st = byName[String(t.team || "").toUpperCase()];
      if (!st) return { ...t };
      return {
        ...t,
        finishes: Number(st.totalKills) || 0,
        points: Number(st.totalPoints) || 0,
      };
    });
    return sortLiveOrder(merged);
  }, [teams, tournamentStats, cumulativeOverall, sortLiveOrder]);

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
        teams={boardTeams}
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
  const explicitOff =
    params.get("overall") === "0" ||
    params.get("cumulative") === "0" ||
    params.get("live") === "1" ||
    params.get("matchOnly") === "1";
  const explicitOn =
    params.get("overall") === "1" ||
    params.get("overall") === "true" ||
    params.get("cumulative") === "1" ||
    params.get("cumulative") === "true";

  /** Default = series totals aligned with Tournament / Overall. Use live=1 for current-match PTS+FIN only. */
  const cumulativeOverall = explicitOn || !explicitOff;

  return (
    <ThemeProvider
      initialTheme={preset?.theme || themeName}
      initialConfig={preset || undefined}
      listenForLive={true}
    >
      <OverlayInner cumulativeOverall={cumulativeOverall} />
    </ThemeProvider>
  );
}
