import { useEffect, useMemo, useState } from "react";
import WwcdFourAliveStrip from "./WwcdFourAliveStrip";
import { stripTeamsFromAlive } from "../wwcdModel";
import { useGfxOverlayColors } from "./hooks/useGfxOverlayColors";
import { useRoundRobinOverlay } from "./hooks/useRoundRobinOverlay";
import { overlayListensToRoundRobin, overlayListensToSimple } from "./utils/overlaySource";
import socket from "./socket";

export default function WwcFourAliveStripOverlay() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const debug = params.get("debug") === "1";
  const position = params.get("position") === "bottom" ? "bottom" : "center";
  const listenSimple = overlayListensToSimple();
  const listenRr = overlayListensToRoundRobin();

  const [simpleTeams, setSimpleTeams] = useState([]);
  const { teams: rrTeams, matchMeta } = useRoundRobinOverlay();
  const { wwcdStripColors } = useGfxOverlayColors();

  useEffect(() => {
    if (!listenSimple) return undefined;
    const onTeams = (data) => setSimpleTeams(Array.isArray(data) ? data : []);
    const onMatchUpdated = (payload) => {
      if (payload && Array.isArray(payload.teams)) setSimpleTeams(payload.teams);
    };
    socket.on("teamsUpdated", onTeams);
    socket.on("matchUpdated", onMatchUpdated);
    socket.emit("requestTeams");
    return () => {
      socket.off("teamsUpdated", onTeams);
      socket.off("matchUpdated", onMatchUpdated);
    };
  }, [listenSimple]);

  const teams = useMemo(() => {
    const simpleList = listenSimple && Array.isArray(simpleTeams) ? simpleTeams : [];
    const rrLive = listenRr && String(matchMeta?.status || "").toLowerCase() === "live";
    const rrList = rrLive && Array.isArray(rrTeams) ? rrTeams : [];
    const simpleStrip = stripTeamsFromAlive(simpleList);
    const rrStrip = stripTeamsFromAlive(rrList);
    if (rrStrip.length) return rrList;
    if (simpleStrip.length) return simpleList;
    return [];
  }, [listenSimple, listenRr, simpleTeams, rrTeams, matchMeta]);

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
