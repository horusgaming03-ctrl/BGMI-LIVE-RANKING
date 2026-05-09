import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://127.0.0.1:3001", { transports: ["websocket"] });

export default function Overlay() {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const handle = (data) => setTeams(Array.isArray(data) ? data : []);
    socket.on("teamsUpdated", handle);
    socket.emit("requestTeams");
    return () => socket.off("teamsUpdated", handle);
  }, []);

  const sorted = useMemo(
    () =>
      [...teams].sort(
        (a, b) =>
          b.points - a.points ||
          b.finishes - a.finishes ||
          a.team.localeCompare(b.team)
      ),
    [teams]
  );

  if (!sorted.length) {
    return (
      <div style={styles.loading}>
        No overlay data yet. Start backend and add teams in admin.
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.head}>
          <div>#</div>
          <div>Teams</div>
          <div>Status</div>
          <div>FIN.</div>
          <div>PTS.</div>
        </div>

        {sorted.map((t, idx) => {
          const selected = idx === 9 || idx === 11;
          const status = String(t.status || "alive").toLowerCase();
          const statusColor =
            status === "alive"
              ? "#54f07d"
              : status === "knocked"
              ? "#ff5b2e"
              : "#9aa1aa";

          const activeBars = status === "alive" ? 4 : status === "knocked" ? 2 : 0;

          return (
            <div
              key={t.id ?? idx}
              style={{
                ...styles.row,
                background: selected
                  ? "rgba(166,139,255,.33)"
                  : idx % 2
                  ? "rgba(255,255,255,.04)"
                  : "rgba(255,255,255,.02)",
              }}
            >
              <div style={styles.rank}>{idx + 1}</div>

              <div style={styles.teamCell}>
                <div style={styles.logo}>{String(t.team || "--").slice(0, 2)}</div>
                <div style={styles.teamName}>{t.team || "TEAM"}</div>
              </div>

              <div style={styles.statusCell}>
                <div style={styles.bars}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        ...styles.bar,
                        background:
                          i < activeBars
                            ? status === "knocked" && i < 2
                              ? "#ff5b2e"
                              : "#54f07d"
                            : "#5a5f68",
                      }}
                    />
                  ))}
                </div>

                <span
                  style={{
                    ...styles.pill,
                    color: statusColor,
                    borderColor: `${statusColor}55`,
                  }}
                >
                  {status.toUpperCase()}
                </span>
              </div>

              <div style={styles.value}>{t.finishes ?? 0}</div>
              <div style={styles.value}>{t.points ?? 0}</div>
            </div>
          );
        })}

        <div style={styles.legend}>
          <span>
            <i style={{ ...styles.dot, background: "#54f07d" }} />
            Alive
          </span>
          <span>
            <i style={{ ...styles.dot, background: "#ff5b2e" }} />
            Knocked
          </span>
          <span>
            <i style={{ ...styles.dot, background: "#9aa1aa" }} />
            Eliminated
          </span>
        </div>
      </div>
    </div>
  );
}

const styles = {
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
  head: {
    display: "grid",
    gridTemplateColumns: "70px 1.4fr 260px 110px 110px",
    background: "#0b2b31",
    color: "#8fd7df",
    fontWeight: 800,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    padding: "16px 22px",
    fontSize: "12px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "70px 1.4fr 260px 110px 110px",
    alignItems: "center",
    padding: "12px 22px",
    borderTop: "1px solid rgba(255,255,255,.05)",
  },
  rank: {
    fontSize: "34px",
    fontWeight: 900,
  },
  teamCell: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  logo: {
    width: "46px",
    height: "46px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #f1cf69, #8b681e)",
    color: "#000",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },
  teamName: {
    fontSize: "28px",
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  statusCell: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  bars: {
    display: "flex",
    gap: "5px",
  },
  bar: {
    width: "10px",
    height: "40px",
    borderRadius: "2px",
  },
  pill: {
    border: "1px solid",
    padding: "10px 18px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: 900,
    background: "rgba(255,255,255,.02)",
  },
  value: {
    fontSize: "34px",
    fontWeight: 900,
    textAlign: "left",
  },
  legend: {
    display: "flex",
    justifyContent: "center",
    gap: "26px",
    background: "#071115",
    padding: "14px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
  },
  dot: {
    display: "inline-block",
    width: "14px",
    height: "14px",
    marginRight: "8px",
    verticalAlign: "middle",
  },
};