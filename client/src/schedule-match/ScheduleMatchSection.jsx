import { useMemo } from "react";

const SCHEDULE_BASE = "/schedule-of-the-match";
const STORAGE_KEY = "schedule-of-the-match-config";

/**
 * SCHEDULE OF THE MATCH — embedded editor in main admin (sidebar section).
 * Uses the standalone HTML admin; same localStorage as OBS overlay.
 */
export default function ScheduleMatchSection() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const adminUrl = `${origin}${SCHEDULE_BASE}/admin.html`;
  const overlayUrl = `${origin}${SCHEDULE_BASE}/overlay.html`;

  const obsSnippet = useMemo(
    () => `body { background: transparent !important; }`,
    [],
  );

  return (
    <section style={sectionCard}>
      <div style={sectionHeader}>
        <div>
          <p style={label}>MATCH SCHEDULE</p>
          <h2 style={title}>Schedule of the match</h2>
          <p style={hint}>
            Edit below, then click <strong>Save all settings</strong> (orange bar). Background uploads to the server so OBS
            sees them — refresh the OBS browser source after saving. Backend must be running on port 3001.
          </p>
        </div>
        <div style={actionRow}>
          <button type="button" style={btnPrimary} onClick={() => window.open(overlayUrl, "_blank", "width=1920,height=1080")}>
            Open overlay preview
          </button>
          <button
            type="button"
            style={btn}
            onClick={() => {
              try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) {
                  alert("No saved schedule config yet. Use the editor below first.");
                  return;
                }
                const blob = new Blob([raw], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "schedule-of-the-match-config.json";
                a.click();
                URL.revokeObjectURL(a.href);
              } catch (e) {
                alert(String(e?.message || e));
              }
            }}
          >
            Export JSON
          </button>
        </div>
      </div>

      <div style={urlBlock}>
        <div style={urlLab}>OBS browser source URL (1920 × 1080)</div>
        <code style={urlCode}>{overlayUrl}</code>
        <button
          type="button"
          style={{ ...btn, marginTop: 10 }}
          onClick={() => {
            void navigator.clipboard?.writeText(overlayUrl);
          }}
        >
          Copy overlay URL
        </button>
        <div style={{ ...hint, marginTop: 12 }}>
          OBS size must be <strong>1920 × 1080</strong> (width and height). Wrong size crops or shrinks the schedule.
          Optional custom CSS: <code style={codeInline}>{obsSnippet}</code>
        </div>
      </div>

      <div style={editorWrap}>
        <iframe
          title="Schedule of the match editor"
          src={adminUrl}
          style={iframeStyle}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </section>
  );
}

const sectionCard = {
  background: "linear-gradient(165deg, rgba(18,22,28,.98) 0%, rgba(12,14,18,.99) 100%)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 16,
  padding: "22px 24px 24px",
  marginBottom: 20,
};

const sectionHeader = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
};

const label = {
  margin: 0,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 1.2,
  color: "#6b8490",
  textTransform: "uppercase",
};

const title = {
  margin: "6px 0 8px",
  fontSize: 22,
  fontWeight: 900,
  color: "#fff",
};

const hint = {
  margin: 0,
  fontSize: 13,
  color: "#8891a1",
  fontWeight: 600,
  maxWidth: 720,
  lineHeight: 1.5,
};

const actionRow = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" };

const btn = {
  padding: "10px 16px",
  fontSize: 12,
  fontWeight: 800,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.04)",
  color: "#e8edf4",
  cursor: "pointer",
};

const btnPrimary = {
  ...btn,
  border: "1px solid rgba(230,57,70,.5)",
  background: "linear-gradient(160deg,#e63946,#b91c1c)",
  color: "#fff",
};

const urlBlock = {
  marginBottom: 16,
  padding: 14,
  borderRadius: 12,
  background: "rgba(0,0,0,.25)",
  border: "1px solid rgba(255,255,255,.06)",
};

const urlLab = {
  fontSize: 10,
  fontWeight: 900,
  color: "#6b8490",
  letterSpacing: 1.1,
  textTransform: "uppercase",
  marginBottom: 8,
};

const urlCode = {
  display: "block",
  fontSize: 13,
  color: "#F1CF69",
  wordBreak: "break-all",
};

const codeInline = { color: "#F1CF69", fontSize: 12 };

const editorWrap = {
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,.08)",
  minHeight: 720,
};

const iframeStyle = {
  width: "100%",
  height: "min(92vh, 1100px)",
  border: "none",
  display: "block",
  background: "#0f1419",
};
