import { getApiBase } from "../../apiOrigin";
import { minimalElimStyleFromTheme } from "../minimalGfxUtils";
import "../minimal-broadcast-gfx.css";

const API = getApiBase();

function WingFlourish() {
  return (
    <svg viewBox="0 0 48 32" className="lr-min-elim-flourish" aria-hidden>
      <path d="M4 28 C14 18 22 8 44 4" fill="none" stroke="#f5d060" strokeWidth="3" strokeLinecap="round" />
      <path d="M6 26 C16 16 24 10 42 8" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 24 C18 14 26 12 40 12" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function SupplyCrate() {
  return (
    <div className="lr-min-elim-crate" aria-hidden>
      <svg viewBox="0 0 52 56" className="lr-min-elim-crate-svg">
        <line x1="26" y1="2" x2="14" y2="18" stroke="rgba(220,220,220,.75)" strokeWidth="1.4" />
        <line x1="26" y1="2" x2="38" y2="18" stroke="rgba(220,220,220,.75)" strokeWidth="1.4" />
        <line x1="26" y1="2" x2="26" y2="18" stroke="rgba(220,220,220,.55)" strokeWidth="1.2" />
        <ellipse cx="26" cy="4" rx="14" ry="5" fill="rgba(255,255,255,.18)" />
        <rect x="10" y="18" width="32" height="28" rx="2" fill="#c87820" stroke="#6a4010" strokeWidth="2" />
        <rect x="10" y="18" width="32" height="8" fill="#e89830" />
        <rect x="10" y="26" width="32" height="2" fill="rgba(0,0,0,.18)" />
        <rect x="10" y="36" width="32" height="2" fill="rgba(0,0,0,.18)" />
        <line x1="14" y1="28" x2="38" y2="42" stroke="#4a2808" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="38" y1="28" x2="14" y2="42" stroke="#4a2808" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="22" y="44" width="8" height="4" rx="1" fill="#8a5010" />
      </svg>
    </div>
  );
}

function CombatDropFx() {
  return (
    <div className="lr-min-elim-combat-fx" aria-hidden>
      <div className="lr-min-elim-shockwave" />
      <div className="lr-min-elim-dust">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={`lr-min-elim-dust-puff lr-min-elim-dust-puff--${i}`} />
        ))}
      </div>
      <SupplyCrate />
    </div>
  );
}

/**
 * Tournament-style elimination card — rank + logo left, ELIMS + ELIMINATED right.
 */
export default function MinimalBroadcastEliminationBanner({
  banner,
  theme,
  style,
  animClass = "",
  scale = 1,
  origin = "bottom left",
}) {
  if (!banner) return null;

  const s = style && typeof style === "object" ? style : minimalElimStyleFromTheme(theme);
  const name = String(banner.team || "TEAM").trim() || "TEAM";
  const rank = banner.rank ?? "?";
  const finishes = banner.finishes ?? 0;
  const initials = name.slice(0, 2).toUpperCase();
  const logo = banner.logo;
  const isCombatDrop = animClass.includes("combatDrop");

  const wrapStyle =
    scale === 1
      ? {
          display: "flex",
          position: "relative",
          filter: "drop-shadow(0 8px 22px rgba(0,0,0,.6))",
        }
      : {
          display: "flex",
          position: "relative",
          transform: `scale(${scale})`,
          transformOrigin: origin,
          filter: "drop-shadow(0 6px 18px rgba(0,0,0,.55))",
        };

  return (
    <div
      className={`lr-min-elim-root${isCombatDrop ? " lr-min-elim-combat-drop" : ""}${animClass ? ` ${animClass}` : ""}`}
      style={wrapStyle}
    >
      {isCombatDrop ? <CombatDropFx /> : null}
      <div className="lr-min-elim-card" style={{ boxShadow: s.panelShadow, fontFamily: s.fontFamily }}>
        <div
          className="lr-min-elim-left-panel"
          style={{
            background: s.leftPanelBg,
            color: s.rankBadgeText,
            ["--lr-min-elim-ring"]: s.logoRingColor || s.accentLine || "#00c8c8",
          }}
        >
          <span className="lr-min-elim-rank-badge">#{rank}</span>
          <div className="lr-min-elim-logo-ring">
            {logo ? (
              <img src={`${API}${logo}`} alt="" className="lr-min-elim-logo-img" />
            ) : (
              <span className="lr-min-elim-logo-fallback" style={{ color: s.rankText }}>
                {initials}
              </span>
            )}
          </div>
        </div>

        <div
          className="lr-min-elim-right-panel"
          style={{
            background: s.elimBg,
            color: s.elimText,
            ["--lr-min-elim-divider"]: s.dividerColor || "rgba(255,255,255,.35)",
          }}
        >
          <WingFlourish />
          <div className="lr-min-elim-stats">
            <span className="lr-min-elim-stat-num">{finishes}</span>
            <span className="lr-min-elim-stat-label">ELIMS</span>
          </div>
          <span className="lr-min-elim-divider" aria-hidden />
          <span className="lr-min-elim-status">ELIMINATED</span>
          <span className="lr-min-elim-notch" aria-hidden />
        </div>
      </div>
    </div>
  );
}
