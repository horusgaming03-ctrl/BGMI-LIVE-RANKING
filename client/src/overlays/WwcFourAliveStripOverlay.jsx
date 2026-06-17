import { useEffect, useState } from "react";
import WwcdFourAliveStrip from "./WwcdFourAliveStrip";
import { stripTeamsFromAlive } from "../wwcdModel";
import { useGfxOverlayColors } from "./hooks/useGfxOverlayColors";
import socket from "./socket";

export default function WwcFourAliveStripOverlay() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const debug = params.get("debug") === "1";
  const position = params.get("position") === "bottom" ? "bottom" : "center";

  const [teams, setTeams] = useState([]);
  const { wwcdStripColors } = useGfxOverlayColors();

  useEffect(() => {
    const onTeams = (data) => setTeams(Array.isArray(data) ? data : []);
    const onMatchUpdated = (payload) => {
      if (payload && Array.isArray(payload.teams)) setTeams(payload.teams);
    };
    socket.on("teamsUpdated", onTeams);
    socket.on("matchUpdated", onMatchUpdated);
    socket.emit("requestTeams");
    return () => {
      socket.off("teamsUpdated", onTeams);
      socket.off("matchUpdated", onMatchUpdated);
    };
  }, []);

  const stripTeams = stripTeamsFromAlive(teams);
  const aliveTeams = teams.filter((t) => String(t.status || "").toLowerCase() !== "eliminated");

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "transparent",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <WwcdFourAliveStrip teams={teams} stripColors={wwcdStripColors} position={position} />

      {debug && !stripTeams.length && (
        <div
          style={{
            position: "fixed",
            bottom: 12,
            left: 12,
            fontSize: 12,
            color: "rgba(255,255,255,.45)",
            fontFamily: "monospace",
          }}
        >
          WWCD strip hidden ({aliveTeams.length} squad{aliveTeams.length === 1 ? "" : "s"} alive — shows for 1–4
          alive; 5+ hides)
        </div>
      )}

      <style>{`
        *,
        *::before,
        *::after {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html {
          height: 100%;
          overflow: hidden;
          background: transparent !important;
        }
        body {
          overflow: hidden;
          min-height: 100%;
          height: 100%;
          background: transparent !important;
        }
        #root {
          min-height: 100%;
          height: 100%;
          background: transparent !important;
        }
      `}</style>
    </div>
  );
}
