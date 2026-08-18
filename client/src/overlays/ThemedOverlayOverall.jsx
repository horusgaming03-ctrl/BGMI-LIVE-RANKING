import { useEffect, useState } from "react";
import { ThemeProvider } from "./ThemeContext";
import { getPresetConfig } from "./presets";
import socket from "./socket";
import MumbaiStandingsBoard from "./MumbaiStandingsBoard";

/** Overall standings — transparent standings-only GFX (use /overall-standing/overlay.html in OBS). */
function OverallInner() {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    const onTournament = (data) => setStats(Array.isArray(data) ? data : []);
    const onCommand = (cmd) => {
      if (cmd.type === "toggleFullscreen") {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
    };

    socket.on("tournamentUpdated", onTournament);
    socket.on("overlayCommand", onCommand);
    socket.emit("requestTournament");

    const interval = setInterval(() => socket.emit("requestTournament"), 5000);
    return () => {
      socket.off("tournamentUpdated", onTournament);
      socket.off("overlayCommand", onCommand);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <MumbaiStandingsBoard teams={stats} />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { overflow: hidden; background: transparent; }
      `}</style>
    </>
  );
}

export default function ThemedOverlayOverall() {
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
      <OverallInner />
    </ThemeProvider>
  );
}
