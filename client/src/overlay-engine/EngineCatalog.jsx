import { useMemo, useState, memo, useEffect, useCallback } from "react";
import { getEngineTheme, getEngineThemeIds, ENGINE_THEME_COUNT } from "./themes";
import { getDesignCatalog, getEngineDesignCount, getDesign } from "./designs";
import { ALIVE_STYLE_IDS } from "./alive-styles/AliveIndicator";
import { ANIMATION_PACK_IDS } from "./animations/packs";
import { LEGACY_THEME_NAMES, LEGACY_TO_ENGINE } from "./configs/adminThemeBridge";
import { getPresetBundleIds, PRESET_BUNDLE_DEFS } from "./configs/presetBundles";
import { getApiBase } from "../apiOrigin";
import AliveIndicator from "./alive-styles/AliveIndicator";
import { applyDesignToTheme } from "./utils/applyDesign";

const OVERLAY_TARGETS = [
  { path: "/overlay/broadcast-engine", label: "Broadcast engine" },
  { path: "/overlay/themed", label: "Themed match board" },
  { path: "/overlay/themed/overall", label: "Themed overall standings" },
  { path: "/overlay/elimination", label: "Elimination banner" },
  { path: "/overlay/side-banner", label: "Side match banner (logo + match + map)" },
  { path: "/overlay/zone-prediction", label: "Zone prediction cue (admin)" },
  { path: "/overlay/announcements", label: "Live announcements ticker (admin)" },
  { path: "/overlay/finish-badges", label: "Finish / kill badges strip" },
  { path: "/overlay/rondo/finish-badges", label: "Finish badges — Rondo recall package" },
  { path: "/overlay/wwcd", label: "WWCD" },
  { path: "/overlay/wwcd-only", label: "WWCD strip only (4 teams / OBS)" },
  { path: "/overlay/wwcd-4-teams", label: "WWCD 4-squad strip (alias)" },
  { path: "/overlay", label: "Legacy board" },
];

function EngineCatalog() {
  const [q, setQ] = useState("");
  const [aliveQ, setAliveQ] = useState("");
  const [custOpen, setCustOpen] = useState(true);
  const [custPath, setCustPath] = useState("/overlay/broadcast-engine");
  const [custAlive, setCustAlive] = useState("battery");
  const [custAnim, setCustAnim] = useState("subtle");
  const [custTheme, setCustTheme] = useState("br_esports_pro_v0");
  const [custDesign, setCustDesign] = useState("dsgn_pro_wave0_000");
  const [custAliveLayout, setCustAliveLayout] = useState("grid");
  const [custIconAlive, setCustIconAlive] = useState(null);
  const [custIconDead, setCustIconDead] = useState(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");
  const themeIds = useMemo(() => getEngineThemeIds(), []);
  const designs = useMemo(() => getDesignCatalog(), []);

  const themesWithNames = useMemo(
    () =>
      themeIds.map((id) => ({
        id,
        name: getEngineTheme(id).name || id,
      })),
    [themeIds],
  );

  const filteredThemes = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return themesWithNames;
    return themesWithNames.filter(
      (t) => t.id.toLowerCase().includes(s) || t.name.toLowerCase().includes(s),
    );
  }, [themesWithNames, q]);

  const filteredDesigns = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return designs;
    return designs.filter((d) => d.id.toLowerCase().includes(s) || d.label.toLowerCase().includes(s));
  }, [designs, q]);

  const themeDesignCombos = useMemo(() => {
    const n = Math.min(32, themeIds.length, designs.length);
    if (n === 0) return [];
    const stepT = Math.max(1, Math.floor(themeIds.length / n));
    const stepD = Math.max(1, Math.floor(designs.length / n));
    const s = q.trim().toLowerCase();
    const rows = [];
    for (let i = 0; i < n; i++) {
      const tid = themeIds[(i * stepT) % themeIds.length];
      const d = designs[(i * stepD) % designs.length];
      const themeName = getEngineTheme(tid).name || tid;
      rows.push({
        themeId: tid,
        themeName,
        designId: d.id,
        designLabel: d.label,
      });
    }
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.themeId.toLowerCase().includes(s) ||
        r.themeName.toLowerCase().includes(s) ||
        r.designId.toLowerCase().includes(s) ||
        r.designLabel.toLowerCase().includes(s),
    );
  }, [themeIds, designs, q]);

  const filteredBundles = useMemo(() => {
    const ids = getPresetBundleIds();
    const s = q.trim().toLowerCase();
    if (!s) return ids;
    return ids.filter((id) => id.toLowerCase().includes(s) || PRESET_BUNDLE_DEFS[id]?.label?.toLowerCase().includes(s));
  }, [q]);

  useEffect(() => {
    const api = getApiBase();
    fetch(`${api}/settings`)
      .then((r) => r.json())
      .then((s) => {
        const ep = s?.engineOverlayPrefs;
        const tp = s?.themedOverlayPrefs;
        if (ep && typeof ep === "object") {
          if (typeof ep.overlayPath === "string") setCustPath(ep.overlayPath);
          if (typeof ep.animationPack === "string") setCustAnim(ep.animationPack);
          if (typeof ep.engineTheme === "string") setCustTheme(ep.engineTheme);
          if (typeof ep.engineDesign === "string") setCustDesign(ep.engineDesign);
        }
        if (tp && typeof tp === "object") {
          if (typeof tp.aliveStyle === "string") setCustAlive(tp.aliveStyle);
          if (tp.aliveLayout === "line" || tp.aliveLayout === "grid") setCustAliveLayout(tp.aliveLayout);
          setCustIconAlive(typeof tp.aliveCustomAlive === "string" ? tp.aliveCustomAlive : null);
          setCustIconDead(typeof tp.aliveCustomDead === "string" ? tp.aliveCustomDead : null);
        } else if (ep && typeof ep === "object") {
          if (typeof ep.aliveStyle === "string") setCustAlive(ep.aliveStyle);
          if (ep.aliveLayout === "line" || ep.aliveLayout === "grid") setCustAliveLayout(ep.aliveLayout);
          if (typeof ep.aliveCustomAlive === "string") setCustIconAlive(ep.aliveCustomAlive);
          if (typeof ep.aliveCustomDead === "string") setCustIconDead(ep.aliveCustomDead);
        }
      })
      .catch(() => {});
  }, []);

  const previewThemeMerged = useMemo(() => {
    const tid = themeIds.includes(custTheme) ? custTheme : themeIds[0];
    const base = getEngineTheme(tid);
    const design = getDesign(custDesign);
    return applyDesignToTheme(base, design);
  }, [custTheme, custDesign, themeIds]);

  const buildCustomUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    if (custPath.includes("broadcast-engine")) {
      const qs = new URLSearchParams({
        engineTheme: custTheme,
        engineDesign: custDesign,
        alive: custAlive,
        anim: custAnim,
      });
      qs.set("aliveLayout", custAliveLayout);
      if (custIconAlive) qs.set("aliveIconAlive", custIconAlive);
      if (custIconDead) qs.set("aliveIconDead", custIconDead);
      return `${origin}${custPath}?${qs.toString()}`;
    }
    if (custPath === "/overlay/themed" || custPath === "/overlay/themed/overall") {
      const qs = new URLSearchParams({ alive: custAlive });
      qs.set("aliveLayout", custAliveLayout);
      if (custIconAlive) qs.set("aliveIconAlive", custIconAlive);
      if (custIconDead) qs.set("aliveIconDead", custIconDead);
      return `${origin}${custPath}?${qs.toString()}`;
    }
    return `${origin}${custPath}`;
  }, [custPath, custTheme, custDesign, custAlive, custAnim, custAliveLayout, custIconAlive, custIconDead]);

  const uploadAliveFile = useCallback(async (e, role) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const api = getApiBase();
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${api}/upload/alive-icon?role=${role}`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadMsg(data.message || "Upload failed");
        setTimeout(() => setUploadMsg(""), 5000);
        return;
      }
      if (data.path) {
        if (role === "dead") setCustIconDead(data.path);
        else setCustIconAlive(data.path);
        setUploadMsg(
          role === "dead" ? "Dead-state image uploaded — click Save preferences." : "Alive-state image uploaded — click Save preferences.",
        );
        setTimeout(() => setUploadMsg(""), 5000);
      }
    } catch {
      setUploadMsg("Upload failed — is the API running?");
      setTimeout(() => setUploadMsg(""), 5000);
    }
  }, []);

  const saveCustomize = useCallback(async () => {
    const api = getApiBase();
    const themedTarget =
      custPath === "/overlay/themed" ||
      custPath === "/overlay/themed/overall" ||
      (typeof custPath === "string" && custPath.startsWith("/overlay/themed/"));
    try {
      const body = themedTarget
        ? {
            themedOverlayPrefs: {
              aliveStyle: custAlive,
              aliveLayout: custAliveLayout,
              aliveCustomAlive: custIconAlive,
              aliveCustomDead: custIconDead,
            },
          }
        : {
            engineOverlayPrefs: {
              overlayPath: custPath,
              aliveStyle: custAlive,
              animationPack: custAnim,
              engineTheme: custTheme,
              engineDesign: custDesign,
              engineAnimations: true,
              aliveLayout: custAliveLayout,
              aliveCustomAlive: custIconAlive,
              aliveCustomDead: custIconDead,
            },
          };
      const res = await fetch(`${api}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaveMsg("Saved. Refresh the OBS browser source for that overlay path (or reopen the URL).");
        setTimeout(() => setSaveMsg(""), 6000);
      } else setSaveMsg("Save failed.");
    } catch {
      setSaveMsg("Save failed — is the API running on port 3001?");
    }
  }, [custPath, custAlive, custAnim, custTheme, custDesign, custAliveLayout, custIconAlive, custIconDead]);

  const filteredAliveIds = useMemo(() => {
    const s = aliveQ.trim().toLowerCase();
    if (!s) return ALIVE_STYLE_IDS;
    return ALIVE_STYLE_IDS.filter((id) => id.toLowerCase().includes(s));
  }, [aliveQ]);

  const obsBase = "/overlay/broadcast-engine";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0a0c12 0%, #12161f 100%)",
        color: "#e4e8ef",
        fontFamily: "'Segoe UI', Inter, system-ui, sans-serif",
        padding: "28px 32px 48px",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5, marginBottom: 8 }}>
        Broadcast overlay engine — catalog
      </h1>
      <p style={{ color: "#8b95a8", fontSize: 13, lineHeight: 1.55, maxWidth: 720, marginBottom: 20 }}>
        Read-only reference. Your existing <code style={{ color: "#a8b4c8" }}>/overlay/themed</code> route is unchanged.
        Without <code>?alive=</code>, defaults differ by page: broadcast engine <strong>battery</strong>, match board <strong>heart</strong>, overall <strong>hex</strong>, WWCD <strong>pulse_ring</strong>, elimination <strong>skull</strong>, legacy <strong>dots</strong>.
        Use URLs below as OBS browser sources. The <strong style={{ color: "#cfd6e4" }}>Theme + design combinations</strong>{" "}
        section lists readable names side by side; <strong style={{ color: "#cfd6e4" }}>Themes by name</strong> and{" "}
        <strong style={{ color: "#cfd6e4" }}>Designs by label</strong> cover the full library. One-shot looks:{" "}
        <code>?bundle=arena_default</code> (see list below).
        Optional file <code>public/broadcast-engine/bundles.json</code> adds or overrides bundle IDs (same shape as static
        bundles). Explicit query params always override bundle defaults.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: "#6b7686" }}>
          {ENGINE_THEME_COUNT} themes · {getEngineDesignCount()} designs · {ALIVE_STYLE_IDS.length} alive packs ·{" "}
          {ANIMATION_PACK_IDS.length} anim packs
        </span>
        <input
          type="search"
          placeholder="Filter themes, designs, combos…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            flex: "1 1 220px",
            maxWidth: 320,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(0,0,0,.35)",
            color: "#fff",
            fontSize: 13,
          }}
        />
      </div>

      <section
        style={{
          marginBottom: 24,
          padding: "16px 18px",
          borderRadius: 14,
          background: "linear-gradient(135deg, rgba(56,189,248,.12) 0%, rgba(167,139,250,.1) 100%)",
          border: "1px solid rgba(255,255,255,.12)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#c8d0e0" }}>Customize & save</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setCustOpen((o) => !o)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.2)",
                background: "rgba(0,0,0,.25)",
                color: "#e4e8ef",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {custOpen ? "Hide" : "Show"} panel
            </button>
            <button
              type="button"
              onClick={saveCustomize}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(90deg, #0891b2, #7c3aed)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Save preferences
            </button>
            <a
              href={typeof window !== "undefined" ? buildCustomUrl() : "#"}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(34,197,94,.4)",
                background: "rgba(34,197,94,.1)",
                color: "#86efac",
                fontSize: 12,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Open preview
            </a>
          </div>
        </div>
        {saveMsg ? (
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#7dd3fc" }}>{saveMsg}</p>
        ) : null}
        {uploadMsg ? (
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#fbbf24" }}>{uploadMsg}</p>
        ) : null}
        {custOpen ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#8b95a8", minWidth: 90 }}>Overlay</span>
              <select
                value={custPath}
                onChange={(e) => setCustPath(e.target.value)}
                style={{ flex: "1 1 220px", maxWidth: 360, padding: "8px 10px", borderRadius: 8, background: "#1a1f2e", color: "#fff", border: "1px solid rgba(255,255,255,.15)", fontSize: 13 }}
              >
                {OVERLAY_TARGETS.map((o) => (
                  <option key={o.path} value={o.path}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {custPath.includes("broadcast-engine") ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#8b95a8", minWidth: 90 }}>Engine theme</span>
                <select
                  value={custTheme}
                  onChange={(e) => setCustTheme(e.target.value)}
                  style={{ flex: "1 1 200px", padding: "8px 10px", borderRadius: 8, background: "#1a1f2e", color: "#fff", border: "1px solid rgba(255,255,255,.15)", fontSize: 12 }}
                >
                  {themeIds.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 12, color: "#8b95a8" }}>Design</span>
                <select
                  value={custDesign}
                  onChange={(e) => setCustDesign(e.target.value)}
                  style={{ flex: "1 1 200px", padding: "8px 10px", borderRadius: 8, background: "#1a1f2e", color: "#fff", border: "1px solid rgba(255,255,255,.15)", fontSize: 11 }}
                >
                  {designs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} — {d.id}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>Alive layout</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  { id: "grid", label: "Square (2×2)" },
                  { id: "line", label: "Single line" },
                ].map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setCustAliveLayout(x.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      border: custAliveLayout === x.id ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,.15)",
                      background: custAliveLayout === x.id ? "rgba(56,189,248,.12)" : "rgba(0,0,0,.35)",
                      color: custAliveLayout === x.id ? "#7dd3fc" : "#cbd5e1",
                      cursor: "pointer",
                    }}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>Custom PNG (optional)</div>
              <p style={{ fontSize: 11, color: "#6b7686", margin: "0 0 8px", maxWidth: 560, lineHeight: 1.45 }}>
                Upload lit and dim icons; they replace the built-in shape until cleared. Save preferences so the overlay loads them from the server.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
                <label style={{ fontSize: 12, color: "#a8b4c8", display: "flex", flexDirection: "column", gap: 4 }}>
                  Alive (lit)
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,.svg" onChange={(e) => uploadAliveFile(e, "alive")} />
                </label>
                <label style={{ fontSize: 12, color: "#a8b4c8", display: "flex", flexDirection: "column", gap: 4 }}>
                  Dead (dim)
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,.svg" onChange={(e) => uploadAliveFile(e, "dead")} />
                </label>
                <div style={{ fontSize: 10, color: "#64748b", fontFamily: "ui-monospace, monospace", maxWidth: 260, wordBreak: "break-all" }}>
                  {custIconAlive ?? "—"}
                  <br />
                  {custIconDead ?? "—"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustIconAlive(null);
                    setCustIconDead(null);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(248,113,113,.35)",
                    background: "rgba(0,0,0,.3)",
                    color: "#fca5a5",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Clear PNGs
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#8b95a8" }}>Alive preview (3/4)</span>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,.35)",
                  border: "1px solid rgba(255,255,255,.1)",
                  minWidth: 72,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <AliveIndicator
                  count={3}
                  theme={previewThemeMerged}
                  styleId={custAlive}
                  layout={custAliveLayout}
                  customAlivePath={custIconAlive}
                  customDeadPath={custIconDead}
                />
              </div>
              <span style={{ fontSize: 12, color: "#8b95a8" }}>Anim: {custAnim}</span>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>Alive style (tap to select)</div>
              <input
                type="search"
                placeholder="Filter 200+ alive IDs…"
                value={aliveQ}
                onChange={(e) => setAliveQ(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: 360,
                  marginBottom: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "rgba(0,0,0,.35)",
                  color: "#fff",
                  fontSize: 12,
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  maxHeight: 200,
                  overflowY: "auto",
                  padding: 4,
                  borderRadius: 8,
                  background: "rgba(0,0,0,.2)",
                }}
              >
                {filteredAliveIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCustAlive(id)}
                    style={{
                      padding: "5px 9px",
                      borderRadius: 6,
                      fontSize: 10,
                      fontFamily: "ui-monospace, monospace",
                      border: custAlive === id ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,.12)",
                      background: custAlive === id ? "rgba(56,189,248,.15)" : "rgba(0,0,0,.35)",
                      color: custAlive === id ? "#7dd3fc" : "#86efac",
                      cursor: "pointer",
                    }}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>Animation pack</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ANIMATION_PACK_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCustAnim(id)}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 6,
                      fontSize: 11,
                      border: custAnim === id ? "2px solid #fbbf24" : "1px solid rgba(255,255,255,.12)",
                      background: custAnim === id ? "rgba(251,191,36,.12)" : "rgba(0,0,0,.35)",
                      color: custAnim === id ? "#fcd34d" : "#fcd34d",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
            <code
              style={{
                display: "block",
                padding: "10px 12px",
                background: "rgba(0,0,0,.45)",
                borderRadius: 8,
                fontSize: 11,
                wordBreak: "break-all",
                color: "#a8b4c8",
              }}
            >
              {typeof window !== "undefined" ? buildCustomUrl() : ""}
            </code>
          </div>
        ) : null}
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: "#c8d0e0" }}>Quick OBS URL</h2>
        <code
          style={{
            display: "block",
            padding: "12px 14px",
            background: "rgba(0,0,0,.4)",
            borderRadius: 8,
            fontSize: 12,
            wordBreak: "break-all",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          {typeof window !== "undefined" ? `${window.location.origin}${obsBase}?engineTheme=br_esports_pro_v0&anim=subtle&alive=rounded` : obsBase}
        </code>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#c8d0e0" }}>
          Theme + design combinations ({themeDesignCombos.length})
        </h2>
        <p style={{ fontSize: 12, color: "#8b95a8", marginBottom: 12, maxWidth: 720, lineHeight: 1.5 }}>
          Each card shows the <strong style={{ color: "#cfd6e4" }}>theme name</strong> and{" "}
          <strong style={{ color: "#cfd6e4" }}>design label</strong> together. Opens the broadcast engine with both{" "}
          <code>engineTheme</code> and <code>engineDesign</code> set. (Sample grid — use filter above to narrow.)
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
          {themeDesignCombos.map((row, idx) => (
            <a
              key={`${row.themeId}-${row.designId}-${idx}`}
              href={`${obsBase}?engineTheme=${encodeURIComponent(row.themeId)}&engineDesign=${encodeURIComponent(row.designId)}&alive=rounded&anim=subtle`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "linear-gradient(135deg, rgba(56,189,248,.08) 0%, rgba(167,139,250,.08) 100%)",
                border: "1px solid rgba(255,255,255,.1)",
                color: "#e4e8ef",
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6, lineHeight: 1.35 }}>
                <span style={{ color: "#7dd3fc" }}>{row.themeName}</span>
                <span style={{ color: "#64748b", fontWeight: 600, margin: "0 6px" }}>×</span>
                <span style={{ color: "#c4b5fd" }}>{row.designLabel}</span>
              </div>
              <div style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: "#6b7686", wordBreak: "break-all" }}>
                {row.themeId} · {row.designId}
              </div>
            </a>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: "#c8d0e0" }}>
          Preset bundles ({filteredBundles.length})
        </h2>
        <p style={{ fontSize: 12, color: "#8b95a8", marginBottom: 12 }}>
          <code>?bundle=…</code> — add <code>?syncAdmin=1</code> to follow admin active theme when needed.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {filteredBundles.map((id) => (
            <a
              key={id}
              href={`${obsBase}?bundle=${encodeURIComponent(id)}`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "rgba(124,58,237,.12)",
                border: "1px solid rgba(124,58,237,.28)",
                color: "#e9d5ff",
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{id}</div>
              <div style={{ fontSize: 11, color: "#a78bfa", opacity: 0.95 }}>{PRESET_BUNDLE_DEFS[id]?.label}</div>
            </a>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: "#c8d0e0" }}>Admin theme bridge</h2>
        <p style={{ fontSize: 12, color: "#8b95a8", marginBottom: 10 }}>
          Legacy → engine (when using <code>?syncAdmin=1</code>):
        </p>
        <ul style={{ fontSize: 12, color: "#a8b4c8", margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          {LEGACY_THEME_NAMES.map((k) => (
            <li key={k}>
              <strong style={{ color: "#e4e8ef" }}>{k}</strong> → {LEGACY_TO_ENGINE[k]}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#c8d0e0" }}>
          Themes by name ({filteredThemes.length})
        </h2>
        <p style={{ fontSize: 12, color: "#8b95a8", marginBottom: 10 }}>
          Human-readable <strong style={{ color: "#cfd6e4" }}>name</strong> from the engine library; ID is for URLs and{" "}
          <code>?bundle=</code> overrides. Classic overlay <code>/overlay/themed?alive=heart</code> (or{" "}
          <code>battery</code>, <code>box</code>, etc.) uses the same shapes.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 8,
            maxHeight: 420,
            overflowY: "auto",
            paddingRight: 6,
          }}
        >
          {filteredThemes.map((t) => (
            <a
              key={t.id}
              href={`${obsBase}?engineTheme=${encodeURIComponent(t.id)}&alive=rounded&anim=subtle`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.08)",
                color: "#e4e8ef",
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              <div style={{ fontWeight: 700, color: "#7dd3fc", marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: "#6b7686", wordBreak: "break-all" }}>
                {t.id}
              </div>
            </a>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#c8d0e0" }}>
          Designs by label ({filteredDesigns.length})
        </h2>
        <p style={{ fontSize: 12, color: "#8b95a8", marginBottom: 10 }}>
          <strong style={{ color: "#cfd6e4" }}>Label</strong> groups the layout family and wave; ID is the full token for{" "}
          <code>engineDesign</code>.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 8,
            maxHeight: 420,
            overflowY: "auto",
          }}
        >
          {filteredDesigns.map((d) => (
            <a
              key={d.id}
              href={`${obsBase}?engineTheme=br_esports_pro_v0&engineDesign=${encodeURIComponent(d.id)}`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.08)",
                color: "#e4e8ef",
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              <div style={{ fontWeight: 700, color: "#c4b5fd", marginBottom: 4 }}>{d.label}</div>
              <div style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: "#6b7686", wordBreak: "break-all" }}>
                {d.id}
              </div>
            </a>
          ))}
        </div>
      </section>

      <section>
        <p style={{ fontSize: 12, color: "#8b95a8", lineHeight: 1.55, margin: 0 }}>
          <strong style={{ color: "#c8d0e0" }}>Alive styles</strong> ({ALIVE_STYLE_IDS.length} IDs) and{" "}
          <strong style={{ color: "#c8d0e0" }}>animation packs</strong> ({ANIMATION_PACK_IDS.join(", ")}) are selectable in the{" "}
          <strong style={{ color: "#cfd6e4" }}>Customize &amp; save</strong> panel above: pick <strong style={{ color: "#cfd6e4" }}>Square (2×2)</strong> vs{" "}
          <strong style={{ color: "#cfd6e4" }}>Single line</strong>, optional custom PNGs via upload, then save. URL overrides:{" "}
          <code style={{ color: "#a8b4c8" }}>?aliveLayout=grid|line</code>,<code style={{ color: "#a8b4c8" }}>?aliveIconAlive=…&amp;aliveIconDead=…</code> (paths under{" "}
          <code style={{ color: "#a8b4c8" }}>/uploads/alive-icons/</code>).
        </p>
      </section>
    </div>
  );
}

export default memo(EngineCatalog);
