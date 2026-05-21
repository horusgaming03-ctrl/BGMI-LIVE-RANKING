import { useEffect, useMemo, useRef, useState } from "react";
import EngineOverlayProvider, { useEngineOverlay } from "./EngineThemeContext";
import useEngineAnimation from "./animations/useEngineAnimation";
import { engineKeyframeCss } from "./animations/keyframes";
import keyframes from "../overlays/animations/keyframes";
import EngineThemedBoard from "./components/EngineThemedBoard";
import ThemedWWCD from "../overlays/components/ThemedWWCD";
import BackgroundEffects from "../overlays/effects/BackgroundEffects";
import socket from "../overlays/socket";
import { buildLiveRankingOrder } from "../teamDisplayOrder";

function EngineDebugHud() {
  const o = useEngineOverlay();
  const debug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  if (!debug) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        fontSize: 10,
        color: "rgba(255,255,255,.55)",
        fontFamily: "monospace",
        maxWidth: "92vw",
        pointerEvents: "none",
        zIndex: 99999,
      }}
    >
      BROADCAST ENGINE · theme={o.themeId} design={o.designId} alive={o.aliveStyle} anim={o.animationPack}
      {o.bundleId ? ` · bundle=${o.bundleId}` : ""}
      {new URLSearchParams(window.location.search).get("syncAdmin") === "1" ? " · syncAdmin" : ""} · Alt+←/→
    </div>
  );
}

function EngineOverlayInner() {
  const { theme, design, aliveStyle, aliveLayout, aliveCustomAlive, aliveCustomDead, animationPack, config, enableAnimations } =
    useEngineOverlay();
  const anim = useEngineAnimation(animationPack, enableAnimations);

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
          const sorted = buildLiveRankingOrder(teamsRef.current);
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

  const sorted = useMemo(() => buildLiveRankingOrder(teams), [teams]);

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

      <EngineThemedBoard
        teams={sorted}
        theme={theme}
        anim={anim}
        config={config}
        design={design}
        aliveStyle={aliveStyle}
        aliveLayout={aliveLayout}
        aliveCustomAlive={aliveCustomAlive}
        aliveCustomDead={aliveCustomDead}
      />

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden; background: transparent; }
        ${keyframes}
        ${engineKeyframeCss}
      `}</style>
    </div>
  );
}

export default function BroadcastEngineOverlay() {
  return (
    <EngineOverlayProvider>
      <EngineOverlayInner />
      <EngineDebugHud />
    </EngineOverlayProvider>
  );
}
