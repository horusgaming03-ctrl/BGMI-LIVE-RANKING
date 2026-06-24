import { getApiBase } from "../../apiOrigin";
import { cyberpunkElimStyleFromTheme } from "../cyberpunkElimUtils";
import "../cyberpunk-elim-gfx.css";

const API = getApiBase();

function CrosshairIcon({ color }) {
  return (
    <svg viewBox="0 0 24 24" className="lr-cp-elim-crosshair" aria-hidden style={{ color }}>
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="2" x2="12" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="12" x2="7" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="17" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Stacked tournament elimination card — logo square left, TEAM ELIMINATED top-right, rank + team + kills bottom-right.
 */
export default function CyberpunkEliminationBanner({
  banner,
  theme,
  style,
  animClass = "",
  scale = 1,
  origin = "bottom left",
}) {
  if (!banner) return null;

  const s = style && typeof style === "object" ? style : cyberpunkElimStyleFromTheme(theme);
  const name = String(banner.team || "TEAM").trim() || "TEAM";
  const rank = banner.rank ?? "?";
  const finishes = banner.finishes ?? 0;
  const initials = name.slice(0, 2).toUpperCase();
  const logo = banner.logo;

  const anim =
    animClass === "elim-exit"
      ? "lr-cp-elim-anim-exit"
      : animClass === "elim-enter" || animClass.includes("enter")
        ? "lr-cp-elim-anim-enter"
        : animClass;

  const wrapStyle =
    scale === 1
      ? {
          filter: `drop-shadow(0 8px 22px rgba(0,0,0,.6))`,
        }
      : {
          transform: `scale(${scale})`,
          transformOrigin: origin,
          filter: `drop-shadow(0 6px 18px rgba(0,0,0,.55))`,
        };

  return (
    <div className={`lr-cp-elim-root${anim ? ` ${anim}` : ""}`} style={wrapStyle}>
      <div
        className="lr-cp-elim-logo-panel"
        style={{
          background: s.logoPanelBg,
          border: `2px solid ${s.logoBorder}`,
          boxShadow: s.glow,
          fontFamily: s.fontFamily,
        }}
      >
        {logo ? (
          <img src={`${API}${logo}`} alt="" className="lr-cp-elim-logo-img" />
        ) : (
          <span className="lr-cp-elim-logo-fallback" style={{ color: s.rankText }}>
            {initials}
          </span>
        )}
      </div>

      <div className="lr-cp-elim-stack" style={{ fontFamily: s.fontFamily }}>
        <div className="lr-cp-elim-title" style={{ background: s.titleBg, color: s.titleText }}>
          TEAM ELIMINATED
        </div>
        <div className="lr-cp-elim-meta" style={{ background: s.statsBg, color: s.statsText }}>
          <span className="lr-cp-elim-rank" style={{ color: s.rankText }}>
            #{rank}
          </span>
          <span className="lr-cp-elim-team" style={{ color: s.teamText }}>
            {name}
          </span>
          <span className="lr-cp-elim-kills">
            <CrosshairIcon color={s.killIconColor} />
            <span className="lr-cp-elim-kill-num">{finishes}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
