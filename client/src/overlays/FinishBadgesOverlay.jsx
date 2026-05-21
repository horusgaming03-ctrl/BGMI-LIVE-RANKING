import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import socket, { API } from "./socket";
import { normalizeMatchMeta } from "../normalizeMatchMeta";
import { getRondoRecallChargesRemaining } from "../rondo/recallCharges.js";
import { buildLiveRankingOrder } from "../teamDisplayOrder";

/** BGMI-style finish (kill) pill + skull — /overlay/finish-badges (standalone from match board). */
const RED_PILL = "#dc2626";
const RED_EDGE = "#b91c1c";
const PANEL_BG = "#12151d";
const SKULL_FILL = "#c9a569";

const RONDO_CYAN = "#22d3ee";
const RONDO_VIOLET = "#a855f7";
const RONDO_PILL_TOP = "#0ea5e9";
const RONDO_PILL_BOT = "#7c3aed";

function teamLogoHref(logo) {
  if (!logo) return null;
  const base = String(logo).startsWith("/") ? logo : `/${logo}`;
  return `${API}${base}`;
}

function SkullGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
      <ellipse cx="12" cy="13.5" rx="9.2" ry="10" fill={SKULL_FILL} />
      <circle cx="8.8" cy="12.8" r="2.35" fill="#1f170d" opacity={0.92} />
      <circle cx="15.2" cy="12.8" r="2.35" fill="#1f170d" opacity={0.92} />
      <path fill="#2a2318" opacity={0.45} d="M7 19.5 Q12 21.8 17 19.5 L16 21.8 Q12 23.8 8 21.8 Z" />
    </svg>
  );
}

/** @param {'up' | 'down' | undefined} pulse */
function FinishKillBadge({ value, pulse, variant }) {
  const rondo = variant === "rondo";
  const pillGrad = rondo ? `linear-gradient(180deg, ${RONDO_PILL_TOP}, ${RONDO_PILL_BOT})` : `linear-gradient(180deg, ${RED_PILL}, ${RED_EDGE})`;
  const skullTint = rondo ? RONDO_CYAN : SKULL_FILL;
  return (
    <div
      className={
        pulse === "up" ? "fbo-box fbo-box--up" : pulse === "down" ? "fbo-box fbo-box--down" : "fbo-box"
      }
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "8px 10px",
        borderRadius: 12,
        background: `linear-gradient(180deg, ${PANEL_BG} 0%, #0b0e14 100%)`,
        border: rondo ? `1px solid rgba(34,211,238,.22)` : "1px solid rgba(255,255,255,.08)",
        boxShadow: rondo ? "inset 0 1px 0 rgba(255,255,255,.06), 0 4px 18px rgba(13,148,136,.28)" : "inset 0 1px 0 rgba(255,255,255,.05), 0 4px 14px rgba(0,0,0,.45)",
      }}
    >
      <div
        className="fbo-pill"
        style={{
          minWidth: 44,
          padding: "4px 12px",
          borderRadius: 999,
          background: pillGrad,
          border: "1px solid rgba(255,255,255,.12)",
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.05 }}>{value}</span>
      </div>
      {rondo ? (
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
          <ellipse cx="12" cy="13.5" rx="9.2" ry="10" fill={skullTint} opacity={0.88} />
          <circle cx="8.8" cy="12.8" r="2.35" fill="#0c1220" opacity={0.95} />
          <circle cx="15.2" cy="12.8" r="2.35" fill="#0c1220" opacity={0.95} />
          <path fill="#0c1220" opacity={0.5} d="M7 19.5 Q12 21.8 17 19.5 L16 21.8 Q12 23.8 8 21.8 Z" />
        </svg>
      ) : (
        <SkullGlyph />
      )}
    </div>
  );
}

/** Recall / elimination broadcast chips for Rondo skin */
function RondoRecallStrip({ status, awaitingRecall, alivePlayers, chargesRemaining }) {
  const st = String(status || "").toLowerCase();
  const rawAp = Number(alivePlayers);
  const ap = Number.isFinite(rawAp) ? Math.max(0, Math.min(4, rawAp)) : 4;
  const credits = Math.max(0, Math.min(4, Number(chargesRemaining) || 0));

  if (st === "rondo_benched" && awaitingRecall && credits > 0) {
    return (
      <div className="fbo-rondo-chip fbo-rondo-chip--recall">
        <span className="fbo-rondo-bolt" aria-hidden>
          ⚡
        </span>
        BENCH · {credits} CR
      </div>
    );
  }

  const partialRecallReady =
    credits > 0 &&
    st !== "eliminated" &&
    st !== "rondo_benched" &&
    ap >= 1 &&
    ap <= 3 &&
    (st === "alive" || st === "knocked");

  if (partialRecallReady) {
    return (
      <div className="fbo-rondo-chip fbo-rondo-chip--recall" title={`${credits} per-player recall credit(s); choose admin Recall +N to spend N`}>
        <span className="fbo-rondo-bolt" aria-hidden>
          ⚡
        </span>
        RECALL {ap}/4 · {credits}CR
      </div>
    );
  }

  if (st === "eliminated" && credits <= 0) {
    return <div className="fbo-rondo-chip fbo-rondo-chip--final">FINAL OUT</div>;
  }
  if ((st === "alive" || st === "knocked") && credits <= 0) {
    return (
      <div className="fbo-rondo-chip fbo-rondo-chip--spent" title="All per-player recall credits used">
        NO CREDITS
      </div>
    );
  }
  return null;
}

export default function FinishBadgesOverlay() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const interactive = params?.get("interactive") === "1" || params?.get("interactive") === "true";
  /** stable=1 preserves team id order (like admin knock rows); default = live standings sort */
  const stableOrder = params?.get("stable") === "1";

  const pathForceRondo =
    typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "").includes("/overlay/rondo/finish-badges");

  const [teams, setTeams] = useState([]);
  const [matchMeta, setMatchMeta] = useState(null);
  const [autoCalculate, setAutoCalculate] = useState(true);
  const prevFinRef = useRef({});
  const rondoTeamSnapRef = useRef({});
  const [pulseMap, setPulseMap] = useState({});
  const [recallFlashMap, setRecallFlashMap] = useState({});

  const isRondoVisual = Boolean(pathForceRondo || normalizeMatchMeta(matchMeta)?.map === "rondo");
  const badgeVariant = isRondoVisual ? "rondo" : "standard";

  useEffect(() => {
    const onMatch = (data) => {
      const meta = normalizeMatchMeta(data);
      if (meta) setMatchMeta(meta);
    };
    socket.on("matchUpdated", onMatch);
    socket.emit("requestMatch");
    return () => socket.off("matchUpdated", onMatch);
  }, []);

  useEffect(() => {
    const onSettings = (s) => {
      if (s && typeof s === "object" && typeof s.autoCalculate === "boolean") setAutoCalculate(s.autoCalculate);
    };
    socket.on("settingsUpdated", onSettings);
    socket.emit("requestSettings");

    const onTeams = (data) => setTeams(Array.isArray(data) ? data : []);
    socket.on("teamsUpdated", onTeams);
    socket.emit("requestTeams");

    return () => {
      socket.off("teamsUpdated", onTeams);
      socket.off("settingsUpdated", onSettings);
    };
  }, []);

  useEffect(() => {
    const nextPulse = {};
    teams.forEach((t) => {
      const id = t.id;
      const n = Math.max(0, Number(t.finishes) || 0);
      const p = prevFinRef.current[id];
      if (typeof p === "number" && p !== n) nextPulse[id] = n > p ? "up" : "down";
      prevFinRef.current[id] = n;
    });
    if (Object.keys(nextPulse).length > 0) {
      setPulseMap((prev) => ({ ...prev, ...nextPulse }));
      window.setTimeout(() => {
        setPulseMap((prev) => {
          const c = { ...prev };
          for (const id of Object.keys(nextPulse)) delete c[id];
          return c;
        });
      }, 550);
    }
  }, [teams]);

  useEffect(() => {
    if (!isRondoVisual) return;
    const nextFlash = {};
    teams.forEach((t) => {
      const id = t.id;
      const st = String(t.status || "").toLowerCase();
      const rawAp = Number(t.alivePlayers);
      const ap = Number.isFinite(rawAp) ? Math.max(0, Math.min(4, rawAp)) : st === "rondo_benched" ? 0 : 4;
      const charges = getRondoRecallChargesRemaining(t);
      const prev = rondoTeamSnapRef.current[id];

      let flash = false;
      if (prev) {
        if (prev.st === "rondo_benched" && (st === "alive" || st === "knocked")) flash = true;
        else if (prev.charges > charges && ap > prev.ap) flash = true;
      }
      if (flash) nextFlash[id] = true;
      rondoTeamSnapRef.current[id] = { st, ap, charges };
    });
    if (Object.keys(nextFlash).length > 0) {
      setRecallFlashMap((m) => ({ ...m, ...nextFlash }));
      window.setTimeout(() => {
        setRecallFlashMap((m) => {
          const c = { ...m };
          for (const id of Object.keys(nextFlash)) delete c[id];
          return c;
        });
      }, 1400);
    }
  }, [teams, isRondoVisual]);

  const ordered = useMemo(() => {
    const copy = [...teams];
    if (stableOrder) {
      copy.sort((a, b) => {
        const ida = Number(a.id),
          idb = Number(b.id);
        if (!Number.isNaN(ida) && !Number.isNaN(idb) && ida !== idb) return ida - idb;
        return String(a.team || "").localeCompare(String(b.team || ""));
      });
      return copy;
    }
    return buildLiveRankingOrder(copy);
  }, [teams, stableOrder]);

  const adjustFinishes = useCallback(
    async (team, delta) => {
      const nextFin = Math.max(0, Number(team.finishes || 0) + delta);
      const pos = Number(team.positionPoints) || 0;
      const payload = {
        team: team.team,
        status: team.status,
        finishes: nextFin,
        points: autoCalculate ? nextFin + pos : Math.max(0, Number(team.points || 0) + delta),
      };
      try {
        await fetch(`${API}/teams/${team.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (_) {
        /* ignore */
      }
    },
    [autoCalculate],
  );

  return (
    <div
      className={isRondoVisual ? "fbo-root fbo-root--rondo" : "fbo-root"}
      style={{
        width: "100vw",
        minHeight: "100vh",
        padding: "2.2vh 2.2vw",
        background: "transparent",
        fontFamily: "'Rajdhani', 'Inter', system-ui, sans-serif",
      }}
    >
      {isRondoVisual ? (
        <div className="fbo-rondo-badge" aria-hidden>
          <span>Rondo</span>
          <span className="fbo-rondo-sub">Recall Overlay</span>
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        {ordered.map((team, i) => {
          const fins = Math.max(0, Number(team.finishes) || 0);
          const logo = teamLogoHref(team.logo);
          const st = String(team.status || "").toLowerCase();
          const eliminated = st === "eliminated";
          const benched = st === "rondo_benched";
          const creditsLeft = getRondoRecallChargesRemaining(team);
          const awaitingRecall = Boolean(team.rondoAwaitingRecall);
          const rawAlive = Number(team.alivePlayers);
          const aliveN = Number.isFinite(rawAlive) ? Math.max(0, Math.min(4, rawAlive)) : 4;
          const partialRecallGlow =
            isRondoVisual &&
            !eliminated &&
            !benched &&
            creditsLeft > 0 &&
            aliveN >= 1 &&
            aliveN <= 3 &&
            (st === "alive" || st === "knocked");

          const rowClass = [
            "fbo-row",
            recallFlashMap[team.id] ? "fbo-row--recalled" : "",
            benched ? "fbo-row--benched" : "",
            partialRecallGlow ? "fbo-row--partial" : "",
            eliminated && creditsLeft <= 0 ? "fbo-row--final" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const borderGlow = isRondoVisual ? (benched ? `1px solid rgba(34,211,238,.45)` : `1px solid rgba(167,139,250,.14)`) : "none";
          const rowBg = isRondoVisual ? "rgba(8,14,26,.72)" : "transparent";

          return (
            <div
              key={team.id}
              className={rowClass}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: isRondoVisual ? "10px 12px" : "0",
                margin: isRondoVisual ? "0 -4px" : 0,
                borderRadius: isRondoVisual ? 14 : 0,
                border: borderGlow !== "none" ? borderGlow : undefined,
                background: isRondoVisual ? rowBg : "transparent",
                opacity: eliminated ? 0.68 : benched ? 0.95 : 1,
                filter: eliminated ? "saturate(0.74)" : benched ? "saturate(1.05)" : "none",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: eliminated ? "#6b7585" : benched ? RONDO_CYAN : "#9aa4b8",
                  minWidth: 32,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                #{i + 1}
              </div>
              {logo ? (
                <img
                  alt=""
                  src={logo}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    objectFit: "cover",
                    border: isRondoVisual ? `1px solid rgba(34,211,238,.2)` : "1px solid rgba(255,255,255,.1)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    border: `1px solid ${isRondoVisual ? `${RONDO_CYAN}55` : `${RED_EDGE}77`}`,
                    display: "grid",
                    placeItems: "center",
                    background: "#0d1018",
                    color: isRondoVisual ? RONDO_CYAN : SKULL_FILL,
                    fontWeight: 900,
                    fontSize: 11,
                  }}
                >
                  {String(team.team || "").slice(0, 2)}
                </div>
              )}
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 16,
                  color: eliminated ? "#7d8696" : benched ? "#e2faff" : "#f1f5f9",
                  minWidth: 0,
                  maxWidth: interactive ? "min(28vw, 160px)" : "min(40vw, 240px)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {team.team}
              </span>
              {isRondoVisual ? (
                <RondoRecallStrip
                  status={team.status}
                  awaitingRecall={awaitingRecall}
                  alivePlayers={team.alivePlayers}
                  chargesRemaining={creditsLeft}
                />
              ) : null}
              {interactive ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "stretch" }}>
                  <button type="button" className={`fbo-mini ${isRondoVisual ? "fbo-mini--rondo" : ""}`} title="+1 finish" onClick={() => void adjustFinishes(team, 1)}>
                    ▲
                  </button>
                  <button type="button" className={`fbo-mini ${isRondoVisual ? "fbo-mini--rondo" : ""}`} title="-1 finish" onClick={() => void adjustFinishes(team, -1)}>
                    ▼
                  </button>
                </div>
              ) : null}
              <FinishKillBadge value={fins} pulse={pulseMap[team.id]} variant={badgeVariant} />
            </div>
          );
        })}
      </div>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow-x: hidden; overflow-y: auto; background: transparent; }

        .fbo-root--rondo {
          position: relative;
        }
        .fbo-rondo-badge {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: 6px 14px 10px 0;
          margin-bottom: 4px;
          font-weight: 900;
          letter-spacing: 0.35em;
          font-size: 10px;
          color: rgba(34,211,238,.92);
          text-shadow: 0 0 18px rgba(34,211,238,.38);
          text-transform: uppercase;
        }
        .fbo-rondo-sub {
          letter-spacing: 0.2em;
          font-size: 9px;
          color: rgba(167,139,250,.82);
          text-shadow: 0 0 12px rgba(167,139,250,.3);
        }
        .fbo-rondo-chip {
          flex-shrink: 0;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.12em;
          padding: 5px 8px;
          border-radius: 8px;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .fbo-rondo-chip--recall {
          color: #042f2e;
          background: linear-gradient(135deg, ${RONDO_CYAN}, ${RONDO_VIOLET});
          box-shadow: 0 0 20px rgba(34,211,238,.42);
          animation: fbo-rondo-pulse 1.65s ease-in-out infinite;
        }
        .fbo-rondo-chip--spent {
          color: #c4d9e8;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(167,139,250,.35);
          letter-spacing: 0.08em;
        }
        .fbo-rondo-chip--final {
          color: #fecaca;
          background: linear-gradient(135deg, rgba(248,113,113,.25), rgba(127,29,29,.42));
          border: 1px solid rgba(248,113,113,.42);
          letter-spacing: 0.06em;
        }
        .fbo-rondo-bolt { margin-right: 3px; }

        .fbo-row--benched {
          animation: fbo-rondo-row-glow 2.4s ease-in-out infinite;
        }
        .fbo-row--partial {
          animation: fbo-rondo-row-glow 2.8s ease-in-out infinite;
        }
        .fbo-row--recalled {
          animation: fbo-rondo-recalled 1.36s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .fbo-row--final {
          opacity: 0.72 !important;
        }

        @keyframes fbo-rondo-pulse {
          0%, 100% { filter: brightness(1); transform: translateZ(0); }
          50% { filter: brightness(1.12); transform: translateZ(0) scale(1.03); }
        }
        @keyframes fbo-rondo-row-glow {
          0%, 100% { box-shadow: 0 0 0 rgba(34,211,238,0), inset 0 0 0 rgba(167,139,250,0); }
          50% { box-shadow: 0 0 26px rgba(34,211,238,.26), inset 0 1px 0 rgba(167,139,250,.12); }
        }
        @keyframes fbo-rondo-recalled {
          0% { filter: brightness(1.65) saturate(1.25); transform: scale(1.02); box-shadow: 0 0 0 rgba(34,211,238,0); }
          40% { box-shadow: 0 0 32px rgba(34,211,238,.52); }
          100% { filter: brightness(1) saturate(1); transform: scale(1); box-shadow: 0 0 12px rgba(34,211,238,0); }
        }

        @keyframes fbo-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.11); filter: brightness(1.08); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes fbo-ring {
          0% { box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 4px 14px rgba(0,0,0,.45), 0 0 0 0 rgba(220,38,38,0); }
          55% { box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 6px 22px rgba(0,0,0,.52), 0 0 18px rgba(248,113,113,.42); }
          100% { box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 4px 14px rgba(0,0,0,.45), 0 0 0 rgba(220,38,38,0); }
        }
        @keyframes fbo-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }

        .fbo-root--rondo .fbo-box--up .fbo-pill {
          animation: fbo-pop 0.48s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .fbo-root--rondo .fbo-box--up {
          animation: fbo-ring-rondo 0.72s ease-out forwards;
        }
        @keyframes fbo-ring-rondo {
          0% { box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 4px 18px rgba(13,148,136,.28), 0 0 0 0 rgba(34,211,238,0); }
          55% { box-shadow: inset 0 1px 0 rgba(255,255,255,.09), 0 6px 24px rgba(13,148,136,.42), 0 0 22px rgba(167,139,250,.45); }
          100% { box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 4px 18px rgba(13,148,136,.28), 0 0 0 rgba(34,211,238,0); }
        }
        .fbo-box--up .fbo-pill {
          animation: fbo-pop 0.48s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .fbo-box--up {
          animation: fbo-ring 0.62s ease-out forwards;
        }
        .fbo-box--down {
          animation: fbo-shake 0.32s ease-in-out;
        }

        .fbo-mini {
          width: 30px;
          padding: 1px 0;
          font-size: 10px;
          font-weight: 900;
          line-height: 1;
          border-radius: 6px;
          border: 1px solid rgba(120,212,232,.35);
          background: rgba(18,52,61,.92);
          color: #94eafd;
          cursor: pointer;
        }
        .fbo-mini--rondo {
          border-color: rgba(34,211,238,.42);
          background: rgba(12,52,76,.94);
          color: #bff6ff;
        }
        .fbo-mini:hover {
          filter: brightness(1.12);
        }
        .fbo-mini:active {
          transform: scale(0.94);
        }

        @media (prefers-reduced-motion: reduce) {
          .fbo-row--benched, .fbo-row--partial, .fbo-row--recalled, .fbo-rondo-chip--recall {
            animation: none !important;
          }
          .fbo-box--up .fbo-pill,
          .fbo-box--up,
          .fbo-box--down {
            animation: none !important;
          }
          .fbo-root--rondo .fbo-box--up {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
