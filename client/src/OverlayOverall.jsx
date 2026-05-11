import { useEffect, useState } from "react";
import { connectSocket, getApiBase } from "./apiOrigin";

const API = getApiBase();
const socket = connectSocket();

export default function OverlayOverall() {
  const [stats, setStats] = useState([]);
  const [match, setMatch] = useState({ number: 1 });

  useEffect(() => {
    const onTournament = (data) => setStats(Array.isArray(data) ? data : []);
    const onMatch = (data) => setMatch(data);
    const onCommand = (cmd) => {
      if (cmd.type === "toggleFullscreen") {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
    };

    socket.on("tournamentUpdated", onTournament);
    socket.on("matchUpdated", onMatch);
    socket.on("overlayCommand", onCommand);
    socket.emit("requestTournament");
    socket.emit("requestMatch");

    const interval = setInterval(() => {
      socket.emit("requestTournament");
    }, 5000);

    return () => {
      socket.off("tournamentUpdated", onTournament);
      socket.off("matchUpdated", onMatch);
      socket.off("overlayCommand", onCommand);
      clearInterval(interval);
    };
  }, []);

  if (!stats.length) {
    return (
      <div style={s.loading}>
        No tournament data yet. Complete matches to see overall standings.
      </div>
    );
  }

  const topFragger = [...stats].sort((a, b) => b.totalKills - a.totalKills)[0];
  const topWWCD = [...stats].sort((a, b) => b.chickenDinners - a.chickenDinners)[0];

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.headerBar}>
          <div style={s.headerLeft}>
            <span style={s.headerLabel}>HORUS ESPORTS</span>
            <span style={s.headerDivider}>|</span>
            <span style={s.headerMatch}>OVERALL STANDINGS</span>
          </div>
          <div style={s.headerRight}>
            <span style={s.matchBadge}>AFTER {match.number || 1} MATCHES</span>
          </div>
        </div>

        {/* MVP Strip */}
        <div style={s.mvpStrip}>
          <div style={s.mvpItem}>
            <span style={s.mvpLabel}>🏆 LEADER</span>
            <span style={s.mvpValue}>{stats[0]?.team} — {stats[0]?.totalPoints} PTS</span>
          </div>
          {topFragger && (
            <div style={s.mvpItem}>
              <span style={s.mvpLabel}>🎯 TOP FRAGGER</span>
              <span style={s.mvpValue}>{topFragger.team} — {topFragger.totalKills} KILLS</span>
            </div>
          )}
          {topWWCD && topWWCD.chickenDinners > 0 && (
            <div style={s.mvpItem}>
              <span style={s.mvpLabel}>🍗 MOST WWCD</span>
              <span style={s.mvpValue}>{topWWCD.team} — {topWWCD.chickenDinners}x</span>
            </div>
          )}
        </div>

        {/* Column Headers */}
        <div style={s.head}>
          <div>#</div>
          <div>Team</div>
          <div>M</div>
          <div>Kills</div>
          <div>Pos Pts</div>
          <div>WWCD</div>
          <div>Total</div>
        </div>

        {/* Rows */}
        {stats.map((team, idx) => {
          const isTop3 = idx < 3;
          return (
            <div
              key={idx}
              style={{
                ...s.row,
                background: isTop3
                  ? `rgba(241,207,105,${0.08 - idx * 0.02})`
                  : idx % 2
                  ? "rgba(255,255,255,.04)"
                  : "rgba(255,255,255,.02)",
                borderLeft: isTop3
                  ? "3px solid #F1CF69"
                  : "3px solid transparent",
              }}
            >
              <div style={{ ...s.rank, color: isTop3 ? "#F1CF69" : "#fff" }}>
                {idx + 1}
              </div>
              <div style={s.teamCell}>
                <div
                  style={{
                    ...s.logo,
                    ...(team.logo
                      ? {
                          backgroundImage: `url(${API}${team.logo})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          color: "transparent",
                        }
                      : {}),
                  }}
                >
                  {team.logo ? "" : team.team.slice(0, 2)}
                </div>
                <div>
                  <div style={s.teamName}>{team.team}</div>
                  {team.chickenDinners > 0 && (
                    <div style={s.dinnerBadge}>🏆 ×{team.chickenDinners}</div>
                  )}
                </div>
              </div>
              <div style={s.val}>{team.matchesPlayed}</div>
              <div style={s.val}>{team.totalKills}</div>
              <div style={{ ...s.val, color: "#F1CF69" }}>{team.totalPositionPoints}</div>
              <div style={{ ...s.val, color: "#FFD700" }}>{team.chickenDinners}</div>
              <div style={{ ...s.totalVal, color: isTop3 ? "#55efc4" : "#fff" }}>
                {team.totalPoints}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div style={s.footer}>
          <span style={{ color: "#5a7a82" }}>HORUS TOURNAMENT SYSTEM</span>
          <span style={{ color: "#5a7a82" }}>POWERED BY LIVE SYNC</span>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    width: "100vw",
    background: "transparent",
    color: "#fff",
    padding: "24px",
    boxSizing: "border-box",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  loading: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    color: "#fff",
    background: "#000",
    fontSize: "28px",
    fontWeight: 800,
    textAlign: "center",
    padding: "40px",
  },
  card: {
    width: "100%",
    borderRadius: "28px",
    overflow: "hidden",
    background: "rgba(6,18,22,.96)",
    border: "1px solid rgba(255,255,255,.08)",
    boxShadow: "0 24px 60px rgba(0,0,0,.45)",
  },
  headerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 22px",
    background: "linear-gradient(90deg, rgba(16,55,64,.95), rgba(7,17,22,.95))",
    borderBottom: "1px solid rgba(255,255,255,.06)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px" },
  headerLabel: {
    color: "#6FF3CB",
    fontSize: "13px",
    fontWeight: 900,
    letterSpacing: "0.15em",
  },
  headerDivider: { color: "rgba(255,255,255,.15)" },
  headerMatch: {
    color: "#8fd7df",
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "0.1em",
  },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  matchBadge: {
    background: "rgba(111, 243, 203, .1)",
    border: "1px solid rgba(118, 230, 195, .2)",
    color: "#A4E8D0",
    padding: "6px 14px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.05em",
  },
  mvpStrip: {
    display: "flex",
    justifyContent: "center",
    gap: "30px",
    padding: "12px 22px",
    background: "rgba(255,255,255,.02)",
    borderBottom: "1px solid rgba(255,255,255,.05)",
  },
  mvpItem: { display: "flex", alignItems: "center", gap: "8px" },
  mvpLabel: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: "#8CB7BE",
  },
  mvpValue: {
    fontSize: "13px",
    fontWeight: 900,
    color: "#ECF8FB",
  },
  head: {
    display: "grid",
    gridTemplateColumns: "60px 1.4fr 60px 80px 80px 70px 100px",
    background: "#0b2b31",
    color: "#8fd7df",
    fontWeight: 800,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    padding: "14px 22px",
    fontSize: "11px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "60px 1.4fr 60px 80px 80px 70px 100px",
    alignItems: "center",
    padding: "10px 22px",
    borderTop: "1px solid rgba(255,255,255,.05)",
  },
  rank: { fontSize: "30px", fontWeight: 900 },
  teamCell: { display: "flex", alignItems: "center", gap: "12px" },
  logo: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #f1cf69, #8b681e)",
    color: "#000",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: "13px",
    flexShrink: 0,
  },
  teamName: { fontSize: "24px", fontWeight: 900, letterSpacing: "-0.02em" },
  dinnerBadge: { fontSize: "12px", color: "#FFD700", marginTop: "2px" },
  val: { fontSize: "22px", fontWeight: 900, textAlign: "center" },
  totalVal: { fontSize: "30px", fontWeight: 900, textAlign: "center" },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 22px",
    background: "#071115",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
};
