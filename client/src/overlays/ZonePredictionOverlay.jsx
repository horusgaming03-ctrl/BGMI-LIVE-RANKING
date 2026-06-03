import { useEffect, useState } from "react";
import socket from "./socket";

/** Matches Admin dashboard Live rankings · `Open overlay` (`dash.editRowBtn`) blue. */
const ACCENT = "#eaf0ff";
const ACCENT_BORDER = "rgba(80,142,255,.5)";
const PANEL_BG = "linear-gradient(180deg, rgba(24,42,118,.94), rgba(18,26,72,.92))";
const TEXT = "#e8eef5";

/**
 * Dedicated OBS browser source — /overlay/zone-prediction
 * Listens for admin `{ type: "adminZoneCue" }` commands only (not mixed with /overlay/themed).
 */
export default function ZonePredictionOverlay() {
  const [cue, setCue] = useState(null);
  /** `null` unknown, `true` wired, `false` cannot reach socket server */
  const [socketReady, setSocketReady] = useState(null);

  useEffect(() => {
    const onCmd = (cmd) => {
      if (!cmd || typeof cmd !== "object" || cmd.type !== "adminZoneCue") return;
      if (cmd.clear) {
        setCue(null);
        return;
      }
      setCue({
        headline: String(cmd.headline ?? cmd.title ?? "").trim() || "NEXT ZONE",
        subtitle: String(cmd.subtitle ?? cmd.detail ?? "").trim(),
      });
    };

    const flagErr = () => setSocketReady(false);
    const flagOk = () => setSocketReady(true);

    const onDisconnect = () => setSocketReady(false);

    socket.on("connect", flagOk);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", flagErr);
    socket.on("overlayCommand", onCmd);
    try {
      socket.io.on("error", flagErr);
    } catch {
      /* ignore */
    }

    setSocketReady(Boolean(socket.connected));

    return () => {
      socket.off("connect", flagOk);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", flagErr);
      socket.off("overlayCommand", onCmd);
      try {
        socket.io.off("error", flagErr);
      } catch {
        /* ignore */
      }
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "transparent",
        fontFamily: "'Rajdhani', 'Inter', system-ui, sans-serif",
      }}
    >
      {cue ? (
        <div
          aria-live="polite"
          style={{
            position: "absolute",
            top: "8%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(94vw, 720px)",
            padding: "14px 22px",
            borderRadius: 14,
            textAlign: "center",
            background: PANEL_BG,
            border: `1px solid ${ACCENT_BORDER}`,
            boxShadow:
              "0 12px 40px rgba(0,0,0,.55), 0 0 28px rgba(80,142,255,.18), 0 0 0 1px rgba(255,255,255,.04)",
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            {cue.headline}
          </div>
          {cue.subtitle ? (
            <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700, color: TEXT }}>
              {cue.subtitle}
            </div>
          ) : null}
        </div>
      ) : null}

      {socketReady === false ? (
        <div
          role="status"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "12%",
            transform: "translateX(-50%)",
            maxWidth: "min(94vw, 520px)",
            padding: "12px 18px",
            borderRadius: 12,
            textAlign: "center",
            fontSize: 13,
            fontWeight: 700,
            color: "#fecaca",
            background: "rgba(40,10,10,.88)",
            border: "1px solid rgba(248,113,113,.45)",
            boxShadow: "0 8px 28px rgba(0,0,0,.45)",
          }}
        >
          Cannot reach live server (Socket.IO). Run the API on port 3001 (<code style={{ color: "#fcd34d" }}>npm run dev</code> or{" "}
          <code style={{ color: "#fcd34d" }}>npm run dev:api</code>
          ). LAN: use this page through the same Vite port (e.g. <code style={{ color: "#fcd34d" }}>5173</code>) — not{" "}
          <code style={{ color: "#fcd34d" }}>:3001</code> for the React UI.
        </div>
      ) : null}

      {socketReady === true && !cue ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            bottom: "8%",
            transform: "translateX(-50%)",
            padding: "10px 16px",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(226,232,240,.82)",
            letterSpacing: 0.35,
            background: "rgba(15,23,42,.92)",
            border: "1px solid rgba(80,142,255,.28)",
            boxShadow: "0 6px 20px rgba(0,0,0,.35)",
          }}
        >
          Zone cue · standby — send from Admin → Zone prediction
        </div>
      ) : null}

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { overflow: hidden; background: transparent !important; }
      `}</style>
    </div>
  );
}
