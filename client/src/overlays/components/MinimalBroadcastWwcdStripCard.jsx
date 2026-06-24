import { getApiBase } from "../../apiOrigin";
import "../minimal-broadcast-gfx.css";

const API = getApiBase();

function teamLogoUrl(logo) {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo)) return logo;
  const base = logo.startsWith("/") ? logo : `/${logo}`;
  return `${API}${base}`;
}

function AliveBars({ alivePlayers, barFilled, barDead }) {
  const n = Math.max(0, Math.min(4, Number(alivePlayers) || 0));
  return (
    <div className="lr-min-wwcd-bars" aria-label={`${n} of 4 players up`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="lr-min-wwcd-bar"
          style={{ background: i < n ? barFilled : barDead }}
        />
      ))}
    </div>
  );
}

/**
 * Minimal broadcast WWCD strip card — dark panel, accent line, vertical alive bars.
 */
export default function MinimalBroadcastWwcdStripCard({
  team,
  wwcdPct,
  teamTagBg,
  teamTagText = "#ffffff",
  panelBg,
  accentLine = "#00c8c8",
  barFilled,
  barGreen,
  barDead = "#e63946",
  footerBg = "#111111",
  footerText = "#ffcc00",
  dividerColor = "#00c8c8",
  pctTextColor = "#ffffff",
  fontFamily = "'Roboto Condensed', 'Arial Narrow', sans-serif",
  cardWidth = 220,
}) {
  const src = teamLogoUrl(team.logo);
  const name = String(team.team || "TEAM").trim().toUpperCase() || "TEAM";
  const pct = `${Number(wwcdPct ?? 0).toFixed(1)}%`;
  const aliveBarColor = barFilled ?? barGreen ?? "#00c8c8";
  const teamRowBg =
    panelBg ||
    teamTagBg ||
    "linear-gradient(180deg, #1c1c1c 0%, #0a0a0a 100%)";

  return (
    <div
      className="lr-min-wwcd-card"
      style={{
        width: cardWidth,
        minWidth: cardWidth,
        maxWidth: cardWidth,
        fontFamily,
      }}
    >
      <div className="lr-min-wwcd-accent" style={{ background: accentLine }} />
      <div className="lr-min-wwcd-team" style={{ background: teamRowBg }}>
        {src ? <img src={src} alt="" className="lr-min-wwcd-logo" /> : null}
        <span className="lr-min-wwcd-name" style={{ color: teamTagText }}>
          {name}
        </span>
        <AliveBars alivePlayers={team.alivePlayers} barFilled={aliveBarColor} barDead={barDead} />
      </div>
      <div className="lr-min-wwcd-divider" style={{ background: dividerColor }} />
      <div className="lr-min-wwcd-footer" style={{ background: footerBg }}>
        <span className="lr-min-wwcd-label" style={{ color: footerText }}>
          WWCD
        </span>
        <span className="lr-min-wwcd-pct" style={{ color: pctTextColor }}>
          {pct}
        </span>
      </div>
    </div>
  );
}
