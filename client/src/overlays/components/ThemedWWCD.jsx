import { memo, useState, useEffect, useMemo } from "react";
import { getApiBase } from "../../apiOrigin";

const API = getApiBase();

function ThemedWWCD({ winner, theme, anim, overlayAnim, config }) {
  const [phase, setPhase] = useState(0);
  const [showParticles, setShowParticles] = useState(false);

  const primary = theme?.colors?.primary || "#ff4655";
  const gold = theme?.colors?.gold || "#FFD700";
  const accent = theme?.colors?.accent || primary;

  useEffect(() => {
    if (!winner) return;
    setPhase(0);
    setShowParticles(false);
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 800);
    const t3 = setTimeout(() => setPhase(3), 1500);
    const t4 = setTimeout(() => setShowParticles(true), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [winner]);

  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      size: 2 + Math.random() * 4,
      dur: 2 + Math.random() * 3,
      color: [gold, primary, accent, "#fff"][Math.floor(Math.random() * 4)],
    })), [gold, primary, accent]);

  const sparks = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      angle: (360 / 16) * i,
      dist: 120 + Math.random() * 80,
      delay: Math.random() * 0.6,
      size: 2 + Math.random() * 3,
      color: i % 2 === 0 ? gold : primary,
    })), [gold, primary]);

  if (!winner) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0)",
      display: "grid", placeItems: "center",
      animation: "wwcd-overlayIn 0.6s ease-out forwards",
      fontFamily: theme?.typography?.fontFamily || "Inter, sans-serif",
      overflow: "hidden",
    }}>
      {showParticles && particles.map((p) => (
        <div key={p.id} style={{
          position: "absolute", bottom: -10,
          left: `${p.left}%`,
          width: p.size, height: p.size,
          background: p.color,
          borderRadius: "50%",
          animation: `wwcd-particleRise ${p.dur}s ${p.delay}s ease-out infinite`,
          opacity: 0,
        }} />
      ))}

      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at center, ${primary}15 0%, transparent 70%)`,
        animation: "wwcd-bgPulse 3s ease-in-out infinite",
      }} />

      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 600, height: 600,
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        border: `2px solid ${primary}30`,
        animation: phase >= 1 ? "wwcd-ringExpand 1.2s ease-out forwards" : "none",
        opacity: 0,
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 400, height: 400,
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        border: `1px solid ${gold}20`,
        animation: phase >= 1 ? "wwcd-ringExpand 1.4s 0.2s ease-out forwards" : "none",
        opacity: 0,
      }} />

      {phase >= 2 && sparks.map((s) => (
        <div key={s.id} style={{
          position: "absolute", top: "50%", left: "50%",
          width: s.size, height: s.size,
          background: s.color,
          borderRadius: "50%",
          boxShadow: `0 0 6px ${s.color}`,
          animation: `wwcd-sparkBurst 1s ${s.delay}s ease-out forwards`,
          transformOrigin: "center",
          opacity: 0,
        }} />
      ))}

      <div style={{
        position: "relative",
        textAlign: "center",
        padding: "50px 60px",
        minWidth: 580,
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(180deg, ${primary}08 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.92) 70%, ${primary}08 100%)`,
          border: `1px solid ${primary}40`,
          backdropFilter: "blur(20px)",
          opacity: phase >= 1 ? 1 : 0,
          transition: "opacity 0.5s ease",
        }} />

        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${primary}, ${gold}, ${primary}, transparent)`,
          animation: phase >= 1 ? "wwcd-lineReveal 0.8s ease-out forwards" : "none",
          transformOrigin: "center",
          transform: "scaleX(0)",
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${primary}, ${gold}, ${primary}, transparent)`,
          animation: phase >= 1 ? "wwcd-lineReveal 0.8s 0.1s ease-out forwards" : "none",
          transformOrigin: "center",
          transform: "scaleX(0)",
        }} />
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 2,
          background: `linear-gradient(180deg, transparent, ${primary}80, transparent)`,
          animation: phase >= 1 ? "wwcd-sideReveal 0.6s 0.3s ease-out forwards" : "none",
          opacity: 0,
        }} />
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 2,
          background: `linear-gradient(180deg, transparent, ${primary}80, transparent)`,
          animation: phase >= 1 ? "wwcd-sideReveal 0.6s 0.3s ease-out forwards" : "none",
          opacity: 0,
        }} />

        <div style={{
          position: "relative",
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? "translateY(0)" : "translateY(-20px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
            marginBottom: 8,
          }}>
            <div style={{
              width: 60, height: 1,
              background: `linear-gradient(90deg, transparent, ${gold})`,
            }} />
            <span style={{
              fontSize: 12, fontWeight: 800, letterSpacing: 6,
              color: gold,
              textTransform: "uppercase",
            }}>Winner Winner</span>
            <div style={{
              width: 60, height: 1,
              background: `linear-gradient(270deg, transparent, ${gold})`,
            }} />
          </div>
        </div>

        <div style={{
          position: "relative",
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? "scale(1)" : "scale(0.7)",
          transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s",
        }}>
          <div style={{
            fontSize: 72, fontWeight: 900, lineHeight: 1,
            letterSpacing: 6,
            background: `linear-gradient(180deg, #fff 0%, ${gold} 50%, ${primary} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: `drop-shadow(0 0 30px ${primary}60)`,
            textTransform: "uppercase",
          }}>
            Chicken Dinner
          </div>
        </div>

        <div style={{
          position: "relative",
          marginTop: 30,
          opacity: phase >= 3 ? 1 : 0,
          transform: phase >= 3 ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <div style={{
            width: 200, height: 1, margin: "0 auto 20px",
            background: `linear-gradient(90deg, transparent, ${primary}80, transparent)`,
          }} />

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 20,
          }}>
            {winner.logo && (
              <div style={{
                width: 72, height: 72,
                borderRadius: 8,
                overflow: "hidden",
                border: `2px solid ${gold}60`,
                boxShadow: `0 0 20px ${primary}40`,
                animation: "wwcd-logoPulse 2s ease-in-out infinite",
              }}>
                <img
                  src={`${API}${winner.logo}`}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
            <div style={{ textAlign: winner.logo ? "left" : "center" }}>
              <div style={{
                fontSize: 14, fontWeight: 700, letterSpacing: 3,
                color: `${gold}aa`,
                textTransform: "uppercase",
                marginBottom: 4,
              }}>Champion</div>
              <div style={{
                fontSize: 36, fontWeight: 900,
                color: "#fff",
                textShadow: `0 0 20px ${primary}60`,
                letterSpacing: 2,
              }}>{winner.team}</div>
            </div>
          </div>
        </div>

        <div style={{
          position: "absolute", top: 10, left: 20,
          width: 8, height: 8, borderTop: `2px solid ${gold}60`, borderLeft: `2px solid ${gold}60`,
          opacity: phase >= 1 ? 0.8 : 0, transition: "opacity 0.5s 0.4s",
        }} />
        <div style={{
          position: "absolute", top: 10, right: 20,
          width: 8, height: 8, borderTop: `2px solid ${gold}60`, borderRight: `2px solid ${gold}60`,
          opacity: phase >= 1 ? 0.8 : 0, transition: "opacity 0.5s 0.4s",
        }} />
        <div style={{
          position: "absolute", bottom: 10, left: 20,
          width: 8, height: 8, borderBottom: `2px solid ${gold}60`, borderLeft: `2px solid ${gold}60`,
          opacity: phase >= 1 ? 0.8 : 0, transition: "opacity 0.5s 0.4s",
        }} />
        <div style={{
          position: "absolute", bottom: 10, right: 20,
          width: 8, height: 8, borderBottom: `2px solid ${gold}60`, borderRight: `2px solid ${gold}60`,
          opacity: phase >= 1 ? 0.8 : 0, transition: "opacity 0.5s 0.4s",
        }} />
      </div>

      <style>{`
        @keyframes wwcd-overlayIn {
          from { background: rgba(0,0,0,0); }
          to   { background: rgba(0,0,0,0.92); }
        }
        @keyframes wwcd-bgPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%      { opacity: 0.6; transform: scale(1.05); }
        }
        @keyframes wwcd-ringExpand {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
          50%  { opacity: 0.6; }
          to   { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
        }
        @keyframes wwcd-lineReveal {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes wwcd-sideReveal {
          from { opacity: 0; }
          to   { opacity: 0.8; }
        }
        @keyframes wwcd-sparkBurst {
          0%   { opacity: 1; transform: translateY(-20px) scale(1); }
          100% { opacity: 0; transform: translateY(-180px) scale(0.3); }
        }
        @keyframes wwcd-particleRise {
          0%   { opacity: 0; transform: translateY(0) scale(1); }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-100vh) scale(0.3); }
        }
        @keyframes wwcd-logoPulse {
          0%, 100% { box-shadow: 0 0 20px ${primary}40; }
          50%      { box-shadow: 0 0 40px ${primary}70, 0 0 60px ${gold}30; }
        }
      `}</style>
    </div>
  );
}

export default memo(ThemedWWCD);
