import { useEffect, useId, useMemo, useRef, useState } from "react";
import socket from "./socket";
import { getRondoRecallChargesRemaining } from "../rondo/recallCharges.js";
import { getApiBase } from "../apiOrigin";

const API = getApiBase();

/** Visible hold ≥ 3s at full opacity (14%→84% of timeline ≈70%), then fades out. Sync unmount after animation ends. */
const POP_ANIM_DURATION_SEC = 5.15;
const TOAST_UNMOUNT_MS = Math.round(POP_ANIM_DURATION_SEC * 1000) + 220;

/**
 * OBS / broadcast: Rondo recall success toast (premium BGMI‑inspired, not asset-copy).
 *
 * URL: `/overlay/rondo/recall-popup`
 * Query:
 *   - `sound=1` — short synthesized success chime (optional; muted by default)
 *   - `headline` — override main line (URL-encoded)
 *   - `sub` — optional second line override
 *
 * Detection (no backend changes): listens to `teamsUpdated` only.
 * Fires once per qualifying transition:
 *   - Bench → combat: was `rondo_benched`, now alive/knocked with alivePlayers > 0
 *   - Mid‑fight recall: alivePlayers increases & recall credits decreased vs previous snapshot
 * Skips floods on roster load / resets (requires charge drop for non‑bench recalls).
 */

function snapshotRow(t) {
  const st = String(t?.status || "").toLowerCase();
  const ap = Math.max(0, Math.min(4, Number(t?.alivePlayers) || 0));
  const charges = getRondoRecallChargesRemaining(t);
  return {
    id: t?.id,
    st,
    ap,
    charges,
    team: typeof t?.team === "string" ? t.team : "",
    logo: t?.logo || null,
  };
}

function playOptionalChime() {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    o.type = "sine";
    o.frequency.setValueAtTime(523.25, now);
    o.frequency.exponentialRampToValueAtTime(784, now + 0.12);
    o.start(now);
    o.stop(now + 0.3);
    ctx.resume?.();
    setTimeout(() => ctx.close?.(), 450);
  } catch {
    /* ignore — optional enhancement */
  }
}

/** Bold recall bolt — cyan / gold HUD read (generic esports HUD, not lifted assets). */
function RecallIcon({ gradId }) {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 48 48"
      aria-hidden
      shapeRendering="geometricPrecision"
      style={{
        flexShrink: 0,
        filter: "drop-shadow(0 0 14px rgba(103,232,249,0.45)) drop-shadow(0 0 6px rgba(252,211,77,0.25))",
      }}
    >
      <defs>
        <linearGradient id={`rrp-ring-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="45%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={`rrp-fill-${gradId}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ecfeff" stopOpacity={0.98} />
          <stop offset="40%" stopColor="#67e8f9" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.94} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21.5" fill="rgba(2,12,27,0.88)" stroke={`url(#rrp-ring-${gradId})`} strokeWidth="1.35" />
      <path fill={`url(#rrp-fill-${gradId})`} d="M28.2 4.5L17.4 26.8h9.9l-3.9 17.5 17.9-26.5h-9.9L28.2 4.5z" opacity={0.98} />
      <path
        fill="none"
        stroke="#fde68a"
        strokeWidth="0.65"
        strokeOpacity={0.5}
        d="M28.2 4.5L17.4 26.8h9.9l-3.9 17.5 17.9-26.5h-9.9z"
      />
    </svg>
  );
}

export default function RondoRecallPopupOverlay() {
  const iconGradId = useId().replace(/\W/g, "");
  const soundOn = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sound") === "1";

  const [toast, setToast] = useState(null);
  const prevSnapRef = useRef(new Map());
  const seededRef = useRef(false);

  const qsOverrides = useMemo(() => {
    if (typeof window === "undefined") return { headline: null, sub: null };
    const q = new URLSearchParams(window.location.search);
    return {
      headline: q.get("headline"),
      sub: q.get("sub"),
    };
  }, []);

  useEffect(() => {
    const onTeams = (list) => {
      if (!Array.isArray(list)) return;

      if (!seededRef.current) {
        seededRef.current = true;
        const m = new Map();
        for (const t of list) {
          const row = snapshotRow(t);
          if (row.id != null) m.set(row.id, row);
        }
        prevSnapRef.current = m;
        return;
      }

      const prevMap = prevSnapRef.current;
      const nextMap = new Map();

      for (const t of list) {
        const cur = snapshotRow(t);
        if (cur.id == null) continue;
        nextMap.set(cur.id, cur);

        const prev = prevMap.get(cur.id);
        if (!prev) continue;

        const benchRecall =
          prev.st === "rondo_benched" &&
          cur.st !== "rondo_benched" &&
          (cur.st === "alive" || cur.st === "knocked") &&
          cur.ap > 0 &&
          prev.ap === 0;

        const partialRecall =
          prev.st !== "rondo_benched" &&
          (cur.st === "alive" || cur.st === "knocked") &&
          cur.ap > prev.ap &&
          cur.charges < prev.charges;

        if (!benchRecall && !partialRecall) continue;

        const headline = qsOverrides.headline || "Teammate Recalled";
        const sub =
          qsOverrides.sub ||
          (benchRecall
            ? `${cur.team} · redeployed from recall`
            : `${cur.team} · player recalled (+${cur.ap - prev.ap})`);

        if (soundOn) playOptionalChime();

        setToast({
          key: `${cur.id}-${Date.now()}`,
          headline,
          sub,
          team: cur.team,
          logo: cur.logo,
        });
      }

      prevSnapRef.current = nextMap;
    };

    socket.on("teamsUpdated", onTeams);
    socket.emit("requestTeams");
    return () => socket.off("teamsUpdated", onTeams);
  }, [soundOn, qsOverrides.headline, qsOverrides.sub]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), TOAST_UNMOUNT_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  const logoUrl = toast?.logo
    ? /^https?:\/\//i.test(String(toast.logo))
      ? toast.logo
      : `${API}${String(toast.logo).startsWith("/") ? toast.logo : `/${toast.logo}`}`
    : null;

  const brandShell = useMemo(
    () => ({
      "--rrp-brand-cyan": "#67e8f9",
      "--rrp-brand-cyan-bright": "#a5f3fc",
      "--rrp-brand-teal": "#0d9488",
      "--rrp-brand-deep": "#0e7490",
      "--rrp-brand-gold": "#fde047",
      "--rrp-brand-gold-mid": "#fbbf24",
      "--rrp-brand-ink": "#020617",
    }),
    [],
  );

  return (
    <div className="rrp-root" aria-live="polite" aria-atomic="true">
      {toast ? (
        <div key={toast.key} className="rrp-card" style={brandShell}>
          <div className="rrp-card__shine" aria-hidden />
          <div className="rrp-card__inner">
            <RecallIcon gradId={iconGradId} />
            <div className="rrp-copy">
              <div className="rrp-copy__badge">RONDO SYSTEM</div>
              <div className="rrp-copy__title">{toast.headline}</div>
              <div className="rrp-copy__sub">{toast.sub}</div>
            </div>
            <div className="rrp-card__accent" aria-hidden>
              <div className="rrp-logo-frame">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="rrp-logo-thumb" loading="eager" decoding="async" fetchPriority="high" />
                ) : (
                  <span className="rrp-logo-ph">{String(toast.team || "TM").slice(0, 2)}</span>
                )}
              </div>
            </div>
          </div>
          <span className="rrp-corner rrp-corner--tl" aria-hidden />
          <span className="rrp-corner rrp-corner--tr" aria-hidden />
          <span className="rrp-corner rrp-corner--bl" aria-hidden />
          <span className="rrp-corner rrp-corner--br" aria-hidden />
        </div>
      ) : null}

      <style>{`
        .rrp-root {
          pointer-events: none;
          margin: 0;
          font-family: "Segoe UI", system-ui, "Bahnschrift", sans-serif;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }
        html, body {
          margin: 0;
          overflow: hidden;
          background: transparent !important;
        }
        .rrp-root {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 8vh;
          z-index: 99999;
        }
        .rrp-card {
          position: relative;
          min-width: min(380px, 90vw);
          max-width: 440px;
          padding: 2px;
          border-radius: 16px;
          background: linear-gradient(
            148deg,
            var(--rrp-brand-cyan-bright) 0%,
            var(--rrp-brand-gold-mid) 38%,
            var(--rrp-brand-teal) 72%,
            var(--rrp-brand-deep) 100%
          );
          box-shadow:
            0 0 0 1px rgba(253, 224, 71, 0.28) inset,
            0 0 52px rgba(34, 211, 238, 0.38),
            0 22px 56px rgba(0, 0, 0, 0.62);
          animation: rrp-pop-in ${POP_ANIM_DURATION_SEC}s cubic-bezier(0.22, 1, 0.36, 1) both;
          transform: translateZ(0);
          will-change: transform, opacity;
        }
        .rrp-card__shine {
          position: absolute;
          inset: 0;
          border-radius: 14px;
          background: linear-gradient(115deg, transparent 26%, rgba(255, 255, 255, 0.14) 50%, transparent 72%);
          mix-blend-mode: soft-light;
          animation: rrp-shine ${Math.min(3.4, POP_ANIM_DURATION_SEC * 0.55)}s ease-out both;
          pointer-events: none;
        }
        .rrp-card__inner {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 16px;
          padding: 16px 18px;
          border-radius: 14px;
          background: linear-gradient(
            180deg,
            rgba(12, 26, 44, 0.97) 0%,
            rgba(6, 12, 22, 0.99) 48%,
            rgba(4, 8, 16, 0.99) 100%
          );
          border: 1px solid rgba(103, 232, 249, 0.28);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.09),
            inset 0 -1px 0 rgba(2, 6, 15, 0.85);
        }
        .rrp-copy {
          flex: 1;
          min-width: 0;
        }
        .rrp-copy__badge {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.32em;
          color: var(--rrp-brand-gold-mid);
          text-shadow:
            0 0 14px rgba(253, 224, 71, 0.45),
            0 0 2px rgba(0, 0, 0, 0.9);
          opacity: 0.98;
          margin-bottom: 5px;
        }
        .rrp-copy__title {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #f8fafc;
          text-transform: uppercase;
          line-height: 1.18;
          text-shadow:
            0 0 28px rgba(34, 211, 238, 0.55),
            0 1px 3px rgba(0, 0, 0, 1);
        }
        .rrp-copy__sub {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(207, 250, 254, 0.88);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rrp-card__accent {
          flex-shrink: 0;
          box-sizing: border-box;
          width: 72px;
          height: 72px;
          padding: 3px;
          border-radius: 14px;
          background: linear-gradient(138deg, var(--rrp-brand-cyan-bright), var(--rrp-brand-gold-mid));
          box-shadow:
            0 0 18px rgba(34, 211, 238, 0.35),
            inset 0 0 0 1px rgba(255, 255, 255, 0.12);
        }
        .rrp-logo-frame {
          width: 100%;
          height: 100%;
          border-radius: 11px;
          overflow: hidden;
          background: var(--rrp-brand-ink);
          display: grid;
          place-items: center;
          box-sizing: border-box;
        }
        .rrp-logo-thumb {
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
          object-position: center;
          transform: translateZ(0);
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          image-rendering: auto;
        }
        .rrp-logo-ph {
          font-size: 17px;
          font-weight: 900;
          color: var(--rrp-brand-cyan-bright);
          letter-spacing: 0.08em;
          text-shadow: 0 0 16px rgba(103, 232, 249, 0.5);
        }
        .rrp-corner {
          position: absolute;
          width: 11px;
          height: 11px;
          border-style: solid;
          pointer-events: none;
          filter: drop-shadow(0 0 4px rgba(103, 232, 249, 0.35));
        }
        .rrp-corner--tl {
          top: 6px; left: 6px;
          border-width: 2px 0 0 2px;
          border-color: var(--rrp-brand-cyan-bright);
          opacity: 0.92;
        }
        .rrp-corner--tr {
          top: 6px; right: 6px;
          border-width: 2px 2px 0 0;
          border-color: var(--rrp-brand-gold);
          opacity: 0.88;
        }
        .rrp-corner--bl {
          bottom: 6px; left: 6px;
          border-width: 0 0 2px 2px;
          border-color: var(--rrp-brand-gold-mid);
          opacity: 0.82;
        }
        .rrp-corner--br {
          bottom: 6px; right: 6px;
          border-width: 0 2px 2px 0;
          border-color: var(--rrp-brand-cyan);
          opacity: 0.9;
        }

        @keyframes rrp-pop-in {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.95) translateZ(0);
            filter: blur(3px);
          }
          10% {
            opacity: 1;
            transform: translateY(0) scale(1.02) translateZ(0);
            filter: blur(0);
          }
          14% {
            transform: translateY(0) scale(1) translateZ(0);
          }
          84% {
            opacity: 1;
            transform: translateY(0) scale(1) translateZ(0);
            filter: none;
          }
          100% {
            opacity: 0;
            transform: translateY(-8px) scale(0.99) translateZ(0);
          }
        }
        @keyframes rrp-shine {
          0% { transform: translateX(-32%); opacity: 0; }
          14% { opacity: 1; }
          48% { transform: translateX(28%); opacity: 0.75; }
          100% { transform: translateX(42%); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rrp-card {
            animation: rrp-pop-in-reduced ${POP_ANIM_DURATION_SEC}s ease-out both;
          }
          .rrp-card__shine { animation: none; }
        }
        @keyframes rrp-pop-in-reduced {
          0% { opacity: 0; }
          10% { opacity: 1; }
          84% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
