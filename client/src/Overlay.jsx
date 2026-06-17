import { useEffect, useMemo, useRef, useState } from "react";
import { connectSocket } from "./apiOrigin";
import { buildOverlayStreamRankingOrder } from "./teamDisplayOrder";
import { normalizeTeamsPayload, teamsPayloadEqual } from "./overlays/hooks/useSocketTeams";
import BroadcastRankingBoard from "./overlays/components/BroadcastRankingBoard";
import { apiUrl } from "./apiOrigin";

const socket = connectSocket();

export default function Overlay() {
  const [teams, setTeams] = useState([]);
  const [showWWCD, setShowWWCD] = useState(false);
  const [winner, setWinner] = useState(null);
  const teamsRef = useRef([]);

  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.body.style.background = "transparent";
    return () => {
      document.body.style.margin = "";
      document.body.style.overflow = "";
      document.body.style.background = "";
    };
  }, []);

  useEffect(() => {
    const onTeams = (data) => {
      const next = normalizeTeamsPayload(data);
      setTeams((prev) => (teamsPayloadEqual(prev, next) ? prev : next));
    };

    const onChicken = (data) => {
      setWinner(data);
      setShowWWCD(true);
      setTimeout(() => setShowWWCD(false), 30000);
    };

    const onCommand = (cmd) => {
      if (cmd.type === "showChickenDinner") {
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
        setTimeout(() => setShowWWCD(false), 30000);
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
  }, []);

  const sorted = useMemo(() => buildOverlayStreamRankingOrder(teams), [teams]);

  const winnerLogo = useMemo(() => {
    if (!winner?.logo) return null;
    const s = String(winner.logo).trim();
    if (!s || s.includes("..")) return null;
    if (/^https?:\/\//i.test(s)) return s;
    return apiUrl(s.startsWith("/") ? s : `/${s}`);
  }, [winner]);

  return (
    <>
      {showWWCD && winner ? (
        <div className="lr-wwcd-overlay">
          <div className="lr-wwcd-box">
            <div className="lr-wwcd-top">WINNER WINNER</div>
            <div className="lr-wwcd-main">CHICKEN DINNER</div>
            <div className="lr-wwcd-team">
              {winnerLogo ? (
                <img src={winnerLogo} alt="" className="lr-wwcd-logo" draggable={false} />
              ) : null}
              <div className="lr-wwcd-name">{winner.team}</div>
            </div>
          </div>
        </div>
      ) : null}

      <BroadcastRankingBoard teams={sorted} align="center" />
    </>
  );
}
