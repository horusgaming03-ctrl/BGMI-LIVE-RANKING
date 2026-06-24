import { getApiBase } from "../apiOrigin";

const API = getApiBase();

export const WWCD_STRIP_CARD_WIDTH_PX = 280;

function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return `rgba(255,255,255,${alpha})`;
  const h = hex.replace("#", "");
  if (h.length < 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function teamLogoUrl(logo) {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo)) return logo;
  const base = logo.startsWith("/") ? logo : `/${logo}`;
  return `${API}${base}`;
}

function SquadBars({ alivePlayers, barGreen, barDead, barsBg }) {
  const n = Math.max(0, Math.min(4, Number(alivePlayers) || 0));
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 8,
        padding: "10px 8px",
        background: barsBg,
        minHeight: 72,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 46,
            borderRadius: 0,
            background: i < n ? barGreen : barDead,
            boxShadow: i < n ? "inset 0 -2px 0 rgba(0,0,0,.2)" : "none",
          }}
        />
      ))}
    </div>
  );
}

/** Single squad card for `/overlay/wwcd-only` and admin gfx preview. */
export default function WwcdStripTeamCard({
  team,
  wwcdPct,
  logoBoxBg,
  barGreen,
  barDead,
  barsBg,
  footerBg,
  footerText,
  initialsColor,
  fontFamily = "'Segoe UI', 'Inter', system-ui, sans-serif",
  cardBoxShadow,
  cardWidth = WWCD_STRIP_CARD_WIDTH_PX,
}) {
  const src = teamLogoUrl(team.logo);
  const initials = String(team.team || "TM")
    .slice(0, 3)
    .toUpperCase();
  const shadow =
    cardBoxShadow ?? `0 8px 28px rgba(0,0,0,.45), 0 0 0 1px ${hexToRgba(footerText, 0.14)}`;

  return (
    <div
      style={{
        flex: `0 0 ${cardWidth}px`,
        width: cardWidth,
        minWidth: cardWidth,
        maxWidth: cardWidth,
        display: "flex",
        flexDirection: "column",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: shadow,
      }}
    >
      <div style={{ display: "flex", flexDirection: "row", minHeight: 76 }}>
        <div
          style={{
            width: "42%",
            minWidth: 72,
            background: logoBoxBg,
            display: "grid",
            placeItems: "center",
            padding: 6,
          }}
        >
          {src ? (
            <img src={src} alt="" style={{ width: "100%", height: "100%", maxHeight: 64, objectFit: "contain" }} />
          ) : (
            <span style={{ fontWeight: 900, fontSize: 18, color: initialsColor, letterSpacing: 1 }}>{initials}</span>
          )}
        </div>
        <SquadBars alivePlayers={team.alivePlayers} barGreen={barGreen} barDead={barDead} barsBg={barsBg} />
      </div>
      <div
        style={{
          background: footerBg,
          color: footerText,
          fontWeight: 900,
          fontSize: 15,
          letterSpacing: 1.2,
          textAlign: "center",
          padding: "10px 8px",
          textTransform: "uppercase",
          fontFamily,
        }}
      >
        WWCD - {wwcdPct}%
      </div>
    </div>
  );
}

export function wwcdStripStyleFromColors(stripColors) {
  const c = stripColors;
  if (c.minimalBroadcastLayout) {
    return {
      minimalBroadcastLayout: true,
      broadcastLayout: true,
      teamTagBg: c.teamTagBg,
      teamTagText: c.teamTagText || "#ffffff",
      panelBg: c.panelBg,
      accentLine: c.accentLine || "#00c8c8",
      footerBg: c.footerBg || "#111111",
      footerText: c.footerText || "#ffcc00",
      dividerColor: c.dividerColor || c.accentLine || "#00c8c8",
      pctTextColor: c.pctTextColor || "#ffffff",
      barFilled: c.barFilled ?? c.barGreen,
      barDead: c.barDead,
      fontFamily: c.fontFamily || "'Roboto Condensed', 'Arial Narrow', sans-serif",
      cardWidth: c.cardWidth || 220,
    };
  }
  if (c.broadcastLayout) {
    return {
      broadcastLayout: true,
      teamTagBg: c.teamTagBg || "#ffffff",
      teamTagText: c.teamTagText || c.footerText || "#0a0a0a",
      footerBg: c.footerBg || c.teamTagBg || "#ffffff",
      footerText: c.footerText,
      dividerColor: c.dividerColor || c.footerText || "#e50000",
      pctTextColor: c.pctTextColor || c.teamTagText || "#0a0a0a",
      barGreen: c.barFilled,
      barDead: c.barDead,
      barsBg: c.barsBg,
      logoBoxBg: c.logoBoxBg,
      initialsColor: c.initialsColor,
      fontFamily: c.fontFamily || "'Roboto Condensed', 'Segoe UI', 'Arial Narrow', sans-serif",
      cardBoxShadow: "0 2px 10px rgba(0,0,0,.28)",
      cardWidth: 252,
    };
  }
  return {
    footerBg: c.footerBg,
    footerText: c.footerText,
    barGreen: c.barFilled,
    barDead: c.barDead,
    barsBg: c.barsBg,
    logoBoxBg: c.logoBoxBg,
    initialsColor: c.initialsColor,
    fontFamily: "'Segoe UI', 'Inter', system-ui, sans-serif",
    cardBoxShadow: `0 8px 28px rgba(0,0,0,.45), 0 0 0 1px ${hexToRgba(c.footerText, 0.14)}`,
  };
}
