import { useEffect, useMemo, useRef, useState } from "react";
import { connectSocket, getApiBase } from "./apiOrigin";
import { buildOverlayStreamRankingOrder } from "./teamDisplayOrder";
import { normalizeTeamsPayload, teamsPayloadEqual } from "./overlays/hooks/useSocketTeams";

const API = getApiBase();

const socket = connectSocket();

const THEME = {
  panel: "#15110d",
  rowA: "#1a140f",
  rowB: "#211912",
  gold: "#f0b03a",
  goldDark: "#8a5b12",
  alive: "#f0b03a",
  dead: "#20263b",
};

export default function Overlay() {
  const [teams, setTeams] = useState([]);
  const [showWWCD, setShowWWCD] =
    useState(false);

  const [winner, setWinner] =
    useState(null);

  const teamsRef = useRef([]);

  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  useEffect(() => {
    const onTeams = (data) => {
      const next = normalizeTeamsPayload(data);
      setTeams((prev) => (teamsPayloadEqual(prev, next) ? prev : next));
    };

    const onChicken = (data) => {
      setWinner(data);

      setShowWWCD(true);

      setTimeout(() => {
        setShowWWCD(false);
      }, 30000);
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

    socket.on(
      "chickenDinner",
      onChicken
    );

    socket.on(
      "overlayCommand",
      onCommand
    );

    socket.emit("requestTeams");

    return () => {
      socket.off(
        "teamsUpdated",
        onTeams
      );

      socket.off(
        "chickenDinner",
        onChicken
      );

      socket.off(
        "overlayCommand",
        onCommand
      );
    };
  }, []);

  const sorted = useMemo(() => {
    return buildOverlayStreamRankingOrder(teams);
  }, [teams]);

  return (
    <div style={styles.root}>
      {/* WWCD */}
      {showWWCD && winner && (
        <div style={styles.wwcdOverlay}>
          <div style={styles.wwcdBox}>
            <div style={styles.wwcdTop}>
              WINNER WINNER
            </div>

            <div style={styles.wwcdMain}>
              CHICKEN DINNER
            </div>

            <div style={styles.wwcdTeam}>
              {winner.logo && (
                <img
                  src={`${API}${winner.logo}`}
                  alt=""
                  style={
                    styles.wwcdLogo
                  }
                />
              )}

              <div
                style={styles.wwcdName}
              >
                {winner.team}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div style={styles.board}>
        <div style={styles.topLine} />

        {/* HEADER */}
        <div style={styles.header}>
          <div
            style={styles.headerCenter}
          >
            RANK
          </div>

          <div
            style={{
              ...styles.headerLeft,
              paddingLeft: 2,
            }}
          >
            TEAM
          </div>

          <div
            style={styles.headerCenter}
          >
            FIN
          </div>

          <div
            style={styles.headerCenter}
          >
            TOTAL
          </div>

          <div
            style={styles.headerCenter}
          >
            ALIVE
          </div>
        </div>

        {/* ROWS */}
        {sorted.map((t, i) => {
          const status = String(
            t.status || "alive"
          ).toLowerCase();

          const alive =
            t.alivePlayers ??
            (status === "alive"
              ? 4
              : 0);

          return (
            <div
              key={t.id ?? i}
              style={{
                ...styles.row,
                background:
                  i % 2 === 0
                    ? THEME.rowA
                    : THEME.rowB,
              }}
            >
              {/* RANK */}
              <div
                style={styles.rankBox}
              >
                #{i + 1}
              </div>

              {/* TEAM */}
              <div
                style={styles.teamWrap}
              >
                <div
                  style={
                    styles.logoBox
                  }
                >
                  {t.logo ? (
                    <img
                      src={`${API}${t.logo}`}
                      alt=""
                      style={
                        styles.logo
                      }
                    />
                  ) : (
                    <span
                      style={
                        styles.logoText
                      }
                    >
                      {String(
                        t.team || "TM"
                      ).slice(0, 2)}
                    </span>
                  )}
                </div>

                <div
                  style={
                    styles.teamName
                  }
                >
                  {t.team}
                </div>
              </div>

              {/* FIN */}
              <div
                style={{
                  ...styles.number,
                  color:
                    (t.finishes ??
                      0) > 0
                      ? THEME.gold
                      : "#555",
                }}
              >
                {t.finishes ?? 0}
              </div>

              {/* TOTAL */}
              <div
                style={styles.number}
              >
                {t.points ?? 0}
              </div>

              {/* ALIVE */}
              <div
                style={
                  styles.aliveWrap
                }
              >
                {[0, 1, 2, 3].map(
                  (p) => (
                    <div
                      key={p}
                      style={{
                        ...styles.aliveBox,
                        background:
                          p < alive
                            ? THEME.alive
                            : THEME.dead,
                      }}
                    />
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        *{
          margin:0;
          padding:0;
          box-sizing:border-box;
        }

        body{
          overflow:hidden;
          background:transparent;
        }

        @keyframes wwcdPop{
          from{
            opacity:0;
            transform:scale(.9);
          }
          to{
            opacity:1;
            transform:scale(1);
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  root: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "transparent",
    fontFamily:
      "'Rajdhani','Inter',sans-serif",
  },

  /* COMPACT BOARD */
  board: {
    width: 300,

    background: THEME.panel,

    border: `1px solid ${THEME.goldDark}`,

    overflow: "hidden",

    boxShadow:
      "0 0 40px rgba(0,0,0,.7)",
  },

  topLine: {
    height: 4,

    background:
      "linear-gradient(90deg,#6b4308,#f0b03a,#6b4308)",
  },

  /* COMPACT HEADER */
  header: {
    display: "grid",

    gridTemplateColumns:
      "52px 92px 38px 52px 46px",

    alignItems: "center",

    padding: "8px 6px",

    background:
      "linear-gradient(180deg,#2a1c0f,#16110d)",

    borderBottom:
      "1px solid rgba(240,176,58,.3)",
  },

  headerCenter: {
    textAlign: "center",

    color: THEME.gold,

    fontSize: 11,

    fontWeight: 700,

    letterSpacing: 1,
  },

  headerLeft: {
    color: THEME.gold,

    fontSize: 11,

    fontWeight: 700,

    letterSpacing: 1,
  },

  /* COMPACT ROW */
  row: {
    display: "grid",

    gridTemplateColumns:
      "52px 92px 38px 52px 46px",

    alignItems: "center",

    minHeight: 42,

    padding: "5px 6px",

    borderBottom:
      "1px solid rgba(255,255,255,.03)",
  },

  rankBox: {
    color: "#fff",

    fontSize: 16,

    fontWeight: 700,

    textAlign: "center",

    fontStyle: "italic",
  },

  teamWrap: {
    display: "flex",

    alignItems: "center",

    gap: 5,

    minWidth: 0,
  },

  logoBox: {
    width: 24,

    height: 24,

    border:
      "1px solid rgba(240,176,58,.35)",

    background:
      "linear-gradient(180deg,#24180f,#130d08)",

    display: "grid",

    placeItems: "center",

    overflow: "hidden",

    flexShrink: 0,
  },

  logo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  logoText: {
    color: THEME.gold,

    fontSize: 9,

    fontWeight: 800,
  },

  teamName: {
    color: "#fff",

    fontWeight: 700,

    fontSize: 12,

    whiteSpace: "nowrap",

    overflow: "hidden",

    textOverflow: "ellipsis",
  },

  number: {
    textAlign: "center",

    color: "#fff",

    fontSize: 16,

    fontWeight: 700,
  },

  aliveWrap: {
    width: 30,

    height: 20,

    display: "grid",

    gridTemplateColumns:
      "1fr 1fr",

    gridTemplateRows:
      "1fr 1fr",

    gap: 2,

    justifySelf: "center",
  },

  aliveBox: {
    borderRadius: 2,
  },

  wwcdOverlay: {
    position: "fixed",

    inset: 0,

    background: "rgba(0,0,0,.92)",

    display: "grid",

    placeItems: "center",

    zIndex: 9999,
  },

  wwcdBox: {
    width: 700,

    padding: "60px 40px",

    background:
      "linear-gradient(180deg,#241607,#090603)",

    border: `2px solid ${THEME.gold}`,

    textAlign: "center",

    animation:
      "wwcdPop .4s ease",
  },

  wwcdTop: {
    color: THEME.gold,

    fontSize: 20,

    fontWeight: 700,

    letterSpacing: 8,

    marginBottom: 10,
  },

  wwcdMain: {
    color: "#fff",

    fontSize: 64,

    fontWeight: 800,

    lineHeight: 1,
  },

  wwcdTeam: {
    marginTop: 28,

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    gap: 16,
  },

  wwcdLogo: {
    width: 64,

    height: 64,

    objectFit: "cover",
  },

  wwcdName: {
    color: THEME.gold,

    fontSize: 40,

    fontWeight: 800,
  },
};