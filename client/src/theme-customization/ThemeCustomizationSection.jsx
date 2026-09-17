import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectSocket, getApiBase, getOverlayPageOrigin } from "../apiOrigin";

const API = getApiBase();
const socket = connectSocket();

const FAMILY_OPTS = [
  { value: "classic", label: "Classic panel" },
  { value: "broadcast", label: "Broadcast FIN + TOTAL" },
  { value: "minimal", label: "Minimal" },
];

async function readError(res) {
  try {
    const data = await res.json();
    if (data?.error) return String(data.error);
    if (data?.message) return String(data.message);
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

function ColorField({ label, value, onChange }) {
  return (
    <label style={ui.colorField}>
      <span style={ui.fieldLabel}>{label}</span>
      <div style={ui.colorRow}>
        <input type="color" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value)} style={ui.colorInput} />
        <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} style={ui.input} />
      </div>
    </label>
  );
}

export default function ThemeCustomizationSection() {
  const [themes, setThemes] = useState([]);
  const [activeTheme, setActiveTheme] = useState("esports");
  const [layoutFamily, setLayoutFamily] = useState("classic");
  const [themeName, setThemeName] = useState("Custom Theme");
  const [sourceImage, setSourceImage] = useState("");
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const previewKey = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/theme-customization`);
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setThemes(Array.isArray(data.themes) ? data.themes : []);
      if (data.activeTheme) setActiveTheme(data.activeTheme);
    } catch (e) {
      setError(e.message || "Could not load themes.");
    }
  }, []);

  useEffect(() => {
    load();
    const onSettings = (s) => {
      if (s?.activeTheme) setActiveTheme(s.activeTheme);
    };
    socket.on("settingsUpdated", onSettings);
    socket.on("activeThemeChanged", onSettings);
    return () => {
      socket.off("settingsUpdated", onSettings);
      socket.off("activeThemeChanged", onSettings);
    };
  }, [load]);

  const previewUrl = useMemo(() => {
    const origin = getOverlayPageOrigin() || (typeof window !== "undefined" ? window.location.origin : "");
    const id = draft?.id;
    if (!id) return "";
    return `${origin}/overlay/themed?theme=${encodeURIComponent(id)}&live=1&_=${previewKey.current}`;
  }, [draft?.id]);

  const imagePreviewUrl = useMemo(() => {
    if (!sourceImage) return "";
    if (sourceImage.startsWith("http")) return sourceImage;
    const origin = getOverlayPageOrigin() || (typeof window !== "undefined" ? window.location.origin : "");
    return `${origin}${sourceImage}`;
  }, [sourceImage]);

  const bumpPreview = () => {
    previewKey.current += 1;
    setDraft((d) => (d ? { ...d } : d));
  };

  const run = async (fn) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e.message || "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const onUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a PNG, JPG, or WebP screenshot first.");
      return;
    }
    void run(async () => {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`${API}/theme-customization/upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setSourceImage(data.sourceImage || "");
      setMessage("Reference image uploaded.");
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const onAnalyze = () => {
    if (!sourceImage) {
      setError("Upload a reference image first.");
      return;
    }
    void run(async () => {
      const res = await fetch(`${API}/theme-customization/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImage,
          layoutFamily,
          name: themeName,
          id: draft?.id,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setDraft(data.theme);
      setThemes((prev) => {
        const next = prev.filter((t) => t.id !== data.theme.id);
        return [data.theme, ...next];
      });
      setMessage(data.message || "Theme analyzed.");
      bumpPreview();
    });
  };

  const patchDraftColors = (patch) => {
    setDraft((prev) => {
      if (!prev?.theme) return prev;
      const nextTheme = {
        ...prev.theme,
        colors: { ...prev.theme.colors, ...patch.colors },
        alive: patch.alive ? { ...prev.theme.alive, ...patch.alive } : prev.theme.alive,
        row: patch.row ? { ...prev.theme.row, ...patch.row } : prev.theme.row,
      };
      return { ...prev, theme: nextTheme };
    });
  };

  const onSave = () => {
    if (!draft?.theme) {
      setError("Analyze or select a theme first.");
      return;
    }
    void run(async () => {
      const res = await fetch(`${API}/theme-customization/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          name: themeName,
          layoutFamily,
          sourceImage,
          theme: draft.theme,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setDraft(data.theme);
      await load();
      setMessage("Theme saved.");
      bumpPreview();
    });
  };

  const onApply = () => {
    if (!draft?.theme) {
      setError("No theme to apply.");
      return;
    }
    void run(async () => {
      const saveRes = await fetch(`${API}/theme-customization/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          name: themeName,
          layoutFamily,
          sourceImage,
          theme: draft.theme,
        }),
      });
      if (!saveRes.ok) throw new Error(await readError(saveRes));
      const saved = await saveRes.json();
      const id = saved.theme?.id || draft.id;
      const res = await fetch(`${API}/theme-customization/${id}/apply`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setDraft(saved.theme);
      setActiveTheme(data.activeTheme || id);
      await load();
      setMessage("Theme saved and applied to /overlay/themed.");
      bumpPreview();
    });
  };

  const onApplySaved = (entry) => {
    void run(async () => {
      const res = await fetch(`${API}/theme-customization/${entry.id}/apply`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setActiveTheme(data.activeTheme || entry.id);
      setDraft(entry);
      setThemeName(entry.name);
      setLayoutFamily(entry.layoutFamily || "classic");
      setSourceImage(entry.sourceImage || "");
      setMessage(`Applied "${entry.name}".`);
      bumpPreview();
    });
  };

  const onDelete = (entry) => {
    if (!window.confirm(`Delete theme "${entry.name}"?`)) return;
    void run(async () => {
      const res = await fetch(`${API}/theme-customization/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      if (draft?.id === entry.id) setDraft(null);
      await load();
      setMessage("Theme deleted.");
    });
  };

  const onRename = (entry) => {
    const name = window.prompt("Theme name", entry.name);
    if (!name || name === entry.name) return;
    void run(async () => {
      const res = await fetch(`${API}/theme-customization/${entry.id}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await readError(res));
      await load();
      if (draft?.id === entry.id) {
        setThemeName(name);
        setDraft((d) => (d ? { ...d, name, theme: { ...d.theme, name } } : d));
      }
      setMessage("Theme renamed.");
    });
  };

  const selectDraft = (entry) => {
    setDraft(entry);
    setThemeName(entry.name || "Custom Theme");
    setLayoutFamily(entry.layoutFamily || "classic");
    setSourceImage(entry.sourceImage || "");
    bumpPreview();
  };

  const colors = draft?.theme?.colors || {};
  const alive = draft?.theme?.alive || {};

  return (
    <section style={ui.wrap}>
      <div style={ui.header}>
        <div>
          <p style={ui.kicker}>VISUAL LAYER ONLY</p>
          <h2 style={ui.title}>Theme Customization</h2>
          <p style={ui.sub}>
            Upload a ranking screenshot as a design reference. Colors and spacing are extracted locally — team names and
            scores always come from live ranking data.
          </p>
        </div>
        <div style={ui.activePill}>
          Active overlay theme: <strong>{activeTheme}</strong>
        </div>
      </div>

      {message ? <div style={ui.ok}>{message}</div> : null}
      {error ? <div style={ui.err}>{error}</div> : null}

      <div style={ui.grid}>
        <div style={ui.card}>
          <h3 style={ui.cardTitle}>1. Layout family</h3>
          <div style={ui.familyRow}>
            {FAMILY_OPTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={busy}
                style={{
                  ...ui.familyBtn,
                  ...(layoutFamily === opt.value ? ui.familyBtnActive : {}),
                }}
                onClick={() => setLayoutFamily(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <h3 style={ui.cardTitle}>2. Reference image</h3>
          <label style={ui.fieldLabel}>Theme name</label>
          <input style={ui.input} value={themeName} onChange={(e) => setThemeName(e.target.value)} />

          <div style={ui.uploadRow}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={ui.fileInput} />
            <button type="button" style={ui.btn} disabled={busy} onClick={onUpload}>
              Upload screenshot
            </button>
          </div>

          {imagePreviewUrl ? (
            <img src={imagePreviewUrl} alt="Reference" style={ui.refImg} />
          ) : (
            <div style={ui.refPlaceholder}>No reference image yet</div>
          )}

          <div style={ui.actionRow}>
            <button type="button" style={ui.btnPrimary} disabled={busy} onClick={onAnalyze}>
              Analyze theme
            </button>
            <button type="button" style={ui.btn} disabled={busy || !draft} onClick={onAnalyze}>
              Regenerate
            </button>
          </div>
        </div>

        <div style={ui.card}>
          <h3 style={ui.cardTitle}>3. Color tweaks</h3>
          {draft?.theme ? (
            <>
              <ColorField
                label="Background"
                value={colors.secondary}
                onChange={(v) => patchDraftColors({ colors: { secondary: v } })}
              />
              <ColorField
                label="Accent"
                value={colors.accent}
                onChange={(v) => patchDraftColors({ colors: { accent: v, primary: v } })}
              />
              <ColorField label="Text" value={colors.text} onChange={(v) => patchDraftColors({ colors: { text: v } })} />
              <ColorField label="Gold / rank" value={colors.gold} onChange={(v) => patchDraftColors({ colors: { gold: v } })} />
              <ColorField
                label="Alive"
                value={alive.color}
                onChange={(v) => patchDraftColors({ alive: { color: v } })}
              />
              <ColorField
                label="Dead"
                value={alive.deadColor}
                onChange={(v) => patchDraftColors({ alive: { deadColor: v } })}
              />
              <div style={ui.actionRow}>
                <button type="button" style={ui.btn} disabled={busy} onClick={onSave}>
                  Save theme
                </button>
                <button type="button" style={ui.btnPrimary} disabled={busy} onClick={onApply}>
                  Apply to overlay
                </button>
              </div>
            </>
          ) : (
            <p style={ui.hint}>Analyze an image to edit colors and apply.</p>
          )}
        </div>
      </div>

      <div style={ui.previewCard}>
        <h3 style={ui.cardTitle}>4. Live preview (real ranking data)</h3>
        {previewUrl ? (
          <iframe title="Theme preview" src={previewUrl} style={ui.iframe} />
        ) : (
          <div style={ui.refPlaceholder}>Preview appears after analyze</div>
        )}
      </div>

      <div style={ui.card}>
        <h3 style={ui.cardTitle}>My themes</h3>
        {themes.length === 0 ? (
          <p style={ui.hint}>No saved custom themes yet.</p>
        ) : (
          <div style={ui.themeList}>
            {themes.map((entry) => (
              <div key={entry.id} style={ui.themeRow}>
                <div>
                  <div style={ui.themeName}>{entry.name}</div>
                  <div style={ui.themeMeta}>
                    {entry.id} · {entry.layoutFamily || "classic"}
                    {activeTheme === entry.id ? " · ACTIVE" : ""}
                  </div>
                </div>
                <div style={ui.themeActions}>
                  <button type="button" style={ui.btnTiny} disabled={busy} onClick={() => selectDraft(entry)}>
                    Preview
                  </button>
                  <button type="button" style={ui.btnTiny} disabled={busy} onClick={() => onApplySaved(entry)}>
                    Apply
                  </button>
                  <button type="button" style={ui.btnTiny} disabled={busy} onClick={() => onRename(entry)}>
                    Rename
                  </button>
                  <button type="button" style={ui.btnDangerTiny} disabled={busy} onClick={() => onDelete(entry)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const ui = {
  wrap: { display: "flex", flexDirection: "column", gap: 16 },
  header: { display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" },
  kicker: { margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "#6b8490" },
  title: { margin: "4px 0 8px", fontSize: 24, fontWeight: 900, color: "#fff" },
  sub: { margin: 0, maxWidth: 720, color: "#8891a1", lineHeight: 1.5, fontSize: 14 },
  activePill: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    color: "#c8d0dc",
    fontSize: 13,
    fontWeight: 700,
  },
  ok: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(34,197,94,.12)",
    border: "1px solid rgba(34,197,94,.35)",
    color: "#bbf7d0",
    fontWeight: 700,
  },
  err: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(239,68,68,.12)",
    border: "1px solid rgba(239,68,68,.35)",
    color: "#fecaca",
    fontWeight: 700,
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 },
  card: {
    background: "#12151c",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.06)",
    padding: 18,
  },
  previewCard: {
    background: "#12151c",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.06)",
    padding: 18,
  },
  cardTitle: { margin: "0 0 12px", fontSize: 16, fontWeight: 900, color: "#fff" },
  familyRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  familyBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.03)",
    color: "#e8edf4",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },
  familyBtnActive: {
    border: "1px solid rgba(230,57,70,.55)",
    background: "rgba(230,57,70,.15)",
    color: "#fff",
  },
  fieldLabel: { display: "block", fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: "#8891a1", textTransform: "uppercase", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.12)",
    background: "#0d0f14",
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
    marginBottom: 12,
  },
  uploadRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 },
  fileInput: { flex: 1, minWidth: 180, color: "#c8d0dc" },
  refImg: { width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 10, background: "#0d0f14", marginBottom: 12 },
  refPlaceholder: {
    minHeight: 120,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    background: "#0d0f14",
    color: "#6b8490",
    fontWeight: 700,
    marginBottom: 12,
  },
  actionRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  btn: {
    padding: "10px 16px",
    fontSize: 12,
    fontWeight: 800,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "#e8edf4",
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "10px 16px",
    fontSize: 12,
    fontWeight: 800,
    borderRadius: 10,
    border: "1px solid rgba(230,57,70,.5)",
    background: "linear-gradient(160deg,#e63946,#b91c1c)",
    color: "#fff",
    cursor: "pointer",
  },
  colorField: { display: "block", marginBottom: 10 },
  colorRow: { display: "flex", gap: 8, alignItems: "center" },
  colorInput: { width: 44, height: 36, border: "none", background: "transparent", cursor: "pointer" },
  hint: { color: "#8891a1", fontWeight: 600, margin: 0 },
  iframe: {
    width: "100%",
    minHeight: 520,
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 12,
    background: "transparent",
  },
  themeList: { display: "flex", flexDirection: "column", gap: 8 },
  themeRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    padding: "12px 14px",
    borderRadius: 10,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.06)",
  },
  themeName: { fontWeight: 900, color: "#fff", fontSize: 14 },
  themeMeta: { fontSize: 11, color: "#8891a1", fontWeight: 700, marginTop: 4 },
  themeActions: { display: "flex", gap: 6, flexWrap: "wrap" },
  btnTiny: {
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "#e8edf4",
    cursor: "pointer",
  },
  btnDangerTiny: {
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    borderRadius: 8,
    border: "1px solid rgba(248,113,113,.4)",
    background: "rgba(180,70,85,.18)",
    color: "#fecaca",
    cursor: "pointer",
  },
};
