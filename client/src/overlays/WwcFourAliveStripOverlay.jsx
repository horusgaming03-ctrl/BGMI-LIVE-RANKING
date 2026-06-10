import { useEffect, useMemo, useState } from "react";
import socket from "./socket";
import { wwcdPercentsForStripTeams, stripTeamsFromAlive } from "../wwcdModel";
import WwcdStripTeamCard, { wwcdStripStyleFromColors } from "./WwcdStripTeamCard";
import { useGfxOverlayColors } from "./hooks/useGfxOverlayColors";

export default function WwcFourAliveStripOverlay() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const debug = params.get("debug") === "1";
  const position = params.get("position") === "bottom" ? "bottom" : "center";

  const [teams, setTeams] = useState([]);
  const { wwcdStripColors } = useGfxOverlayColors();
  const stripStyle = useMemo(() => wwcdStripStyleFromColors(wwcdStripColors), [wwcdStripColors]);

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

  /** Show strip for final-circle counts only: 1–4 squads still alive (>4 hidden). */
  const stripTeams = useMemo(() => {
    const sorted = stripTeamsFromAlive(teams);
    return sorted.length ? sorted : null;
  }, [teams]);

  const aliveTeams = useMemo(() => {
    return teams.filter((t) => String(t.status || "").toLowerCase() !== "eliminated");
  }, [teams]);

  const percents = useMemo(() => wwcdPercentsForStripTeams(stripTeams), [stripTeams]);

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
      {stripTeams && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            ...(position === "bottom"
              ? { bottom: "7%", transform: "translateX(-50%)" }
              : { top: "50%", transform: "translate(-50%, -50%)" }),
            width: "max-content",
            maxWidth: "min(1680px, 96vw)",
            display: "flex",
            flexDirection: "row",
            gap: 14,
            flexWrap: "nowrap",
            alignItems: "stretch",
            justifyContent: "center",
          }}
        >
          {stripTeams.map((team, i) => (
            <WwcdStripTeamCard
              key={team.id ?? `${team.team}-${i}`}
              team={team}
              wwcdPct={percents[i] ?? 0}
              logoBoxBg={stripStyle.logoBoxBg}
              barGreen={stripStyle.barGreen}
              barDead={stripStyle.barDead}
              barsBg={stripStyle.barsBg}
              footerBg={stripStyle.footerBg}
              footerText={stripStyle.footerText}
              initialsColor={stripStyle.initialsColor}
              fontFamily={stripStyle.fontFamily}
              cardBoxShadow={stripStyle.cardBoxShadow}
            />
          ))}
        </div>
      )}

      {debug && !stripTeams && (
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
