import { useEffect, useState } from "react";
import { connectSocket, getApiBase } from "./apiOrigin";
import MumbaiStandingsBoard from "./overlays/MumbaiStandingsBoard";

const socket = connectSocket();

export default function OverlayOverall() {
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
