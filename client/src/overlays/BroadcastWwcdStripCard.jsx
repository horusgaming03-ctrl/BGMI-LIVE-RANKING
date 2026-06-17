import { getApiBase } from "../apiOrigin";

const API = getApiBase();

function teamLogoUrl(logo) {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo)) return logo;
  const base = logo.startsWith("/") ? logo : `/${logo}`;
  return `${API}${base}`;
}

function flagUrl(team) {
  const raw = team?.flag || team?.countryFlag || team?.country;
  if (!raw || typeof raw !== "string") return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API}${base}`;
}

/** Small player bust icon — green when alive, grey when knocked/dead. */
function PlayerIcon({ alive, aliveColor, deadColor, size = 17 }) {
  const fill = alive ? aliveColor : deadColor;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden style={{ display: "block", flexShrink: 0 }}>
      <path
        fill={fill}
        d="M10 2.2c-2.9 0-5.2 2-5.2 4.6v1.1h10.4V6.8C15.2 4.2 12.9 2.2 10 2.2zm-6.2 7.1v1.4c0 2.2 2.8 4 6.2 4s6.2-1.8 6.2-4v-1.4H3.8z"
      />
      <ellipse cx="10" cy="6.4" rx="3.2" ry="3.1" fill={fill} />
    </svg>
  );
}

function SquadPlayerIcons({ alivePlayers, aliveColor, deadColor }) {
  const n = Math.max(0, Math.min(4, Number(alivePlayers) || 0));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0, marginLeft: 6 }}>
      {[0, 1, 2, 3].map((i) => (
        <PlayerIcon key={i} alive={i < n} aliveColor={aliveColor} deadColor={deadColor} />
      ))}
    </div>
  );
}

/**
 * Pro broadcast WWCD strip card (BMPS-style) — white card, team row + player icons, red divider, WWCD %.
 * Used when Clean Broadcast (`broadcastLayout`) is the active theme.
 */
export default function BroadcastWwcdStripCard({
  team,
  wwcdPct,
  teamTagBg = "#ffffff",
  teamTagText = "#0a0a0a",
  barGreen = "#22c55e",
  barDead = "#4a4a4a",
  footerBg = "#ffffff",
  footerText = "#e50000",
  dividerColor,
  pctTextColor,
  fontFamily = "'Roboto Condensed', 'Segoe UI', 'Arial Narrow', sans-serif",
  cardWidth = 252,
}) {
  const src = teamLogoUrl(team.logo);
  const flag = flagUrl(team);
  const name = String(team.team || "TEAM").trim().toUpperCase() || "TEAM";
  const divider = dividerColor || footerText || "#e50000";
  const pctColor = pctTextColor || teamTagText || "#0a0a0a";
  const pct = `${Number(wwcdPct ?? 0).toFixed(1)}%`;

  return (
    <div
      style={{
        flex: `0 0 ${cardWidth}px`,
        width: cardWidth,
        minWidth: cardWidth,
        maxWidth: cardWidth,
        display: "flex",
        flexDirection: "column",
        background: teamTagBg,
        boxShadow: "0 2px 10px rgba(0,0,0,.28)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px 9px",
          background: teamTagBg,
          minHeight: 58,
        }}
      >
        {flag ? (
          <img
            src={flag}
            alt=""
            style={{ width: 26, height: 17, objectFit: "cover", borderRadius: 1, flexShrink: 0 }}
          />
        ) : null}
        {src ? (
          <img
            src={src}
            alt=""
            style={{ width: 30, height: 30, objectFit: "contain", flexShrink: 0, filter: "grayscale(1)" }}
          />
        ) : null}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily,
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: 0.4,
            color: teamTagText,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.1,
          }}
        >
          {name}
        </span>
        <SquadPlayerIcons alivePlayers={team.alivePlayers} aliveColor={barGreen} deadColor={barDead} />
      </div>

      <div style={{ height: 2, background: divider, flexShrink: 0 }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px 9px",
          background: footerBg,
          minHeight: 36,
        }}
      >
        <span
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 0.8,
            color: footerText,
            lineHeight: 1,
          }}
        >
          WWCD
        </span>
        <span
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: 0.2,
            color: pctColor,
            lineHeight: 1,
          }}
        >
          {pct}
        </span>
      </div>
    </div>
  );
}
