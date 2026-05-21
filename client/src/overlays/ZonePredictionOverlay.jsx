import { useEffect, useState } from "react";
import socket from "./socket";

const GOLD = "#F1CF69";
const TEXT = "#e8eef5";

/**
 * Dedicated OBS browser source — /overlay/zone-prediction
 * Listens for admin `{ type: "adminZoneCue" }` commands only (not mixed with /overlay/themed).
 */
export default function ZonePredictionOverlay() {
  const [cue, setCue] = useState(null);

  useEffect(() => {
    const on = (cmd) => {
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
    socket.on("overlayCommand", on);
    return () => socket.off("overlayCommand", on);
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
            background: "linear-gradient(180deg, rgba(12,16,22,.94), rgba(8,10,14,.90))",
            border: `1px solid ${GOLD}55`,
            boxShadow: "0 12px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04)",
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: GOLD,
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
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden; background: transparent; }
      `}</style>
    </div>
  );
}
