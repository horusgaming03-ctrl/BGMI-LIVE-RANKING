import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://127.0.0.1:3001", { transports: ["websocket"] });
const defaultForm = { team: "", status: "alive", finishes: 0, points: 0 };

export default function AdminPanel() {
  const [teams, setTeams] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("Select a team to edit or create a new one.");

  useEffect(() => {
    const handle = (data) => setTeams(Array.isArray(data) ? data : []);
    socket.on("teamsUpdated", handle);
    socket.emit("requestTeams");
    return () => socket.off("teamsUpdated", handle);
  }, []);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedId) || null,
    [teams, selectedId]
  );

  useEffect(() => {
    if (selectedTeam) {
      setForm({
        team: selectedTeam.team,
        status: selectedTeam.status,
        finishes: selectedTeam.finishes,
        points: selectedTeam.points,
      });
    }
  }, [selectedTeam]);

  const selectTeam = (team) => {
    setSelectedId(team.id);
    setMessage(`Editing ${team.team}`);
    setForm({
      team: team.team,
      status: team.status,
      finishes: team.finishes,
      points: team.points,
    });
  };

  const createTeam = async () => {
    const res = await fetch("http://127.0.0.1:3001/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team: form.team,
        status: form.status,
        finishes: Number(form.finishes),
        points: Number(form.points),
      }),
    });

    setMessage(res.ok ? "New team added." : "Could not add team.");
    if (res.ok) setForm(defaultForm);
  };

  const updateTeam = async () => {
    if (!selectedId) return setMessage("Select a team first.");

    const res = await fetch(`http://127.0.0.1:3001/teams/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team: form.team,
        status: form.status,
        finishes: Number(form.finishes),
        points: Number(form.points),
      }),
    });

    setMessage(res.ok ? "Team updated live." : "Update failed.");
  };

  const deleteTeam = async (id) => {
    const res = await fetch(`http://127.0.0.1:3001/teams/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      if (selectedId === id) {
        setSelectedId(null);
        setForm(defaultForm);
      }
      setMessage("Team deleted.");
    } else {
      setMessage("Delete failed.");
    }
  };

  const stats = {
    total: teams.length,
    alive: teams.filter((t) => t.status === "alive").length,
    knocked: teams.filter((t) => t.status === "knocked").length,
    eliminated: teams.filter((t) => t.status === "eliminated").length,
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>HORUS TOURNAMENT CONTROL</div>
            <h1 style={styles.title}>Admin Panel</h1>
            <p style={styles.subtitle}>{message}</p>
          </div>

          <div style={styles.statsGrid}>
            <StatCard label="Teams" value={stats.total} accent="#55efc4" />
            <StatCard label="Alive" value={stats.alive} accent="#5CFF72" />
            <StatCard label="Knocked" value={stats.knocked} accent="#FF6B45" />
            <StatCard label="Out" value={stats.eliminated} accent="#A5B4BF" />
          </div>
        </header>

        <div style={styles.layout}>
          <section style={styles.tableCard}>
            <div style={styles.cardHeader}>
              <div>
                <p style={styles.cardLabel}>MATCH STANDINGS</p>
                <h2 style={styles.cardTitle}>Team Control Table</h2>
              </div>
              <div style={styles.badge}>{teams.length} teams</div>
            </div>

            <div style={styles.tableHead}>
              <div>#</div>
              <div>Team</div>
              <div>Status</div>
              <div>Finishes</div>
              <div>Points</div>
              <div>Action</div>
            </div>

            <div style={styles.rowsWrap}>
              {teams.length === 0 ? (
                <div style={styles.emptyState}>
                  No teams yet. Add your first team from the admin panel.
                </div>
              ) : (
                teams.map((team, index) => {
                  const active = team.id === selectedId;
                  const statusColor =
                    team.status === "alive"
                      ? "#5CFF72"
                      : team.status === "knocked"
                      ? "#FF6B45"
                      : "#A5B4BF";

                  return (
                    <div
                      key={team.id}
                      style={{
                        ...styles.row,
                        background: active
                          ? "linear-gradient(90deg, rgba(108,92,231,0.26), rgba(20,28,36,0.95))"
                          : index % 2 === 0
                          ? "rgba(255,255,255,0.02)"
                          : "rgba(255,255,255,0.035)",
                        borderLeft: active
                          ? "3px solid #8B7CFF"
                          : "3px solid transparent",
                      }}
                    >
                      <div style={styles.rank}>{index + 1}</div>

                      <div style={styles.teamCell}>
                        <div style={styles.teamLogo}>{team.team.slice(0, 2)}</div>
                        <div>
                          <div style={styles.teamName}>{team.team}</div>
                          <div style={styles.teamSub}>Live editable team</div>
                        </div>
                      </div>

                      <div>
                        <span
                          style={{
                            ...styles.statusPill,
                            color: statusColor,
                            borderColor: `${statusColor}44`,
                          }}
                        >
                          {team.status.toUpperCase()}
                        </span>
                      </div>

                      <div style={styles.valueCell}>{team.finishes}</div>
                      <div style={styles.valueCell}>{team.points}</div>

                      <div style={styles.actionWrap}>
                        <button onClick={() => selectTeam(team)} style={styles.editBtn}>
                          Edit
                        </button>
                        <button onClick={() => deleteTeam(team.id)} style={styles.deleteBtn}>
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <aside style={styles.formCard}>
            <div style={styles.cardHeaderAlt}>
              <div>
                <p style={styles.cardLabel}>LIVE CONTROL</p>
                <h2 style={styles.cardTitle}>Create / Update Team</h2>
              </div>
            </div>

            <div style={styles.formGrid}>
              <Field label="Team name">
                <input
                  style={styles.input}
                  value={form.team}
                  onChange={(e) =>
                    setForm({ ...form, team: e.target.value.toUpperCase() })
                  }
                  placeholder="ENTER TEAM NAME"
                />
              </Field>

              <Field label="Status">
                <select
                  style={styles.input}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="alive">Alive</option>
                  <option value="knocked">Knocked</option>
                  <option value="eliminated">Eliminated</option>
                </select>
              </Field>

              <div style={styles.inlineFields}>
                <Field label="Finishes">
                  <input
                    type="number"
                    min="0"
                    style={styles.input}
                    value={form.finishes}
                    onChange={(e) => setForm({ ...form, finishes: e.target.value })}
                  />
                </Field>

                <Field label="Points">
                  <input
                    type="number"
                    min="0"
                    style={styles.input}
                    value={form.points}
                    onChange={(e) => setForm({ ...form, points: e.target.value })}
                  />
                </Field>
              </div>

              <div style={styles.buttonRow}>
                <button onClick={createTeam} style={styles.primaryBtn}>
                  Add Team
                </button>
                <button onClick={updateTeam} style={styles.secondaryBtn}>
                  Update Selected
                </button>
              </div>

              <div style={styles.helpCard}>
                <div style={styles.helpTitle}>How to use</div>
                <p style={styles.helpText}>
                  Add new teams, select a row to edit it, and push updates live.
                  The same backend can later power your public live ranking screen.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: accent }}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, #103740 0%, #071116 50%, #040b10 100%)",
    color: "#ECF8FB",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: 24,
  },
  container: {
    maxWidth: 1440,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  eyebrow: {
    color: "#6FF3CB",
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: 800,
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 42,
    lineHeight: 1,
    fontWeight: 900,
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#9EC1C7",
    fontSize: 15,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(110px, 1fr))",
    gap: 12,
  },
  statCard: {
    background: "linear-gradient(180deg, rgba(10,27,34,.95), rgba(8,21,26,.9))",
    border: "1px solid rgba(132, 214, 208, 0.12)",
    borderRadius: 18,
    padding: "14px 16px",
    minWidth: 110,
    boxShadow: "0 14px 34px rgba(0,0,0,.25)",
  },
  statLabel: {
    color: "#83AEB6",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statValue: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: 900,
    lineHeight: 1,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.55fr) minmax(360px, 0.9fr)",
    gap: 20,
    alignItems: "start",
  },
  tableCard: {
    background: "linear-gradient(180deg, rgba(7,22,27,.97), rgba(5,16,21,.96))",
    borderRadius: 24,
    border: "1px solid rgba(112, 210, 206, .12)",
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(0,0,0,.35)",
  },
  formCard: {
    background: "linear-gradient(180deg, rgba(7,22,27,.97), rgba(5,16,21,.96))",
    borderRadius: 24,
    border: "1px solid rgba(112, 210, 206, .12)",
    padding: 22,
    boxShadow: "0 24px 60px rgba(0,0,0,.35)",
    position: "sticky",
    top: 18,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "20px 20px 16px",
    borderBottom: "1px solid rgba(255,255,255,.05)",
  },
  cardHeaderAlt: {
    marginBottom: 16,
  },
  cardLabel: {
    margin: 0,
    color: "#75E6BF",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 2,
  },
  cardTitle: {
    margin: "8px 0 0",
    fontSize: 28,
    lineHeight: 1.05,
    fontWeight: 900,
  },
  badge: {
    border: "1px solid rgba(118, 230, 195, .2)",
    color: "#A4E8D0",
    background: "rgba(111, 243, 203, .08)",
    padding: "10px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "72px minmax(180px, 1fr) 150px 110px 100px 170px",
    padding: "14px 20px",
    color: "#7FAFB8",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    borderBottom: "1px solid rgba(255,255,255,.05)",
  },
  rowsWrap: {
    paddingBottom: 6,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "72px minmax(180px, 1fr) 150px 110px 100px 170px",
    alignItems: "center",
    padding: "14px 20px",
    borderBottom: "1px solid rgba(255,255,255,.04)",
  },
  rank: {
    fontSize: 28,
    fontWeight: 900,
  },
  teamCell: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  teamLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: "linear-gradient(135deg, #F1CF69, #8B681E)",
    color: "#081116",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 14,
    boxShadow: "0 10px 22px rgba(0,0,0,.22)",
  },
  teamName: {
    fontSize: 18,
    fontWeight: 800,
  },
  teamSub: {
    marginTop: 4,
    color: "#7EACB3",
    fontSize: 12,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 96,
    padding: "9px 12px",
    borderRadius: 999,
    border: "1px solid",
    background: "rgba(255,255,255,.03)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
  },
  valueCell: {
    fontSize: 24,
    fontWeight: 900,
  },
  actionWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  editBtn: {
    background: "#122F36",
    color: "#E9FBFD",
    border: "1px solid #244A53",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  deleteBtn: {
    background: "#3A1620",
    color: "#FFDCE2",
    border: "1px solid #6B2B3B",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  emptyState: {
    padding: 32,
    color: "#96BDC4",
    fontSize: 15,
  },
  formGrid: {
    display: "grid",
    gap: 16,
  },
  field: {
    display: "grid",
    gap: 8,
  },
  fieldLabel: {
    color: "#8CB7BE",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.3,
    fontWeight: 800,
  },
  input: {
    width: "100%",
    background: "linear-gradient(90deg, rgba(13,29,34,1), rgba(10,24,29,1))",
    color: "#F2FEFF",
    border: "1px solid #1E3A43",
    borderRadius: 14,
    padding: "14px 15px",
    fontSize: 15,
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  },
  inlineFields: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  primaryBtn: {
    background: "linear-gradient(90deg, #41E8B8, #2ED7A7)",
    color: "#031014",
    border: "none",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(65,232,184,.18)",
  },
  secondaryBtn: {
    background: "linear-gradient(180deg, #143039, #10252C)",
    color: "#ECFBFD",
    border: "1px solid #244B55",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
  },
  helpCard: {
    marginTop: 4,
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.06)",
  },
  helpTitle: {
    fontSize: 13,
    color: "#73E7BE",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: 800,
    marginBottom: 8,
  },
  helpText: {
    margin: 0,
    color: "#A5C6CC",
    lineHeight: 1.65,
    fontSize: 14,
  },
};