import { getApiBase } from "../../apiOrigin";
import { neonElimStyleFromTheme } from "../neonElimUtils";
import "../neon-elim-gfx.css";

const API = getApiBase();

/**
 * Tournament elimination card — rank panel left, ELIMINATED top-right, logo + TOTAL ELIMS bottom-right.
 */
export default function NeonEliminationBanner({
  banner,
  theme,
  style,
  animClass = "",
  scale = 1,
  origin = "bottom left",
}) {
  if (!banner) return null;

  const s = style && typeof style === "object" ? style : neonElimStyleFromTheme(theme);
  const name = String(banner.team || "TEAM").trim() || "TEAM";
  const rank = banner.rank ?? "?";
  const finishes = banner.finishes ?? 0;
  const initials = name.slice(0, 2).toUpperCase();
  const logo = banner.logo;

  const anim =
    animClass === "elim-exit"
      ? "lr-neon-elim-anim-exit"
      : animClass === "elim-enter" || animClass.includes("enter")
        ? "lr-neon-elim-anim-enter"
        : animClass;

  const wrapStyle =
    scale === 1
      ? { filter: `drop-shadow(0 8px 22px rgba(0,0,0,.6))` }
      : {
          transform: `scale(${scale})`,
          transformOrigin: origin,
          filter: `drop-shadow(0 6px 18px rgba(0,0,0,.55))`,
        };

  return (
    <div className={`lr-neon-elim-root${anim ? ` ${anim}` : ""}`} style={wrapStyle}>
      <div
        className="lr-neon-elim-rank-panel"
        style={{
          background: s.rankPanelBg,
          color: s.rankText,
          fontFamily: s.fontFamily,
          boxShadow: s.glow,
          border: `2px solid ${s.borderColor}`,
        }}
      >
        <span className="lr-neon-elim-rank-num">#{rank}</span>
      </div>

      <div className="lr-neon-elim-right" style={{ fontFamily: s.fontFamily }}>
        <div className="lr-neon-elim-title" style={{ background: s.titleBg, color: s.titleText }}>
          ELIMINATED
        </div>
        <div
          className="lr-neon-elim-stats"
          style={{
            background: s.statsBg,
            color: s.statsText,
            borderRight: `2px solid ${s.borderColor}`,
            borderBottom: `2px solid ${s.borderColor}`,
          }}
        >
          <div className="lr-neon-elim-logo-wrap">
            {logo ? (
              <img src={`${API}${logo}`} alt="" className="lr-neon-elim-logo-img" />
            ) : (
              <span
                className="lr-neon-elim-logo-fallback"
                style={{ background: s.logoFallbackBg, color: s.logoFallbackText }}
              >
                {initials}
              </span>
            )}
          </div>
          <div className="lr-neon-elim-finishes">
            <span className="lr-neon-elim-stat-num" style={{ color: s.statNumColor }}>
              {finishes}
            </span>
            <span className="lr-neon-elim-stat-label" style={{ color: s.statLabelColor }}>
              TOTAL ELIMS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
