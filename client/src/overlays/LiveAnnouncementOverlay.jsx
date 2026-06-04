import { useCallback, useEffect, useRef, useState } from "react";
import socket, { apiUrl } from "./socket";
import { parseAnnouncementCommand } from "./liveAnnouncementUtils";
import { useLiveRankingThemePalette } from "./hooks/useLiveRankingThemePalette";

function resolveAnnouncementImage(url) {
  const s = String(url ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return apiUrl(s);
}

/**
 * Dedicated OBS browser source — /overlay/announcements
 * Socket + GET fallback so LAN/OBS refresh still shows the latest broadcast.
 */
export default function LiveAnnouncementOverlay() {
  const { palette } = useLiveRankingThemePalette();
  const [ticker, setTicker] = useState(null);
  const [socketReady, setSocketReady] = useState(null);
  const timerRef = useRef(null);

  const themeVars = {
    "--ann-gold": palette.gold,
    "--ann-accent": palette.accent,
    "--ann-text": palette.text,
    "--ann-muted": palette.textMuted,
    "--ann-panel-bg": palette.panelGradient,
    "--ann-header-bg": palette.headerGradient,
    "--ann-head-line": palette.headLineGradient,
    "--ann-border": palette.borderColor,
    "--ann-glow-soft": palette.glowSoft,
    "--ann-glow-strong": palette.glowStrong,
  };

  const showAnnouncement = useCallback((cmd, remainingMsOverride) => {
    const next = parseAnnouncementCommand(cmd, remainingMsOverride);
    if (next) setTicker(next);
  }, []);

  const syncFromServer = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/overlay/announcement-state"), { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.announcement) {
        showAnnouncement(data.announcement, data.remainingMs);
      }
    } catch {
      /* API offline */
    }
  }, [showAnnouncement]);

  useEffect(() => {
    if (!ticker) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const ms = Math.max(
      500,
      Number.isFinite(ticker.remainingMs) ? ticker.remainingMs : ticker.durationMs || 9000,
    );
    timerRef.current = window.setTimeout(() => {
      setTicker(null);
      timerRef.current = null;
    }, ms);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [ticker]);

  useEffect(() => {
    document.documentElement.classList.add("liv-ann-page");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@600;700;800&display=swap";
    document.head.appendChild(link);
    return () => {
      document.documentElement.classList.remove("liv-ann-page");
      link.remove();
    };
  }, []);

  useEffect(() => {
    const onCmd = (cmd) => showAnnouncement(cmd);
    const onConnect = () => {
      setSocketReady(true);
      void syncFromServer();
    };
    const onDisconnect = () => setSocketReady(false);
    const onErr = () => setSocketReady(false);

    socket.on("overlayCommand", onCmd);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onErr);

    if (!socket.connected) socket.connect();
    setSocketReady(socket.connected);
    void syncFromServer();

    return () => {
      socket.off("overlayCommand", onCmd);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onErr);
    };
  }, [showAnnouncement, syncFromServer]);

  /** Poll when socket is down so broadcast still appears on LAN/OBS */
  useEffect(() => {
    if (socketReady !== false) return undefined;
    const id = window.setInterval(() => void syncFromServer(), 2000);
    return () => window.clearInterval(id);
  }, [socketReady, syncFromServer]);

  const imgSrc = ticker?.imageUrl ? resolveAnnouncementImage(ticker.imageUrl) : "";
  const hasImage = Boolean(imgSrc);
  const hasText = Boolean(ticker?.message);

  return (
    <div className="liv-ann-root" style={themeVars}>
      {ticker ? (
        <div key={String(ticker.seq)} className="liv-ann-slot" aria-live="assertive">
          <div className={`liv-ann-panel${hasImage ? " liv-ann-panel--has-img" : ""}`}>
            <div className="liv-ann-panel-bg" aria-hidden />
            <div className="liv-ann-corner liv-ann-corner--tl" aria-hidden />
            <div className="liv-ann-corner liv-ann-corner--br" aria-hidden />
            <div className="liv-ann-head">
              <span className="liv-ann-head-tag">Announcement</span>
              <span className="liv-ann-head-line" aria-hidden />
              <span className="liv-ann-head-live">Live</span>
            </div>
            <div className={`liv-ann-body${hasImage && !hasText ? " liv-ann-body--img-only" : ""}`}>
              {hasImage ? (
                <div className="liv-ann-img-wrap">
                  <img className="liv-ann-img" src={imgSrc} alt="" draggable={false} />
                  <div className="liv-ann-img-frame" aria-hidden />
                </div>
              ) : null}
              {hasText ? <p className="liv-ann-msg">{ticker.message}</p> : null}
            </div>
            <div className="liv-ann-sheen" aria-hidden />
            <div className="liv-ann-scan" aria-hidden />
          </div>
        </div>
      ) : null}

      {socketReady === false ? (
        <div className="liv-ann-hint liv-ann-hint--err" role="status">
          Live server not connected — polling for announcements. Keep <strong>npm run dev</strong> running; use this
          page on port <strong>5173</strong> (not :3001). After broadcast, banner should appear within ~2s.
        </div>
      ) : null}

      {socketReady === true && !ticker ? (
        <div className="liv-ann-hint liv-ann-hint--ok" aria-hidden>
          Announcements · standby — broadcast from Admin → Live announcements
        </div>
      ) : null}

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html.liv-ann-page,
        html.liv-ann-page body,
        html.liv-ann-page #root {
          overflow: hidden;
          background: transparent !important;
        }

        .liv-ann-root {
          width: 100vw;
          height: 100vh;
          position: relative;
          background: transparent;
          font-family: "Rajdhani", "Segoe UI", system-ui, sans-serif;
        }

        .liv-ann-hint {
          pointer-events: none;
          position: absolute;
          left: 50%;
          bottom: 8%;
          transform: translateX(-50%);
          max-width: min(94vw, 560px);
          padding: 12px 18px;
          border-radius: 12px;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.45;
          z-index: 1;
        }
        .liv-ann-hint strong { font-weight: 900; }
        .liv-ann-hint--err {
          color: #fecaca;
          background: rgba(40, 10, 10, 0.88);
          border: 1px solid rgba(248, 113, 113, 0.45);
        }
        .liv-ann-hint--ok {
          color: var(--ann-gold);
          background: rgba(12, 16, 24, 0.88);
          border: 1px solid var(--ann-border);
        }

        .liv-ann-slot {
          pointer-events: none;
          position: absolute;
          left: 50%;
          bottom: 5.5%;
          transform: translateX(-50%);
          z-index: 2;
        }

        .liv-ann-panel {
          position: relative;
          width: min(92vw, 920px);
          overflow: hidden;
          clip-path: polygon(
            12px 0,
            calc(100% - 12px) 0,
            100% 12px,
            100% calc(100% - 12px),
            calc(100% - 12px) 100%,
            12px 100%,
            0 calc(100% - 12px),
            0 12px
          );
          border: 1px solid var(--ann-border);
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.65),
            0 22px 56px rgba(0, 0, 0, 0.72),
            0 0 48px var(--ann-glow-soft),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          animation:
            liv-ann-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards,
            liv-ann-glow 2.8s ease-in-out 0.5s infinite;
        }

        .liv-ann-panel--has-img {
          width: min(94vw, 1040px);
        }

        .liv-ann-panel-bg {
          position: absolute;
          inset: 0;
          background: var(--ann-panel-bg);
          z-index: 0;
        }

        .liv-ann-corner {
          position: absolute;
          width: 28px;
          height: 28px;
          z-index: 3;
          pointer-events: none;
        }
        .liv-ann-corner--tl {
          top: 0;
          left: 0;
          border-top: 3px solid var(--ann-gold);
          border-left: 3px solid var(--ann-gold);
        }
        .liv-ann-corner--br {
          bottom: 0;
          right: 0;
          border-bottom: 3px solid var(--ann-accent);
          border-right: 3px solid var(--ann-accent);
        }

        .liv-ann-head {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px 8px;
          background: var(--ann-header-bg);
          border-bottom: 1px solid var(--ann-border);
        }

        .liv-ann-head-tag {
          font-family: "Bebas Neue", "Impact", sans-serif;
          font-size: 22px;
          letter-spacing: 0.14em;
          color: var(--ann-gold);
          text-transform: uppercase;
          line-height: 1;
          text-shadow: 0 0 18px var(--ann-glow-soft);
        }

        .liv-ann-head-line {
          flex: 1;
          height: 2px;
          background: var(--ann-head-line);
          opacity: 0.85;
        }

        .liv-ann-head-live {
          font-family: "Bebas Neue", sans-serif;
          font-size: 18px;
          letter-spacing: 0.2em;
          color: var(--ann-accent);
          padding: 2px 10px 0;
          border: 1px solid var(--ann-border);
          background: var(--ann-glow-soft);
          clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
        }

        .liv-ann-body {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 16px 22px 20px;
        }

        .liv-ann-panel:not(.liv-ann-panel--has-img) .liv-ann-body {
          justify-content: center;
        }

        .liv-ann-body--img-only {
          justify-content: center;
          padding: 18px 24px 22px;
        }

        .liv-ann-body--img-only .liv-ann-img-wrap {
          width: min(72vw, 480px);
          height: min(40vw, 200px);
        }

        .liv-ann-img-wrap {
          position: relative;
          flex-shrink: 0;
          width: min(28vw, 200px);
          height: min(28vw, 120px);
          clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
        }

        .liv-ann-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          filter: contrast(1.06) saturate(1.08);
        }

        .liv-ann-img-frame {
          position: absolute;
          inset: 0;
          border: 1px solid var(--ann-border);
          box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.45);
          pointer-events: none;
        }

        .liv-ann-msg {
          flex: 1;
          margin: 0;
          color: var(--ann-text);
          font-size: clamp(18px, 2.1vw, 26px);
          font-weight: 800;
          line-height: 1.35;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          white-space: pre-line;
          overflow-wrap: break-word;
          text-align: left;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.65);
          animation: liv-ann-text 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
        }

        .liv-ann-panel:not(.liv-ann-panel--has-img) .liv-ann-msg {
          text-align: center;
        }

        .liv-ann-sheen {
          position: absolute;
          top: -40%;
          bottom: -40%;
          left: -60%;
          width: 45%;
          z-index: 4;
          background: linear-gradient(
            106deg,
            transparent 18%,
            rgba(255, 255, 255, 0.18) 48%,
            transparent 78%
          );
          animation: liv-ann-shine 2.1s cubic-bezier(0.4, 0, 0.2, 1) 0.35s forwards;
          pointer-events: none;
        }

        .liv-ann-scan {
          position: absolute;
          inset: 0;
          z-index: 1;
          opacity: 0.06;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.4) 2px,
            rgba(0, 0, 0, 0.4) 4px
          );
          pointer-events: none;
        }

        @keyframes liv-ann-enter {
          from {
            opacity: 0;
            transform: translateY(48px) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes liv-ann-glow {
          0%, 100% {
            box-shadow:
              0 0 0 1px rgba(0, 0, 0, 0.65),
              0 22px 56px rgba(0, 0, 0, 0.72),
              0 0 32px var(--ann-glow-soft);
          }
          50% {
            box-shadow:
              0 0 0 1px var(--ann-border),
              0 26px 64px rgba(0, 0, 0, 0.78),
              0 0 52px var(--ann-glow-strong);
          }
        }

        @keyframes liv-ann-shine {
          0% { opacity: 0; transform: translateX(-80%) skewX(-12deg); }
          40% { opacity: 0.9; }
          100% { opacity: 0; transform: translateX(220%) skewX(-12deg); }
        }

        @keyframes liv-ann-text {
          from {
            opacity: 0;
            filter: blur(6px);
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .liv-ann-panel { animation: none !important; opacity: 1; }
          .liv-ann-msg { animation: none !important; }
          .liv-ann-sheen { display: none; }
        }
      `}</style>
    </div>
  );
}
