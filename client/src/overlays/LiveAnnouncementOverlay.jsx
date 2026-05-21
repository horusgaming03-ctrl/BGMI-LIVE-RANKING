import { useEffect, useRef, useState } from "react";
import socket from "./socket";

const PRIMARY = "#ff4655";
const TEXT = "#ffffff";

/**
 * Dedicated OBS browser source — /overlay/announcements
 * Listens for admin `{ type: "adminAnnouncement" }` only (separate layer from match board).
 */
export default function LiveAnnouncementOverlay() {
  const [ticker, setTicker] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!ticker) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const ms =
      ticker.durationMs && ticker.durationMs >= 2000
        ? Math.min(60000, ticker.durationMs)
        : 9000;
    timerRef.current = window.setTimeout(() => {
      setTicker(null);
      timerRef.current = null;
    }, ms);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [ticker]);

  useEffect(() => {
    const on = (cmd) => {
      if (!cmd || typeof cmd !== "object" || cmd.type !== "adminAnnouncement") return;
      const msg = String(cmd.message ?? cmd.text ?? "").trim();
      if (!msg) return;
      const rawMs = Number(cmd.durationMs);
      const durationMs =
        Number.isFinite(rawMs) && rawMs >= 2000 ? Math.min(60000, rawMs) : 9000;
      setTicker({ message: msg, durationMs, seq: Date.now() });
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
      {ticker ? (
        <div key={String(ticker.seq)} className="liv-ann-slot" aria-live="assertive">
          <div
            className="liv-ann-banner"
            style={{
              width: "min(92vw, 880px)",
              padding: "18px 32px",
              borderRadius: 14,
              textAlign: "center",
              color: TEXT,
              fontSize: 20,
              fontWeight: 800,
              lineHeight: 1.4,
              whiteSpace: "pre-line",
              overflowWrap: "break-word",
              border: `1px solid ${PRIMARY}b3`,
              background: `linear-gradient(90deg, ${PRIMARY}2e, rgba(15,25,35,.94), ${PRIMARY}2e)`,
            }}
          >
            <div className="liv-ann-sheen" aria-hidden />
            <span className="liv-ann-text">{ticker.message}</span>
          </div>
        </div>
      ) : null}
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden; background: transparent; }

        .liv-ann-slot {
          pointer-events: none;
          position: absolute;
          left: 50%;
          bottom: 6%;
          transform: translateX(-50%);
        }

        @keyframes liv-ann-enter {
          from {
            opacity: 0;
            transform: translateY(56px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes liv-ann-shine {
          0% {
            opacity: 0;
            transform: translateX(-120%) skewX(-14deg);
          }
          45% {
            opacity: 0.85;
          }
          100% {
            opacity: 0;
            transform: translateX(260%) skewX(-14deg);
          }
        }

        @keyframes liv-ann-pulse-ring {
          0%, 100% {
            box-shadow:
              0 18px 52px rgba(0, 0, 0, 0.58),
              inset 0 0 96px rgba(15, 25, 35, 0.56),
              0 0 0 rgba(255, 70, 85, 0),
              0 0 28px rgba(255, 70, 85, 0);
          }
          50% {
            box-shadow:
              0 24px 64px rgba(0, 0, 0, 0.66),
              inset 0 0 110px rgba(15, 25, 35, 0.55),
              0 0 0 1px rgba(255, 70, 85, 0.5),
              0 0 42px rgba(255, 70, 85, 0.35);
          }
        }

        @keyframes liv-ann-text {
          from {
            opacity: 0;
            filter: blur(4px);
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0);
          }
        }

        .liv-ann-banner {
          position: relative;
          overflow: hidden;
          animation:
            liv-ann-enter 0.62s cubic-bezier(0.22, 1, 0.36, 1) forwards,
            liv-ann-pulse-ring 2.6s ease-in-out 0.55s infinite;
        }

        .liv-ann-text {
          position: relative;
          z-index: 1;
          display: inline-block;
          animation: liv-ann-text 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.1s;
        }

        .liv-ann-sheen {
          position: absolute;
          top: -50%;
          bottom: -50%;
          left: -50%;
          width: 55%;
          z-index: 0;
          background: linear-gradient(
            106deg,
            transparent 22%,
            rgba(255, 255, 255, 0.22) 50%,
            transparent 78%
          );
          animation: liv-ann-shine 1.95s cubic-bezier(0.4, 0, 0.2, 1) 0.28s forwards;
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .liv-ann-banner {
            animation: none !important;
            opacity: 1;
            box-shadow:
              0 18px 52px rgba(0, 0, 0, 0.58),
              inset 0 0 96px rgba(15, 25, 35, 0.56);
          }
          .liv-ann-text {
            animation: none !important;
            opacity: 1;
            filter: none;
          }
          .liv-ann-sheen {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
