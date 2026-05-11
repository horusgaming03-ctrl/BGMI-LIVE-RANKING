import { useEffect, useRef, useState } from "react";
import { getApiBase } from "./apiOrigin";

const API = getApiBase();

export default function TeamRegister() {
  const [form, setForm] = useState({ team: "", players: ["", "", "", ""] });
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [message, setMessage] = useState(null);
  const [teams, setTeams] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const logoRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/teams`).then((r) => r.json()).then((d) => setTeams(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const updatePlayer = (idx, val) => {
    setForm((prev) => {
      const p = [...prev.players];
      p[idx] = val;
      return { ...prev, players: p };
    });
  };

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogo(file);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const submit = async () => {
    const teamName = form.team.trim().toUpperCase();
    if (!teamName) return setMessage({ type: "error", text: "Team name is required." });
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/teams/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: teamName, players: form.players.filter((p) => p.trim()) }),
      });
      const data = await res.json();
      if (res.ok) {
        const teamId = data.team?.id;
        if (logo && teamId) {
          const fd = new FormData();
          fd.append("logo", logo);
          await fetch(`${API}/teams/${teamId}/logo`, { method: "POST", body: fd });
        }
        setMessage({ type: "success", text: data.updated ? `Team ${teamName} updated successfully!` : `Team ${teamName} registered successfully!` });
        setForm({ team: "", players: ["", "", "", ""] });
        setLogo(null);
        if (logoPreview) URL.revokeObjectURL(logoPreview);
        setLogoPreview(null);
        const r2 = await fetch(`${API}/teams`);
        setTeams(await r2.json());
      } else {
        setMessage({ type: "error", text: data.message || "Registration failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    }
    setSubmitting(false);
  };

  const selectTeam = (t) => {
    setSelectedId(t.id);
    setForm({
      team: t.team || "",
      players: t.players && t.players.length > 0
        ? [...t.players, ...Array(4).fill("")].slice(0, 4)
        : ["", "", "", ""],
    });
    if (t.logo) {
      setLogoPreview(`${API}${t.logo}`);
      setLogo(null);
    }
    setMessage({ type: "success", text: `Selected ${t.team} — edit and re-register to update.` });
  };

  const deleteTeam = async (id, name) => {
    if (!confirm(`Delete team ${name}?`)) return;
    try {
      const res = await fetch(`${API}/teams/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTeams((prev) => prev.filter((t) => t.id !== id));
        if (selectedId === id) {
          setSelectedId(null);
          setForm({ team: "", players: ["", "", "", ""] });
          setLogo(null);
          setLogoPreview(null);
        }
        setMessage({ type: "success", text: `${name} deleted.` });
      } else {
        setMessage({ type: "error", text: "Delete failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    }
  };

  return (
    <div style={st.page}>
      <div style={st.container}>
        <div style={st.header}>
          <div style={st.eyebrow}>BGMI TOURNAMENT</div>
          <h1 style={st.title}>Team Registration</h1>
          <p style={st.subtitle}>Fill in your team details below to register for the tournament.</p>
        </div>

        {message && (
          <div style={{ ...st.msgBanner, background: message.type === "success" ? "rgba(65,232,184,.12)" : "rgba(255,80,80,.12)", borderColor: message.type === "success" ? "rgba(65,232,184,.3)" : "rgba(255,80,80,.3)", color: message.type === "success" ? "#6FF3CB" : "#FF8080" }}>
            {message.text}
          </div>
        )}

        <div style={st.grid}>
          <div style={st.formCard}>
            <div style={st.sectionLabel}>TEAM INFORMATION</div>

            <label style={st.field}>
              <span style={st.fieldLabel}>TEAM NAME *</span>
              <input style={st.input} value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value.toUpperCase() })} placeholder="ENTER TEAM NAME" />
            </label>

            <div style={{ marginTop: 20 }}>
              <span style={st.fieldLabel}>TEAM LOGO</span>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
                <div
                  onClick={() => logoRef.current?.click()}
                  style={{
                    ...st.logoBox,
                    ...(logoPreview ? { backgroundImage: `url(${logoPreview})`, backgroundSize: "cover", backgroundPosition: "center", color: "transparent" } : {}),
                  }}
                >
                  {logoPreview ? "" : "+"}
                </div>
                <div style={{ flex: 1 }}>
                  <button onClick={() => logoRef.current?.click()} style={st.uploadBtn}>
                    {logo ? "Change Logo" : "Upload Logo"}
                  </button>
                  <p style={{ margin: "6px 0 0", color: "#5a7a82", fontSize: 12 }}>PNG, JPG, SVG — max 5MB</p>
                </div>
                <input type="file" ref={logoRef} style={{ display: "none" }} accept="image/*" onChange={handleLogo} />
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <span style={st.fieldLabel}>PLAYER NAMES</span>
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {form.players.map((p, i) => (
                  <input key={i} style={st.input} value={p} onChange={(e) => updatePlayer(i, e.target.value)} placeholder={`Player ${i + 1} name`} />
                ))}
              </div>
            </div>

            <button onClick={submit} disabled={submitting} style={{ ...st.submitBtn, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Registering..." : "Register Team"}
            </button>
          </div>

          <div style={st.teamsCard}>
            <div style={st.sectionLabel}>REGISTERED TEAMS ({teams.length})</div>
            <div style={{ display: "grid", gap: 8, marginTop: 14, maxHeight: 600, overflowY: "auto" }}>
              {teams.length === 0 ? (
                <p style={{ color: "#5a7a82", fontSize: 14 }}>No teams registered yet. Be the first!</p>
              ) : (
                teams.map((t) => (
                  <div key={t.id} style={{ ...st.teamRow, ...(selectedId === t.id ? { border: "1px solid rgba(65,232,184,.35)", background: "rgba(65,232,184,.06)" } : {}) }}>
                    <div style={{ ...st.teamLogo, ...(t.logo ? { backgroundImage: `url(${API}${t.logo})`, backgroundSize: "cover", backgroundPosition: "center", color: "transparent" } : {}) }}>
                      {t.logo ? "" : (t.team || "").slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{t.team}</div>
                      <div style={{ color: "#5a7a82", fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(t.players && t.players.length > 0) ? t.players.join(" • ") : "No players listed"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => selectTeam(t)} style={st.selectBtn} title="Select to edit">
                        Select
                      </button>
                      <button onClick={() => deleteTeam(t.id, t.team)} style={st.deleteBtn} title="Delete team">
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const st = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, #103740 0%, #071116 50%, #040b10 100%)",
    color: "#ECF8FB",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: 24,
  },
  container: { maxWidth: 1100, margin: "0 auto" },
  header: { marginBottom: 28, textAlign: "center" },
  eyebrow: { color: "#6FF3CB", fontSize: 12, letterSpacing: 2, fontWeight: 800, marginBottom: 8 },
  title: { margin: 0, fontSize: 42, lineHeight: 1, fontWeight: 900 },
  subtitle: { margin: "12px 0 0", color: "#9EC1C7", fontSize: 15 },
  msgBanner: {
    padding: "14px 20px",
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "solid",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 20,
    textAlign: "center",
  },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" },
  formCard: {
    background: "linear-gradient(180deg, rgba(7,22,27,.97), rgba(5,16,21,.96))",
    borderRadius: 24,
    border: "1px solid rgba(112,210,206,.12)",
    padding: 28,
    boxShadow: "0 24px 60px rgba(0,0,0,.35)",
  },
  teamsCard: {
    background: "linear-gradient(180deg, rgba(7,22,27,.97), rgba(5,16,21,.96))",
    borderRadius: 24,
    border: "1px solid rgba(112,210,206,.12)",
    padding: 28,
    boxShadow: "0 24px 60px rgba(0,0,0,.35)",
  },
  sectionLabel: { color: "#75E6BF", fontSize: 12, fontWeight: 800, letterSpacing: 2, marginBottom: 16 },
  field: { display: "grid", gap: 8 },
  fieldLabel: { color: "#8CB7BE", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.3, fontWeight: 800 },
  input: {
    width: "100%",
    background: "linear-gradient(90deg, rgba(13,29,34,1), rgba(10,24,29,1))",
    color: "#F2FEFF",
    border: "1px solid #1E3A43",
    borderRadius: 14,
    padding: "14px 15px",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    background: "linear-gradient(135deg, #F1CF69, #8B681E)",
    color: "#081116",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 28,
    cursor: "pointer",
    flexShrink: 0,
    boxShadow: "0 8px 20px rgba(0,0,0,.25)",
  },
  uploadBtn: {
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
  submitBtn: {
    marginTop: 24,
    width: "100%",
    background: "linear-gradient(90deg, #41E8B8, #2ED7A7)",
    color: "#031014",
    border: "none",
    borderRadius: 16,
    padding: "16px 24px",
    fontWeight: 900,
    fontSize: 17,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(65,232,184,.2)",
    letterSpacing: 0.5,
  },
  teamRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.05)",
  },
  teamLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "linear-gradient(135deg, #F1CF69, #8B681E)",
    color: "#081116",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 13,
    flexShrink: 0,
  },
  selectBtn: {
    background: "linear-gradient(180deg, #143039, #10252C)",
    color: "#6FF3CB",
    border: "1px solid rgba(65,232,184,.25)",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: 0.3,
  },
  deleteBtn: {
    background: "linear-gradient(180deg, #2a1418, #1e0e12)",
    color: "#FF8080",
    border: "1px solid rgba(255,80,80,.25)",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: 0.3,
  },
};
