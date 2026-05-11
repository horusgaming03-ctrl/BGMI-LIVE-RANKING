import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { connectSocket, getApiBase } from "./apiOrigin";

const API = getApiBase();
const socket = connectSocket();
const defaultForm = { team: "", status: "alive", finishes: 0, points: 0 };

function normalizeWwcdArts(arr) {
  const src = Array.isArray(arr) ? arr : [];
  return [0, 1, 2, 3].map((i) => (typeof src[i] === "string" && src[i].trim() ? src[i].trim() : null));
}

export default function AdminPanel() {
  const [teams, setTeams] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("Select a team to edit or create a new one.");

  // ── New State ──
  const [currentMatch, setCurrentMatch] = useState({ number: 1, status: "live" });
  const [autoCalculate, setAutoCalculate] = useState(true);
  const [matchHistory, setMatchHistory] = useState([]);
  const [tournamentStats, setTournamentStats] = useState([]);
  const [expandedSection, setExpandedSection] = useState("match");
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [screenshotResults, setScreenshotResults] = useState(null);
  const [processingScreenshot, setProcessingScreenshot] = useState(false);
  const [chickenDinnerTeam, setChickenDinnerTeam] = useState(null);
  const [wwcdColors, setWwcdColors] = useState({ primary: "", gold: "", accent: "", bg: "" });
  const [wwcdCharacterArts, setWwcdCharacterArts] = useState([null, null, null, null]);
  const [wwcdSlotSelected, setWwcdSlotSelected] = useState(0);
  const [wwcdUrlDraft, setWwcdUrlDraft] = useState("");
  const [screenshotPreviews, setScreenshotPreviews] = useState([]);
  const screenshotInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const wwcdFileInputRef = useRef(null);
  const overallBgSectionRef = useRef(null);
  const [logoTeamId, setLogoTeamId] = useState(null);
  const [activeOverlayTheme, setActiveOverlayTheme] = useState("esports");
  const [overallStandingsBg, setOverallStandingsBg] = useState(null);
  const [overallBgUploadMsg, setOverallBgUploadMsg] = useState("");

  // ── Existing Effects (untouched) ──
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

  // ── New Effects ──
  useEffect(() => {
    const onMatch = (data) => setCurrentMatch(data);
    const onSettings = (data) => {
      setAutoCalculate(Boolean(data.autoCalculate));
      if (data && Object.prototype.hasOwnProperty.call(data, "overallStandingsBg")) {
        setOverallStandingsBg(data.overallStandingsBg || null);
      }
      if (Array.isArray(data?.wwcdCharacterArts)) {
        setWwcdCharacterArts(normalizeWwcdArts(data.wwcdCharacterArts));
      }
    };
    const onChicken = (data) => {
      setChickenDinnerTeam(data);
      setTimeout(() => setChickenDinnerTeam(null), 8000);
    };
    const onHistory = (data) => setMatchHistory(Array.isArray(data) ? data : []);
    const onTournament = (data) => setTournamentStats(Array.isArray(data) ? data : []);

    socket.on("matchUpdated", onMatch);
    socket.on("settingsUpdated", onSettings);
    socket.on("chickenDinner", onChicken);
    socket.on("historyUpdated", onHistory);
    socket.on("tournamentUpdated", onTournament);

    socket.emit("requestMatch");
    socket.emit("requestHistory");
    socket.emit("requestTournament");
    socket.emit("requestSettings");

    return () => {
      socket.off("matchUpdated", onMatch);
      socket.off("settingsUpdated", onSettings);
      socket.off("chickenDinner", onChicken);
      socket.off("historyUpdated", onHistory);
      socket.off("tournamentUpdated", onTournament);
    };
  }, []);

  useEffect(() => {
    const a = wwcdCharacterArts[wwcdSlotSelected];
    setWwcdUrlDraft(a && /^https?:\/\//i.test(a) ? a : "");
  }, [wwcdSlotSelected, wwcdCharacterArts]);

  // ── Existing Handlers (untouched) ──
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
    const res = await fetch(`${API}/teams`, {
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

    const res = await fetch(`${API}/teams/${selectedId}`, {
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
    const res = await fetch(`${API}/teams/${id}`, {
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

  // ── New Handlers ──
  const knockTeam = useCallback(async (teamId, knockCount, fullElimination = false) => {
    const res = await fetch(`${API}/teams/${teamId}/knock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knockCount, fullElimination }),
    });
    if (res.ok) setMessage("Knock updated live.");
  }, []);

  const setAlive = useCallback(async (teamId, alivePlayers) => {
    const res = await fetch(`${API}/teams/${teamId}/alive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alivePlayers }),
    });
    if (res.ok) setMessage("Alive count updated.");
  }, []);

  const startNewMatch = async () => {
    if (!window.confirm("Start a new match? Current match data will be saved to history.")) return;
    const res = await fetch(`${API}/match/new`, { method: "POST" });
    if (res.ok) {
      setMessage("New match started!");
      fetchHistory();
    }
  };

  const endMatch = async () => {
    await fetch(`${API}/match/end`, { method: "POST" });
    setMessage("Match ended.");
  };

  const toggleAutoCalc = async () => {
    await fetch(`${API}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoCalculate: !autoCalculate }),
    });
  };

  const fetchHistory = async () => {
    const res = await fetch(`${API}/matches/history`);
    if (res.ok) setMatchHistory(await res.json());
  };

  const deleteMatch = async (matchId) => {
    if (!window.confirm("Delete this match from history?")) return;
    await fetch(`${API}/matches/${matchId}`, { method: "DELETE" });
    fetchHistory();
  };

  const restoreMatch = async (matchId) => {
    if (!window.confirm("Restore this match? Current data will be replaced.")) return;
    await fetch(`${API}/matches/${matchId}/restore`, { method: "POST" });
    setMessage("Match restored.");
  };

  const uploadLogo = async (teamId, file) => {
    const fd = new FormData();
    fd.append("logo", file);
    const res = await fetch(`${API}/teams/${teamId}/logo`, { method: "POST", body: fd });
    if (res.ok) setMessage("Logo uploaded!");
  };

  const handleLogoClick = (teamId) => {
    setLogoTeamId(teamId);
    logoInputRef.current?.click();
  };

  const handleLogoChange = (e) => {
    if (e.target.files[0] && logoTeamId) {
      uploadLogo(logoTeamId, e.target.files[0]);
      e.target.value = "";
    }
  };

  const handleScreenshotUpload = async (files) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;
    setProcessingScreenshot(true);
    screenshotPreviews.forEach((u) => URL.revokeObjectURL(u));
    setScreenshotPreviews(fileList.map((f) => URL.createObjectURL(f)));
    const fd = new FormData();
    fileList.forEach((f) => fd.append("screenshots", f));
    try {
      const res = await fetch(`${API}/upload/screenshots`, { method: "POST", body: fd });
      const data = await res.json();
      setScreenshotResults(data.ocrResults || []);
      setMessage(data.message || "Screenshots processed.");
    } catch {
      setMessage("Screenshot upload failed.");
      setScreenshotResults([]);
    }
    setProcessingScreenshot(false);
  };

  const applyScreenshotData = async () => {
    if (!screenshotResults?.length) return;
    await fetch(`${API}/apply-screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: screenshotResults }),
    });
    setMessage("Screenshot data applied!");
    setScreenshotResults(null);
    screenshotPreviews.forEach((u) => URL.revokeObjectURL(u));
    setScreenshotPreviews([]);
  };

  const updateScreenshotRow = (idx, field, value) => {
    setScreenshotResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: field === "team" ? value : Number(value) };
      return next;
    });
  };

  const fetchTournament = async () => {
    const res = await fetch(`${API}/tournament/overall`);
    if (res.ok) setTournamentStats(await res.json());
  };

  const openOverlay = (mode = "") => {
    const url = mode ? `/overlay/${mode}` : "/overlay";
    window.open(url, "_blank", "width=1920,height=1080");
  };

  const openThemedOverlay = (mode = "") => {
    const base = mode ? `/overlay/themed/${mode}` : "/overlay/themed";
    window.open(`${base}?theme=${activeOverlayTheme}`, "_blank", "width=1920,height=1080");
  };

  const sendOverlayCommand = async (command) => {
    await fetch(`${API}/overlay/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
  };

  useEffect(() => {
    fetchHistory();
    fetchTournament();
  }, []);

  const stats = {
    total: teams.length,
    alive: teams.filter((t) => t.status === "alive").length,
    knocked: teams.filter((t) => t.status === "knocked").length,
    eliminated: teams.filter((t) => t.status === "eliminated").length,
  };

  const toggleSection = (s) => setExpandedSection(expandedSection === s ? null : s);

  /* ════════════════════════════════════════════
     RENDER — existing UI is fully preserved
     ════════════════════════════════════════════ */
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* ── EXISTING HEADER ── */}
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>HORUS TOURNAMENT CONTROL</div>
            <h1 style={styles.title}>Admin Panel</h1>
            <p style={styles.subtitle}>{message}</p>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <button
              onClick={() => window.open("/overlay/themed", "_blank", "width=1920,height=1080")}
              style={ns.overlayHeaderBtn}
            >
              📊 Open Live Overlay
            </button>
            <div style={styles.statsGrid}>
              <StatCard label="Teams" value={stats.total} accent="#55efc4" />
              <StatCard label="Alive" value={stats.alive} accent="#5CFF72" />
              <StatCard label="Knocked" value={stats.knocked} accent="#FF6B45" />
              <StatCard label="Out" value={stats.eliminated} accent="#A5B4BF" />
            </div>
          </div>
        </header>

        {/* ── EXISTING LAYOUT ── */}
        <div style={styles.layout}>
          <section style={styles.tableCard}>
            <div style={styles.cardHeader}>
              <div>
                <p style={styles.cardLabel}>MATCH STANDINGS</p>
                <h2 style={styles.cardTitle}>Team Control Table</h2>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#6a8a92", lineHeight: 1.4, fontWeight: 600 }}>
                  Teams and match progress are saved on the server and survive restarts. Remove rows only with Delete.
                </p>
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
                        <div
                          style={{
                            ...styles.teamLogo,
                            ...(team.logo
                              ? {
                                  backgroundImage: `url(${API}${team.logo})`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                  color: "transparent",
                                }
                              : {}),
                          }}
                          onClick={() => handleLogoClick(team.id)}
                          title="Click to upload logo"
                        >
                          {team.logo ? "" : team.team.slice(0, 2)}
                        </div>
                        <div>
                          <div style={styles.teamName}>{team.team}</div>
                          <div style={styles.teamSub}>
                            {team.alivePlayers ?? 4} alive
                            {team.positionPoints > 0 && ` · +${team.positionPoints} pos`}
                          </div>
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

              {selectedTeam && (
                <div style={ns.logoSection}>
                  <span style={styles.fieldLabel}>TEAM LOGO</span>
                  <div style={ns.logoRow}>
                    <div
                      style={{
                        ...ns.logoPreview,
                        ...(selectedTeam.logo
                          ? {
                              backgroundImage: `url(${API}${selectedTeam.logo})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              color: "transparent",
                            }
                          : {}),
                      }}
                    >
                      {selectedTeam.logo ? "" : selectedTeam.team.slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <button
                        onClick={() => handleLogoClick(selectedTeam.id)}
                        style={ns.logoUploadBtn}
                      >
                        {selectedTeam.logo ? "Change Logo" : "Upload Logo"}
                      </button>
                      <p style={{ margin: "6px 0 0", color: "#5a7a82", fontSize: 11 }}>
                        PNG, JPG, SVG — appears on overlay
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!selectedTeam && (
                <div style={ns.logoSection}>
                  <span style={styles.fieldLabel}>TEAM LOGOS</span>
                  <p style={{ margin: "8px 0 0", color: "#7EACB3", fontSize: 13, lineHeight: 1.5 }}>
                    Select a team from the table, then upload its logo here. Logos appear instantly on the live overlay.
                  </p>
                </div>
              )}

              <div style={styles.helpCard}>
                <div style={styles.helpTitle}>How to use</div>
                <p style={styles.helpText}>
                  Add new teams, select a row to edit it, and push updates live.
                  Upload team logos to show them on the overlay. Click "Open Live Overlay" to view.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* ════════════════════════════════════════
            NEW SECTIONS — added below existing UI
           ════════════════════════════════════════ */}

        <input type="file" ref={logoInputRef} style={{ display: "none" }} accept="image/*" onChange={handleLogoChange} />
        <input type="file" ref={screenshotInputRef} style={{ display: "none" }} accept="image/*" multiple onChange={(e) => e.target.files.length > 0 && handleScreenshotUpload(e.target.files)} />

        {chickenDinnerTeam && (
          <div style={ns.chickenBanner}>
            <span style={ns.chickenIcon}>🏆</span>
            WINNER WINNER CHICKEN DINNER — {chickenDinnerTeam.team}
            <span style={ns.chickenIcon}>🏆</span>
          </div>
        )}

        {/* ── Match Control Bar ── */}
        <div style={ns.matchBar}>
          <div style={ns.matchInfo}>
            <span style={ns.matchBadge}>MATCH #{currentMatch.number}</span>
            <span style={{ ...ns.matchStatus, color: currentMatch.status === "live" ? "#5CFF72" : "#A5B4BF" }}>
              {currentMatch.status === "live" ? "● LIVE" : "● ENDED"}
            </span>
          </div>
          <div style={ns.matchActions}>
            <label style={ns.autoCalcLabel}>
              <input type="checkbox" checked={autoCalculate} onChange={toggleAutoCalc} style={ns.checkbox} />
              Auto-Calculate Points
            </label>
            <button onClick={endMatch} style={ns.matchBtn}>End Match</button>
            <button onClick={startNewMatch} style={ns.matchBtnPrimary}>New Match</button>
          </div>
        </div>

        {/* ── Section Tabs ── */}
        <div style={ns.tabs}>
          {[
            { key: "match", label: "⚡ Match" },
            { key: "knock", label: "🎯 Knock Control" },
            { key: "screenshot", label: "📸 Screenshot AI" },
            { key: "register", label: "📝 Team Register" },
            { key: "history", label: "📋 History" },
            { key: "overlay", label: "🖥️ Overlay" },
            { key: "tournament", label: "🏆 Tournament" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => toggleSection(s.key)}
              style={{
                ...ns.tab,
                ...(expandedSection === s.key ? ns.tabActive : {}),
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Knock Control Panel ── */}
        {expandedSection === "knock" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <p style={styles.cardLabel}>LIVE KNOCK TRACKING</p>
              <h2 style={styles.cardTitle}>Team Knock Control</h2>
            </div>
            <div style={ns.knockGrid}>
              {teams.map((team) => {
                const alive = team.alivePlayers ?? 4;
                const isOut = team.status === "eliminated";
                return (
                  <div key={team.id} style={{ ...ns.knockRow, opacity: isOut ? 0.4 : 1 }}>
                    <div style={ns.knockTeam}>
                      <div style={{ ...styles.teamLogo, width: 32, height: 32, fontSize: 11, borderRadius: 8, ...(team.logo ? { backgroundImage: `url(${API}${team.logo})`, backgroundSize: "cover", color: "transparent" } : {}) }}>
                        {team.logo ? "" : team.team.slice(0, 2)}
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 15 }}>{team.team}</span>
                    </div>
                    <div style={ns.aliveBars}>
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} style={{ ...ns.aliveBar, background: i < alive ? "#5CFF72" : team.status === "knocked" ? "#FF6B45" : "#3a3f48" }} />
                      ))}
                      <span style={{ color: "#8CB7BE", fontSize: 12, marginLeft: 6 }}>{alive}/4</span>
                    </div>
                    <div style={ns.knockBtns}>
                      <button style={ns.knockBtn} disabled={isOut} onClick={() => setAlive(team.id, 3)} title="1 Knocked">1K</button>
                      <button style={ns.knockBtn} disabled={isOut} onClick={() => setAlive(team.id, 2)} title="2 Knocked">2K</button>
                      <button style={ns.knockBtn} disabled={isOut} onClick={() => setAlive(team.id, 1)} title="3 Knocked">3K</button>
                      <button style={{ ...ns.knockBtn, ...ns.knockBtnDanger }} disabled={isOut} onClick={() => knockTeam(team.id, 4, true)} title="Full Eliminated">OUT</button>
                      {isOut && team.eliminationRank && (
                        <span style={ns.rankBadge}>#{team.eliminationRank}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Match Stats ── */}
        {expandedSection === "match" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <p style={styles.cardLabel}>CURRENT MATCH</p>
              <h2 style={styles.cardTitle}>Match #{currentMatch.number} Standings</h2>
            </div>
            <div style={ns.matchTable}>
              <div style={ns.matchTableHead}>
                <div>#</div><div>Team</div><div>Status</div><div>Alive</div><div>Kills</div><div>Pos. Pts</div><div>Total</div>
              </div>
              {teams.map((t, i) => (
                <div key={t.id} style={{ ...ns.matchTableRow, background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)" }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{i + 1}</div>
                  <div style={{ fontWeight: 800 }}>{t.team}</div>
                  <div><span style={{ color: t.status === "alive" ? "#5CFF72" : t.status === "knocked" ? "#FF6B45" : "#A5B4BF", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>{t.status}</span></div>
                  <div>{t.alivePlayers ?? 4}/4</div>
                  <div style={{ fontWeight: 800 }}>{t.finishes}</div>
                  <div style={{ fontWeight: 800, color: "#F1CF69" }}>{t.positionPoints || 0}</div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: "#55efc4" }}>{t.points}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Screenshot Upload & AI (Multi-file) ── */}
        {expandedSection === "screenshot" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>AI SCREENSHOT DETECTION</p>
                <h2 style={styles.cardTitle}>Upload Match Screenshots</h2>
              </div>
              {screenshotResults && screenshotResults.length > 0 && (
                <button style={ns.matchBtnPrimary} onClick={applyScreenshotData}>Apply All Data</button>
              )}
            </div>

            <div style={ns.screenshotArea}>
              <div
                style={ns.dropZone}
                onClick={() => screenshotInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files.length > 0) handleScreenshotUpload(e.dataTransfer.files);
                }}
              >
                {processingScreenshot ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={ns.spinner} />
                    <p style={{ color: "#8CB7BE", marginTop: 12 }}>Processing screenshots with OCR...</p>
                  </div>
                ) : screenshotPreviews.length > 0 ? (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                    {screenshotPreviews.map((src, i) => (
                      <img key={i} src={src} alt={`Screenshot ${i + 1}`} style={{ ...ns.screenshotImg, maxHeight: 180 }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
                    <p style={{ color: "#8CB7BE", margin: 0, fontWeight: 700 }}>Click or drag multiple screenshots here</p>
                    <p style={{ color: "#5a7a82", fontSize: 12, marginTop: 6 }}>Select multiple files at once — all processed in one click</p>
                  </div>
                )}
              </div>

              {screenshotResults && screenshotResults.length > 0 && (
                <div style={ns.ocrResults}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#ECF8FB" }}>
                    Detected {screenshotResults.length} entries — Edit below, then click "Apply All Data"
                  </h3>
                  <div style={ns.ocrTable}>
                    <div style={{ ...ns.ocrHead, gridTemplateColumns: "60px 1fr 80px 80px 120px" }}>
                      <div>Rank</div><div>Team</div><div>Kills</div><div>Points</div><div>Source</div>
                    </div>
                    {screenshotResults.map((r, i) => (
                      <div key={i} style={{ ...ns.ocrRow, gridTemplateColumns: "60px 1fr 80px 80px 120px" }}>
                        <input style={ns.ocrInput} type="number" value={r.rank} onChange={(e) => updateScreenshotRow(i, "rank", e.target.value)} />
                        <input style={ns.ocrInput} value={r.team} onChange={(e) => updateScreenshotRow(i, "team", e.target.value.toUpperCase())} />
                        <input style={ns.ocrInput} type="number" value={r.finishes} onChange={(e) => updateScreenshotRow(i, "finishes", e.target.value)} />
                        <input style={ns.ocrInput} type="number" value={r.points} onChange={(e) => updateScreenshotRow(i, "points", e.target.value)} />
                        <span style={{ color: "#5a7a82", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.source || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {screenshotResults && screenshotResults.length === 0 && !processingScreenshot && (
                <div style={{ padding: 16, color: "#A5B4BF", textAlign: "center" }}>
                  No data detected. Enter results manually or try clearer screenshots.
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Team Registration ── */}
        {expandedSection === "register" && (
          <TeamRegisterSection teams={teams} API={API} onMessage={setMessage} />
        )}

        {/* ── Match History ── */}
        {expandedSection === "history" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>MATCH ARCHIVE</p>
                <h2 style={styles.cardTitle}>Match History</h2>
              </div>
              <button onClick={fetchHistory} style={ns.matchBtn}>Refresh</button>
            </div>

            {matchHistory.length === 0 ? (
              <div style={{ padding: 24, color: "#8CB7BE", textAlign: "center" }}>No match history yet. Complete a match to see it here.</div>
            ) : (
              <div style={ns.historyList}>
                {matchHistory.map((m) => (
                  <div key={m.id} style={ns.historyCard}>
                    <div style={ns.historyHeader}>
                      <div>
                        <span style={ns.historyBadge}>Match #{m.number}</span>
                        {m.winner && <span style={ns.winnerBadge}>🏆 {m.winner}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={ns.matchBtn} onClick={() => restoreMatch(m.id)}>Restore</button>
                        <button style={{ ...ns.matchBtn, borderColor: "#6B2B3B", color: "#FFDCE2", background: "#3A1620" }} onClick={() => deleteMatch(m.id)}>Delete</button>
                      </div>
                    </div>
                    <div style={ns.historyTeams}>
                      {(m.teams || []).slice(0, 5).map((t, i) => (
                        <span key={i} style={ns.historyTeamChip}>
                          #{i + 1} {t.team} — {t.points}pts
                        </span>
                      ))}
                      {(m.teams || []).length > 5 && (
                        <span style={{ color: "#5a7a82", fontSize: 12 }}>+{m.teams.length - 5} more</span>
                      )}
                    </div>
                    <div style={{ color: "#5a7a82", fontSize: 11, marginTop: 8 }}>
                      {new Date(m.startedAt).toLocaleString()} — {m.endedAt ? new Date(m.endedAt).toLocaleString() : "ongoing"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Overlay Controls ── */}
        {expandedSection === "overlay" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>BROADCAST CONTROLS</p>
                <h2 style={styles.cardTitle}>Overlay & Preview</h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <select
                  value={activeOverlayTheme}
                  onChange={(e) => setActiveOverlayTheme(e.target.value)}
                  style={{ padding: "8px 12px", background: "#1a2a30", color: "#fff", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, fontSize: 13, fontWeight: 700, outline: "none", cursor: "pointer", minWidth: 150 }}
                >
                  {["esports","premiumGold","neon","cyberpunk","minimal","cleanBroadcast","pubgTournament","futuristic","darkGlass","rgbAnimated","compactPro","streamerStyle"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    await fetch(`${API}/overlay/active-theme`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: activeOverlayTheme }) });
                    setMessage("Theme applied live!");
                  }}
                  style={{ ...ns.matchBtnPrimary, padding: "8px 16px", fontSize: 12 }}
                >
                  Save & Apply
                </button>
              </div>
            </div>

            <div style={ns.overlayGrid}>
              <div style={{ ...ns.overlayCard, display: "flex", flexDirection: "column", gap: 12, cursor: "default" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => window.open("/overlay/themed/overall", "_blank", "width=1920,height=1080")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      window.open("/overlay/themed/overall", "_blank", "width=1920,height=1080");
                    }
                  }}
                  style={{ cursor: "pointer", flex: 1 }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Overall Tournament</div>
                  <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Cumulative standings</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSection("tournament");
                    setTimeout(() => overallBgSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
                  }}
                  style={{
                    marginTop: 4,
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.02,
                    borderRadius: 10,
                    border: "1px solid rgba(115,231,190,.35)",
                    background: "rgba(56,189,248,.1)",
                    color: "#73E7BE",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Upload custom PNG for this overlay →
                </button>
              </div>
              <div style={ns.overlayCard} onClick={() => window.open("/overlay/wwcd", "_blank", "width=1920,height=1080")}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🍗</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>WWCD Screen</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Open WWCD overlay window</div>
              </div>
              <div
                style={ns.overlayCard}
                onClick={() => window.open("/overlay/wwcd-four?position=bottom", "_blank", "width=1920,height=1080")}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>📉</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>WWCD 4-squad strip</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>
                  Separate window: only when exactly 4 teams remain
                </div>
              </div>
              <div style={ns.overlayCard} onClick={() => sendOverlayCommand({ type: "toggleFullscreen" })}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🔲</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Fullscreen Toggle</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Toggle overlay fullscreen</div>
              </div>
              <div style={ns.overlayCard} onClick={() => window.open(`/overlay/elimination`, "_blank", "width=1920,height=1080")}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>💀</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Elimination Banner</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Opens in separate window</div>
              </div>
              <div style={ns.overlayCard} onClick={() => window.open("/overlay/themes", "_blank")}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>👁️</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Theme Preview</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Classic overlay themes (visual grid)</div>
              </div>
              <div style={ns.overlayCard} onClick={() => window.open("/overlay/engine-catalog", "_blank")}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎨</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Theme & Design</div>
                <div style={{ color: "#8CB7BE", fontSize: 12, marginTop: 4 }}>Broadcast engine: names, pairs & URLs</div>
              </div>
            </div>

            {/* Broadcast engine — theme & design (admin-visible entry) */}
            <div
              style={{
                marginTop: 16,
                padding: "16px 18px",
                background: "linear-gradient(135deg, rgba(115,231,190,.08) 0%, rgba(56,189,248,.06) 100%)",
                borderRadius: 14,
                border: "1px solid rgba(115,231,190,.22)",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, color: "#73E7BE", marginBottom: 6, letterSpacing: 0.4 }}>Theme & Design</div>
              <p style={{ margin: "0 0 14px", color: "#8CB7BE", fontSize: 12, lineHeight: 1.55, maxWidth: 720 }}>
                Pick a <strong style={{ color: "#C8E8E4" }}>theme name</strong> and <strong style={{ color: "#C8E8E4" }}>design label</strong> with live links.
                Opens the catalog page (not the overlay itself). Use the cards for “theme × design” pairs or scroll the full lists.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => window.open("/overlay/engine-catalog", "_blank")}
                  style={{
                    padding: "10px 18px",
                    background: "linear-gradient(90deg, #0d9488, #14b8a6)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    letterSpacing: 0.3,
                  }}
                >
                  Open theme & design catalog
                </button>
                <button
                  type="button"
                  onClick={() => window.open("/overlay/broadcast-engine?engineTheme=br_esports_pro_v0&engineDesign=dsgn_pro_wave0_000&alive=rounded&anim=subtle", "_blank", "width=1920,height=1080")}
                  style={{
                    padding: "10px 18px",
                    background: "rgba(255,255,255,.06)",
                    color: "#C8E8E4",
                    border: "1px solid rgba(115,231,190,.35)",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Open sample broadcast engine overlay
                </button>
              </div>
            </div>

            {/* Trigger WWCD */}
            <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(255,215,0,.05)", borderRadius: 12, border: "1px solid rgba(255,215,0,.15)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#FFD700" }}>Trigger WWCD Animation</div>
                  <div style={{ color: "#8CB7BE", fontSize: 11, marginTop: 2 }}>Play Winner Winner Chicken Dinner on the WWCD overlay window</div>
                </div>
                <button
                  onClick={async () => {
                    await sendOverlayCommand({ type: "showChickenDinner" });
                    setMessage("WWCD animation triggered!");
                  }}
                  style={{ padding: "8px 18px", background: "linear-gradient(90deg, #FFD700, #FFA500)", color: "#000", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}
                >
                  🍗 Trigger WWCD
                </button>
              </div>
            </div>

            {/* Test Elimination */}
            <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(255,80,80,.05)", borderRadius: 12, border: "1px solid rgba(255,80,80,.15)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#FF8080" }}>Test Elimination Banner</div>
                  <div style={{ color: "#8CB7BE", fontSize: 11, marginTop: 2 }}>Send a test elimination to the elimination overlay window</div>
                </div>
                <button
                  onClick={() => sendOverlayCommand({ type: "testElimination", team: "TEST TEAM", rank: 14, finishes: 3, points: 8 })}
                  style={{ padding: "8px 18px", background: "linear-gradient(90deg, #c0392b, #e74c3c)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}
                >
                  Send Test Elimination
                </button>
              </div>
            </div>

            {/* WWCD Color Customization */}
            <div style={{ marginTop: 14, padding: "16px 18px", background: "rgba(255,215,0,.04)", borderRadius: 12, border: "1px solid rgba(255,215,0,.15)" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#FFD700", marginBottom: 12, letterSpacing: 1 }}>WWCD Animation Colors</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
                {[
                  { key: "primary", label: "Primary", fallback: "#ff4655" },
                  { key: "gold", label: "Gold / Title", fallback: "#FFD700" },
                  { key: "accent", label: "Accent", fallback: "#ff4655" },
                ].map(({ key, label, fallback }) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="color"
                      value={wwcdColors[key] || fallback}
                      onChange={(e) => setWwcdColors((prev) => ({ ...prev, [key]: e.target.value }))}
                      style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", background: "transparent" }}
                    />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#ECF8FB", letterSpacing: 0.5 }}>{label}</div>
                      <div style={{ fontSize: 10, color: "#8CB7BE", fontFamily: "monospace" }}>{wwcdColors[key] || fallback}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={async () => {
                    await fetch(`${API}/overlay/wwcd-colors`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wwcdColors) });
                    setMessage("WWCD colors applied!");
                  }}
                  style={{ padding: "8px 18px", background: "linear-gradient(90deg, #FFD700, #FFA500)", color: "#000", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}
                >
                  Apply WWCD Colors
                </button>
                <button
                  onClick={async () => {
                    const reset = { primary: "", gold: "", accent: "", bg: "" };
                    setWwcdColors(reset);
                    await fetch(`${API}/overlay/wwcd-colors`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reset) });
                    setMessage("WWCD colors reset to theme default!");
                  }}
                  style={{ padding: "8px 18px", background: "rgba(255,255,255,.06)", color: "#8CB7BE", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Reset to Theme Default
                </button>
              </div>
            </div>

            {/* WWCD character card art (4 slots) */}
            <div style={{ marginTop: 14, padding: "16px 18px", background: "rgba(127,180,255,.05)", borderRadius: 12, border: "1px solid rgba(127,180,255,.2)" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#9EC9FF", marginBottom: 8, letterSpacing: 0.5 }}>WWCD character cards</div>
              <p style={{ margin: "0 0 14px", fontSize: 11, color: "#8CB7BE", lineHeight: 1.45 }}>
                Four images for the WWCD team stats overlay (slots match P1–P4 left to right). Upload PNG/WebP here, paste a public <strong style={{ color: "#ccc" }}>image URL</strong> for a browser-loaded asset, or remove to use the default art in{" "}
                <code style={{ color: "#F1CF69" }}>client/public/wwcd/</code>. Saved with app settings. Quick edit on the overlay:{" "}
                <code style={{ color: "#F1CF69" }}>/overlay/wwcd?edit=1</code> (use clean URL in OBSlive).
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
                {[0, 1, 2, 3].map((slot) => {
                  const art = wwcdCharacterArts[slot];
                  const src =
                    art && /^https?:\/\//i.test(art)
                      ? art
                      : art && art.startsWith("/")
                        ? `${API}${art}`
                        : `/wwcd/char-${slot}.png`;
                  return (
                    <div
                      key={slot}
                      style={{
                        borderRadius: 10,
                        border: wwcdSlotSelected === slot ? "2px solid #7EB8FF" : "1px solid rgba(255,255,255,.12)",
                        overflow: "hidden",
                        background: "rgba(0,0,0,.25)",
                      }}
                    >
                      <div style={{ height: 100, display: "grid", placeItems: "center", background: "rgba(255,255,255,.06)" }}>
                        <img src={src} alt="" style={{ maxHeight: 96, maxWidth: "100%", objectFit: "contain" }} />
                      </div>
                      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9EC9FF", textAlign: "center" }}>P{slot + 1}</div>
                        <button
                          type="button"
                          onClick={() => setWwcdSlotSelected(slot)}
                          style={{
                            padding: "6px 8px",
                            fontSize: 10,
                            fontWeight: 800,
                            borderRadius: 6,
                            border: "1px solid rgba(127,180,255,.4)",
                            background: wwcdSlotSelected === slot ? "rgba(127,180,255,.2)" : "rgba(255,255,255,.05)",
                            color: "#C8E0FF",
                            cursor: "pointer",
                          }}
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <input ref={wwcdFileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const fd = new FormData();
                fd.append("file", f);
                const res = await fetch(`${API}/upload/wwcd-character/${wwcdSlotSelected}`, { method: "POST", body: fd });
                if (res.ok) {
                  const data = await res.json().catch(() => ({}));
                  if (Array.isArray(data.wwcdCharacterArts)) setWwcdCharacterArts(normalizeWwcdArts(data.wwcdCharacterArts));
                  setMessage(`WWCD slot ${wwcdSlotSelected + 1} image saved.`);
                } else setMessage("WWCD upload failed.");
              }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#8CB7BE", fontWeight: 700 }}>Editing slot {wwcdSlotSelected + 1}:</span>
                <button
                  type="button"
                  onClick={() => wwcdFileInputRef.current?.click()}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(90deg, #7EB8FF, #5b8cff)", color: "#0a1628", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                >
                  Upload image…
                </button>
                <input
                  type="url"
                  value={wwcdUrlDraft}
                  onChange={(e) => setWwcdUrlDraft(e.target.value)}
                  placeholder="Image URL (https://…)"
                  style={{
                    flex: "1 1 200px",
                    minWidth: 160,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.15)",
                    background: "rgba(0,0,0,.2)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`${API}/overlay/wwcd-characters`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ slot: wwcdSlotSelected, imageUrl: wwcdUrlDraft.trim() || null }),
                    });
                    if (res.ok) {
                      const data = await res.json().catch(() => ({}));
                      if (Array.isArray(data.wwcdCharacterArts)) setWwcdCharacterArts(normalizeWwcdArts(data.wwcdCharacterArts));
                      setMessage(`WWCD slot ${wwcdSlotSelected + 1} URL applied.`);
                    } else setMessage("Invalid URL or missing API.");
                  }}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(115,231,190,.45)", background: "rgba(56,189,248,.1)", color: "#73E7BE", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                >
                  Apply URL
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`${API}/overlay/wwcd-characters`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ slot: wwcdSlotSelected, imageUrl: null }),
                    });
                    if (res.ok) {
                      const data = await res.json().catch(() => ({}));
                      if (Array.isArray(data.wwcdCharacterArts)) setWwcdCharacterArts(normalizeWwcdArts(data.wwcdCharacterArts));
                      setWwcdUrlDraft("");
                      setMessage(`WWCD slot ${wwcdSlotSelected + 1} reset to default art.`);
                    }
                  }}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,120,120,.35)", background: "rgba(180,60,60,.15)", color: "#ffb0b0", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                >
                  Remove image
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,255,255,.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,.06)" }}>
              <p style={{ margin: "0 0 8px", color: "#8CB7BE", fontSize: 13, lineHeight: 1.6 }}>
                <strong style={{ color: "#73E7BE" }}>Backend required:</strong> Overlays need the API + Socket.IO server on port 3001. If anything is blank, confirm <code style={{ color: "#F1CF69" }}>node index.js</code> is running.
              </p>
              <p style={{ margin: "0 0 6px", color: "#8CB7BE", fontSize: 13, lineHeight: 1.6 }}>
                <strong style={{ color: "#73E7BE" }}>Dev (Vite):</strong> Ranking <code style={{ color: "#F1CF69" }}>http://localhost:5173/overlay/themed</code> (add{" "}
                <code style={{ color: "#F1CF69" }}>?alive=battery</code>, <code style={{ color: "#F1CF69" }}>heart</code>, <code style={{ color: "#F1CF69" }}>box</code>, …) · Broadcast engine{" "}
                <code style={{ color: "#F1CF69" }}>http://localhost:5173/overlay/broadcast-engine</code> · Elimination{" "}
                <code style={{ color: "#F1CF69" }}>http://localhost:5173/overlay/elimination</code> · WWCD{" "}
                <code style={{ color: "#F1CF69" }}>http://localhost:5173/overlay/wwcd</code> · WWCD 4-squad{" "}
                <code style={{ color: "#F1CF69" }}>http://localhost:5173/overlay/wwcd-four</code> (
                <code style={{ color: "#F1CF69" }}>?position=bottom</code>, <code style={{ color: "#F1CF69" }}>?debug=1</code>)
              </p>
              <p style={{ margin: 0, color: "#8CB7BE", fontSize: 13, lineHeight: 1.6 }}>
                <strong style={{ color: "#73E7BE" }}>Single port:</strong> Run <code style={{ color: "#F1CF69" }}>npm run start:app</code> from the repo root (builds client + serves UI on 3001). Then swap <code style={{ color: "#F1CF69" }}>5173</code> for{" "}
                <code style={{ color: "#F1CF69" }}>3001</code> in OBS URLs (e.g. <code style={{ color: "#F1CF69" }}>http://127.0.0.1:3001/overlay/broadcast-engine</code>).
              </p>
            </div>
          </section>
        )}

        {/* ── Tournament Overview ── */}
        {expandedSection === "tournament" && (
          <section style={ns.sectionCard}>
            <div style={ns.sectionHeader}>
              <div>
                <p style={styles.cardLabel}>OVERALL STANDINGS</p>
                <h2 style={styles.cardTitle}>Tournament Overview</h2>
              </div>
              <button onClick={fetchTournament} style={ns.matchBtn}>Refresh</button>
            </div>
            <div
              ref={overallBgSectionRef}
              id="overall-standings-bg-upload"
              style={{
                marginBottom: 20,
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid rgba(115,231,190,.28)",
                background: "linear-gradient(135deg, rgba(56,189,248,.08) 0%, rgba(115,231,190,.06) 100%)",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, color: "#73E7BE", marginBottom: 8, letterSpacing: 0.4 }}>
                Overall tournament · custom background PNG
              </div>
              <p style={{ margin: "0 0 12px", color: "#8CB7BE", fontSize: 12, lineHeight: 1.55, maxWidth: 720 }}>
                Upload a <strong style={{ color: "#C8E8E4" }}>1920×1080</strong> (or similar) image. Standings and stats draw on top in a glass panel — see the{" "}
                <strong style={{ color: "#C8E8E4" }}>preview below</strong> and in{" "}
                <button
                  type="button"
                  onClick={() => window.open("/overlay/themed/overall", "_blank", "width=1920,height=1080")}
                  style={{
                    padding: "2px 8px",
                    margin: "0 2px",
                    fontSize: 11,
                    fontWeight: 800,
                    borderRadius: 6,
                    border: "1px solid rgba(241,207,105,.5)",
                    background: "rgba(241,207,105,.12)",
                    color: "#F1CF69",
                    cursor: "pointer",
                    verticalAlign: "baseline",
                  }}
                >
                  Open overlay window
                </button>{" "}
                for OBS/browser. Add <code style={{ color: "#F1CF69" }}>?layout=theme</code> to that URL to hide the image and use the default table-only theme.
              </p>
              {overallBgUploadMsg ? (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6FF3CB" }}>{overallBgUploadMsg}</p>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#ccc", cursor: "pointer" }}>
                  Choose PNG / JPG
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,.svg"
                    style={{ display: "block", marginTop: 6 }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch(`${API}/upload/overall-standings-bg`, { method: "POST", body: fd });
                        const raw = await res.text();
                        let json = {};
                        try {
                          json = raw ? JSON.parse(raw) : {};
                        } catch {
                        /* HTML error page etc. */
                        }
                        if (!res.ok) {
                          const stripped = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
                          const snippet = stripped.slice(0, 180);
                          let msg = json.message || snippet || `HTTP ${res.status}`;
                          if (res.status === 404 || /cannot post/i.test(raw)) {
                            msg = `${msg} — Restart the API (node index.js) on port 3001, or stop duplicate Node processes using that port.`;
                          }
                          setOverallBgUploadMsg(msg);
                          setTimeout(() => setOverallBgUploadMsg(""), 12_000);
                          return;
                        }
                        if (json.path) setOverallStandingsBg(json.path);
                        setOverallBgUploadMsg("Saved — refresh the overall overlay window.");
                        setTimeout(() => setOverallBgUploadMsg(""), 4000);
                      } catch (err) {
                        const net = err instanceof Error ? err.message : "";
                        const hint =
                          net && /fetch|network|failed|load/i.test(net)
                            ? " — Is node index.js running on 3001? (Dev: keep API running while using Vite.)"
                            : "";
                        setOverallBgUploadMsg(`Could not reach server${hint}`);
                        setTimeout(() => setOverallBgUploadMsg(""), 12_000);
                      }
                    }}
                  />
                </label>
                {overallStandingsBg ? (
                  <>
                    <img
                      src={`${API}${overallStandingsBg}?t=1`}
                      alt=""
                      style={{ maxHeight: 72, borderRadius: 8, border: "1px solid rgba(255,255,255,.15)" }}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`${API}/settings`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ overallStandingsBg: null }),
                        });
                        setOverallStandingsBg(null);
                        setOverallBgUploadMsg("Cleared — using default themed layout.");
                        setTimeout(() => setOverallBgUploadMsg(""), 4000);
                      }}
                      style={{
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 8,
                        border: "1px solid rgba(248,113,113,.45)",
                        background: "rgba(0,0,0,.2)",
                        color: "#fca5a5",
                        cursor: "pointer",
                      }}
                    >
                      Remove background
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 700,
                color: overallStandingsBg ? "#73E7BE" : "#5a6d72",
                letterSpacing: 0.03,
              }}
            >
              {overallStandingsBg
                ? "Preview — standings on your background (same layout as the overlay window)."
                : "Standings table — enable a background above to see numbers composited on your image."}
            </p>
            <div
              style={
                overallStandingsBg
                  ? {
                      position: "relative",
                      borderRadius: 16,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,.12)",
                      backgroundColor: "#0a0c10",
                      backgroundImage: `url(${API}${overallStandingsBg}?t=2)`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                    }
                  : {}
              }
            >
              <div
                style={
                  overallStandingsBg
                    ? {
                        padding: 16,
                        background: "rgba(8,10,18,0.86)",
                        backdropFilter: "blur(10px)",
                      }
                    : {}
                }
              >
                <div style={ns.matchTable}>
                  <div style={{ ...ns.matchTableHead, gridTemplateColumns: "50px 1fr 80px 80px 80px 80px 80px" }}>
                    <div>#</div><div>Team</div><div>Matches</div><div>Kills</div><div>Pos Pts</div><div>WWCD</div><div>Total</div>
                  </div>
                  {tournamentStats.map((s, i) => (
                    <div key={i} style={{ ...ns.matchTableRow, gridTemplateColumns: "50px 1fr 80px 80px 80px 80px 80px" }}>
                      <div style={{ fontWeight: 900, fontSize: 18, color: i < 3 ? "#F1CF69" : "#ECF8FB" }}>{i + 1}</div>
                      <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                        {s.logo && <img src={`${API}${s.logo}`} alt="" style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover" }} />}
                        {s.team}
                      </div>
                      <div>{s.matchesPlayed}</div>
                      <div style={{ fontWeight: 800 }}>{s.totalKills}</div>
                      <div style={{ color: "#F1CF69" }}>{s.totalPositionPoints}</div>
                      <div style={{ color: "#FFD700" }}>{s.chickenDinners}</div>
                      <div style={{ fontWeight: 900, fontSize: 18, color: "#55efc4" }}>{s.totalPoints}</div>
                    </div>
                  ))}
                </div>
                {tournamentStats.length > 0 && (
                  <div style={ns.mvpBar}>
                    <div style={ns.mvpCard}>
                      <span style={{ color: "#F1CF69", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>TOP FRAGGER</span>
                      <span style={{ fontWeight: 900, fontSize: 20 }}>
                        {[...tournamentStats].sort((a, b) => b.totalKills - a.totalKills)[0]?.team || "—"}
                      </span>
                      <span style={{ color: "#8CB7BE", fontSize: 13 }}>
                        {[...tournamentStats].sort((a, b) => b.totalKills - a.totalKills)[0]?.totalKills || 0} kills
                      </span>
                    </div>
                    <div style={ns.mvpCard}>
                      <span style={{ color: "#FFD700", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>MOST WWCD</span>
                      <span style={{ fontWeight: 900, fontSize: 20 }}>
                        {[...tournamentStats].sort((a, b) => b.chickenDinners - a.chickenDinners)[0]?.team || "—"}
                      </span>
                      <span style={{ color: "#8CB7BE", fontSize: 13 }}>
                        {[...tournamentStats].sort((a, b) => b.chickenDinners - a.chickenDinners)[0]?.chickenDinners || 0} dinners
                      </span>
                    </div>
                    <div style={ns.mvpCard}>
                      <span style={{ color: "#55efc4", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>LEADER</span>
                      <span style={{ fontWeight: 900, fontSize: 20 }}>{tournamentStats[0]?.team || "—"}</span>
                      <span style={{ color: "#8CB7BE", fontSize: 13 }}>{tournamentStats[0]?.totalPoints || 0} pts</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Existing sub-components ──

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

function TeamRegisterSection({ teams, API, onMessage }) {
  const [regForm, setRegForm] = useState({ team: "", players: ["", "", "", ""] });
  const [regLogo, setRegLogo] = useState(null);
  const regLogoRef = useRef(null);
  const [selectedRegId, setSelectedRegId] = useState(null);
  const [viewingTeam, setViewingTeam] = useState(null);

  const updatePlayer = (idx, val) => {
    setRegForm((prev) => {
      const p = [...prev.players];
      p[idx] = val;
      return { ...prev, players: p };
    });
  };

  const selectTeamForEdit = (t) => {
    setSelectedRegId(t.id);
    setViewingTeam(null);
    setRegForm({
      team: t.team || "",
      players: t.players && t.players.length > 0
        ? [...t.players, ...Array(4).fill("")].slice(0, 4)
        : ["", "", "", ""],
    });
    setRegLogo(null);
    onMessage(`Selected ${t.team} — edit fields and click Register to update.`);
  };

  const clearSelection = () => {
    setSelectedRegId(null);
    setRegForm({ team: "", players: ["", "", "", ""] });
    setRegLogo(null);
  };

  const deleteRegTeam = async (id, name) => {
    if (!confirm(`Delete team ${name}? This cannot be undone.`)) return;
    const res = await fetch(`${API}/teams/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedRegId === id) clearSelection();
      if (viewingTeam?.id === id) setViewingTeam(null);
      onMessage(`${name} deleted.`);
    } else {
      onMessage("Delete failed.");
    }
  };

  const viewTeamDetails = (t) => {
    setViewingTeam(viewingTeam?.id === t.id ? null : t);
  };

  const submitRegistration = async () => {
    const teamName = regForm.team.trim().toUpperCase();
    if (!teamName) return onMessage("Team name is required.");
    const playerNames = regForm.players.filter((p) => p.trim());
    const res = await fetch(`${API}/teams/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: teamName, players: playerNames }),
    });
    const data = await res.json();
    if (res.ok) {
      const teamId = data.team?.id;
      if (regLogo && teamId) {
        const fd = new FormData();
        fd.append("logo", regLogo);
        await fetch(`${API}/teams/${teamId}/logo`, { method: "POST", body: fd });
      }
      onMessage(data.updated ? `Team ${teamName} updated!` : `Team ${teamName} registered!`);
      clearSelection();
    } else {
      onMessage(data.message || "Registration failed.");
    }
  };

  return (
    <section style={ns.sectionCard}>
      <div style={ns.sectionHeader}>
        <div>
          <p style={styles.cardLabel}>TEAM ENTRY FORM</p>
          <h2 style={styles.cardTitle}>Team Registration</h2>
        </div>
        {selectedRegId && (
          <button onClick={clearSelection} style={{ ...ns.matchBtn, borderColor: "#5a7a82", color: "#8CB7BE" }}>
            Clear Selection
          </button>
        )}
      </div>
      <p style={{ color: "#8CB7BE", fontSize: 13, margin: "0 0 18px", lineHeight: 1.6 }}>
        Register teams with their names, logos, and player names. This data is used by the Screenshot AI for accurate matching.
      </p>

      <div style={ns.regGrid}>
        <div style={ns.regLeft}>
          {selectedRegId && (
            <div style={{ marginBottom: 14, padding: "8px 12px", background: "rgba(65,232,184,.08)", border: "1px solid rgba(65,232,184,.2)", borderRadius: 10, color: "#6FF3CB", fontSize: 12, fontWeight: 700 }}>
              Editing: {regForm.team || "—"}
            </div>
          )}

          <Field label="Team Name">
            <input
              style={styles.input}
              value={regForm.team}
              onChange={(e) => setRegForm({ ...regForm, team: e.target.value.toUpperCase() })}
              placeholder="TEAM NAME"
            />
          </Field>

          <div style={{ marginTop: 14 }}>
            <span style={styles.fieldLabel}>PLAYER NAMES</span>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {regForm.players.map((p, i) => (
                <input
                  key={i}
                  style={styles.input}
                  value={p}
                  onChange={(e) => updatePlayer(i, e.target.value)}
                  placeholder={`Player ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <span style={styles.fieldLabel}>TEAM LOGO</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
              <div
                onClick={() => regLogoRef.current?.click()}
                style={{
                  ...ns.logoPreview,
                  width: 64,
                  height: 64,
                  cursor: "pointer",
                  ...(regLogo
                    ? { backgroundImage: `url(${URL.createObjectURL(regLogo)})`, backgroundSize: "cover", backgroundPosition: "center", color: "transparent" }
                    : selectedRegId && teams.find((t) => t.id === selectedRegId)?.logo
                      ? { backgroundImage: `url(${API}${teams.find((t) => t.id === selectedRegId).logo})`, backgroundSize: "cover", backgroundPosition: "center", color: "transparent" }
                      : {}
                  ),
                }}
              >
                {(regLogo || (selectedRegId && teams.find((t) => t.id === selectedRegId)?.logo)) ? "" : "+"}
              </div>
              <div>
                <button onClick={() => regLogoRef.current?.click()} style={ns.logoUploadBtn}>
                  {regLogo ? "Change Logo" : "Upload Logo"}
                </button>
                <p style={{ margin: "4px 0 0", color: "#5a7a82", fontSize: 11 }}>PNG, JPG, SVG</p>
              </div>
              <input type="file" ref={regLogoRef} style={{ display: "none" }} accept="image/*" onChange={(e) => { if (e.target.files[0]) setRegLogo(e.target.files[0]); }} />
            </div>
          </div>

          <button onClick={submitRegistration} style={{ ...ns.matchBtnPrimary, marginTop: 18, padding: "14px 24px", fontSize: 15 }}>
            {selectedRegId ? "Update Team" : "Register Team"}
          </button>
        </div>

        <div style={ns.regRight}>
          <span style={styles.fieldLabel}>REGISTERED TEAMS ({teams.length})</span>
          <div style={{ marginTop: 10, display: "grid", gap: 6, maxHeight: 500, overflowY: "auto" }}>
            {teams.map((t) => {
              const isSelected = selectedRegId === t.id;
              const isViewing = viewingTeam?.id === t.id;
              return (
                <div key={t.id}>
                  <div
                    style={{
                      ...ns.regTeamCard,
                      ...(isSelected ? { border: "1px solid rgba(65,232,184,.35)", background: "rgba(65,232,184,.06)" } : {}),
                    }}
                  >
                    <div style={{ ...styles.teamLogo, width: 32, height: 32, fontSize: 10, borderRadius: 8, ...(t.logo ? { backgroundImage: `url(${API}${t.logo})`, backgroundSize: "cover", color: "transparent" } : {}) }}>
                      {t.logo ? "" : t.team.slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{t.team}</div>
                      <div style={{ color: "#5a7a82", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(t.players && t.players.length > 0) ? t.players.join(", ") : "No players listed"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => viewTeamDetails(t)} style={ns.regActionBtn} title="View details">
                        {isViewing ? "Hide" : "View"}
                      </button>
                      <button onClick={() => selectTeamForEdit(t)} style={{ ...ns.regActionBtn, color: "#6FF3CB", borderColor: "rgba(65,232,184,.25)" }} title="Select to edit">
                        Select
                      </button>
                      <button onClick={() => deleteRegTeam(t.id, t.team)} style={{ ...ns.regActionBtn, color: "#FF8080", borderColor: "rgba(255,80,80,.25)" }} title="Delete team">
                        Delete
                      </button>
                    </div>
                  </div>

                  {isViewing && (
                    <div style={ns.regDetailCard}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                        <div style={{ ...styles.teamLogo, width: 52, height: 52, fontSize: 16, borderRadius: 12, ...(t.logo ? { backgroundImage: `url(${API}${t.logo})`, backgroundSize: "cover", color: "transparent" } : {}) }}>
                          {t.logo ? "" : t.team.slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 20, color: "#ECF8FB" }}>{t.team}</div>
                          <div style={{ fontSize: 11, color: "#5a7a82", marginTop: 2 }}>ID: {t.id} &bull; Status: <span style={{ color: t.status === "alive" ? "#6FF3CB" : t.status === "eliminated" ? "#FF8080" : "#F1CF69" }}>{t.status}</span></div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#75E6BF", letterSpacing: 1.5, marginBottom: 8 }}>PLAYERS</div>
                        {(t.players && t.players.length > 0) ? (
                          <div style={{ display: "grid", gap: 4 }}>
                            {t.players.map((p, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.04)" }}>
                                <div style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg, #1a3a42, #0d2028)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, color: "#75E6BF", flexShrink: 0 }}>
                                  {i + 1}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#ECF8FB" }}>{p}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: "#5a7a82", fontSize: 12, fontStyle: "italic" }}>No players registered</div>
                        )}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div style={ns.regStatBox}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#F1CF69" }}>{t.points ?? 0}</div>
                          <div style={{ fontSize: 9, color: "#5a7a82", fontWeight: 700, letterSpacing: 1 }}>POINTS</div>
                        </div>
                        <div style={ns.regStatBox}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#6FF3CB" }}>{t.finishes ?? 0}</div>
                          <div style={{ fontSize: 9, color: "#5a7a82", fontWeight: 700, letterSpacing: 1 }}>KILLS</div>
                        </div>
                        <div style={ns.regStatBox}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#8CB7BE" }}>{t.alivePlayers ?? 4}</div>
                          <div style={{ fontSize: 9, color: "#5a7a82", fontWeight: 700, letterSpacing: 1 }}>ALIVE</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════
// EXISTING STYLES — preserved exactly as-is
// ══════════════════════════════════════════════

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
    cursor: "pointer",
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
    borderWidth: 1,
    borderStyle: "solid",
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
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#244A53",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  deleteBtn: {
    background: "#3A1620",
    color: "#FFDCE2",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#6B2B3B",
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

// ══════════════════════════════════════════════
// NEW STYLES — for added sections only
// ══════════════════════════════════════════════

const ns = {
  overlayHeaderBtn: {
    background: "linear-gradient(90deg, #41E8B8, #2ED7A7)",
    color: "#031014",
    border: "none",
    borderRadius: 14,
    padding: "14px 22px",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(65,232,184,.2)",
    letterSpacing: 0.5,
    whiteSpace: "nowrap",
  },
  logoSection: {
    padding: "16px 0",
    borderTop: "1px solid rgba(255,255,255,.06)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },
  logoPreview: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: "linear-gradient(135deg, #F1CF69, #8B681E)",
    color: "#081116",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 18,
    flexShrink: 0,
    boxShadow: "0 8px 20px rgba(0,0,0,.25)",
  },
  logoUploadBtn: {
    background: "linear-gradient(180deg, #143039, #10252C)",
    color: "#ECFBFD",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#244B55",
    borderRadius: 12,
    padding: "10px 18px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    width: "100%",
  },
  chickenBanner: {
    marginTop: 20,
    padding: "18px 24px",
    background: "linear-gradient(90deg, #FFD700, #FF8C00)",
    borderRadius: 18,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 900,
    color: "#1a0a00",
    letterSpacing: 1,
    animation: "pulse 1s ease-in-out infinite alternate",
    boxShadow: "0 0 40px rgba(255,215,0,.3)",
  },
  chickenIcon: { fontSize: 28, margin: "0 12px" },
  matchBar: {
    marginTop: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    padding: "16px 22px",
    background: "linear-gradient(180deg, rgba(7,22,27,.97), rgba(5,16,21,.96))",
    borderRadius: 18,
    border: "1px solid rgba(112, 210, 206, .12)",
    boxShadow: "0 14px 34px rgba(0,0,0,.25)",
  },
  matchInfo: { display: "flex", alignItems: "center", gap: 14 },
  matchBadge: {
    background: "rgba(111, 243, 203, .12)",
    border: "1px solid rgba(118, 230, 195, .25)",
    color: "#A4E8D0",
    padding: "8px 16px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 1,
  },
  matchStatus: { fontWeight: 800, fontSize: 14, letterSpacing: 1 },
  matchActions: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  autoCalcLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#8CB7BE",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  checkbox: { accentColor: "#41E8B8", width: 16, height: 16 },
  matchBtn: {
    background: "linear-gradient(180deg, #143039, #10252C)",
    color: "#ECFBFD",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#244B55",
    borderRadius: 12,
    padding: "10px 16px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
  matchBtnPrimary: {
    background: "linear-gradient(90deg, #41E8B8, #2ED7A7)",
    color: "#031014",
    border: "none",
    borderRadius: 12,
    padding: "10px 16px",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(65,232,184,.15)",
  },
  tabs: {
    marginTop: 16,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  tab: {
    background: "rgba(255,255,255,.04)",
    color: "#8CB7BE",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 14,
    padding: "10px 18px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    transition: "all .15s",
  },
  tabActive: {
    background: "rgba(65,232,184,.12)",
    color: "#A4E8D0",
    borderColor: "rgba(65,232,184,.3)",
  },
  sectionCard: {
    marginTop: 16,
    background: "linear-gradient(180deg, rgba(7,22,27,.97), rgba(5,16,21,.96))",
    borderRadius: 24,
    border: "1px solid rgba(112, 210, 206, .12)",
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(0,0,0,.35)",
    padding: 22,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    flexWrap: "wrap",
    gap: 12,
  },
  knockGrid: { display: "grid", gap: 6 },
  knockRow: {
    display: "grid",
    gridTemplateColumns: "180px 160px 1fr",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,.02)",
    border: "1px solid rgba(255,255,255,.04)",
  },
  knockTeam: { display: "flex", alignItems: "center", gap: 10 },
  aliveBars: { display: "flex", alignItems: "center", gap: 4 },
  aliveBar: { width: 8, height: 28, borderRadius: 2 },
  knockBtns: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  knockBtn: {
    background: "#122F36",
    color: "#E9FBFD",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#244A53",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    minWidth: 36,
    textAlign: "center",
  },
  knockBtnDanger: {
    background: "#3A1620",
    color: "#FF6B6B",
    borderColor: "#6B2B3B",
  },
  rankBadge: {
    background: "rgba(241,207,105,.15)",
    color: "#F1CF69",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  matchTable: {
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.06)",
  },
  matchTableHead: {
    display: "grid",
    gridTemplateColumns: "50px 1fr 80px 60px 60px 70px 70px",
    padding: "12px 16px",
    background: "rgba(255,255,255,.04)",
    color: "#7FAFB8",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  matchTableRow: {
    display: "grid",
    gridTemplateColumns: "50px 1fr 80px 60px 60px 70px 70px",
    padding: "10px 16px",
    alignItems: "center",
    borderTop: "1px solid rgba(255,255,255,.04)",
    fontSize: 13,
  },
  screenshotArea: { display: "grid", gap: 16 },
  dropZone: {
    border: "2px dashed rgba(112, 210, 206, .25)",
    borderRadius: 18,
    padding: 40,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    minHeight: 160,
    transition: "border-color .2s",
    background: "rgba(255,255,255,.02)",
  },
  screenshotImg: {
    maxWidth: "100%",
    maxHeight: 300,
    borderRadius: 12,
    objectFit: "contain",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid rgba(255,255,255,.1)",
    borderTop: "3px solid #41E8B8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto",
  },
  ocrResults: { padding: 16, background: "rgba(255,255,255,.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,.06)" },
  ocrTable: { borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,.06)" },
  ocrHead: {
    display: "grid",
    gridTemplateColumns: "60px 1fr 80px 80px",
    padding: "10px 12px",
    background: "rgba(255,255,255,.04)",
    color: "#7FAFB8",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  ocrRow: {
    display: "grid",
    gridTemplateColumns: "60px 1fr 80px 80px",
    gap: 6,
    padding: "6px 12px",
    borderTop: "1px solid rgba(255,255,255,.04)",
  },
  ocrInput: {
    background: "rgba(13,29,34,1)",
    color: "#F2FEFF",
    border: "1px solid #1E3A43",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  historyList: { display: "grid", gap: 10 },
  historyCard: {
    padding: 16,
    borderRadius: 14,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.06)",
  },
  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  historyBadge: {
    background: "rgba(111, 243, 203, .1)",
    color: "#A4E8D0",
    padding: "5px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
  },
  winnerBadge: {
    marginLeft: 8,
    background: "rgba(255,215,0,.12)",
    color: "#FFD700",
    padding: "5px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
  },
  historyTeams: { display: "flex", flexWrap: "wrap", gap: 6 },
  historyTeamChip: {
    background: "rgba(255,255,255,.05)",
    padding: "4px 10px",
    borderRadius: 8,
    fontSize: 12,
    color: "#9EC1C7",
    fontWeight: 700,
  },
  overlayGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 12,
  },
  overlayCard: {
    padding: 22,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    cursor: "pointer",
    textAlign: "center",
    transition: "all .15s",
  },
  mvpBar: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 12,
  },
  mvpCard: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 18,
    borderRadius: 18,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    textAlign: "center",
  },
  regGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
    alignItems: "start",
  },
  regLeft: {},
  regRight: {},
  regTeamCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.05)",
  },
  regActionBtn: {
    background: "rgba(255,255,255,.04)",
    color: "#8CB7BE",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: 0.3,
  },
  regDetailCard: {
    margin: "4px 0 6px",
    padding: 16,
    borderRadius: 12,
    background: "linear-gradient(180deg, rgba(14,34,40,.95), rgba(8,22,28,.95))",
    border: "1px solid rgba(65,232,184,.12)",
  },
  regStatBox: {
    textAlign: "center",
    padding: "8px 6px",
    borderRadius: 8,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.04)",
  },
};
