import { useEffect, useMemo, useState } from "react";
import { getTheme, getThemeNames } from "./themes";
import socket, { API } from "./socket";
import { mergeThemeOverride } from "./utils/mergeThemeOverride";
import { wwcdPercentsForStripTeams, stripTeamsFromAlive } from "../wwcdModel";

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
        gap: 6,
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
            borderRadius: 3,
            background: i < n ? barGreen : barDead,
            boxShadow: i < n ? "inset 0 -2px 0 rgba(0,0,0,.2)" : "none",
          }}
        />
      ))}
    </div>
  );
}

/** Fixed pixel width — same card size whether 1, 2, 3, or 4 squads; row stays centered */
const CARD_STRIP_FIXED_PX = 280;

function TeamCard({
  team,
  wwcdPct,
  logoBoxBg,
  barGreen,
  barDead,
  barsBg,
  footerBg,
  footerText,
  initialsColor,
  fontFamily,
  cardBoxShadow,
}) {
  const src = teamLogoUrl(team.logo);
  const initials = String(team.team || "TM")
    .slice(0, 3)
    .toUpperCase();

  return (
    <div
      style={{
        flex: `0 0 ${CARD_STRIP_FIXED_PX}px`,
        width: CARD_STRIP_FIXED_PX,
        minWidth: CARD_STRIP_FIXED_PX,
        maxWidth: CARD_STRIP_FIXED_PX,
        display: "flex",
        flexDirection: "column",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: cardBoxShadow,
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

export default function WwcFourAliveStripOverlay() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const debug = params.get("debug") === "1";
  const position = params.get("position") === "bottom" ? "bottom" : "center";
  const urlTheme = params.get("theme");

  const [teams, setTeams] = useState([]);
  const [liveTheme, setLiveTheme] = useState(urlTheme || "esports");
  const [themeColorOverrides, setThemeColorOverrides] = useState({});

  useEffect(() => {
    const onSettings = (s) => {
      if (!s || typeof s !== "object") return;
      setThemeColorOverrides(s?.themeColorOverrides && typeof s.themeColorOverrides === "object" ? s.themeColorOverrides : {});
    };
    socket.on("settingsUpdated", onSettings);
    socket.emit("requestSettings");
    fetch(`${API}/settings`)
      .then((r) => r.json())
      .then(onSettings)
      .catch(() => {});
    return () => socket.off("settingsUpdated", onSettings);
  }, []);

  useEffect(() => {
    if (urlTheme) {
      if (getThemeNames().includes(urlTheme)) setLiveTheme(urlTheme);
      return undefined;
    }
    fetch(`${API}/overlay/active-theme`)
      .then((r) => r.json())
      .then((d) => {
        const t = d?.theme;
        if (typeof t === "string" && getThemeNames().includes(t)) setLiveTheme(t);
      })
      .catch(() => {});
    const onActiveTheme = (name) => {
      if (typeof name === "string" && getThemeNames().includes(name)) setLiveTheme(name);
    };
    socket.on("activeThemeChanged", onActiveTheme);
    socket.emit("requestActiveTheme");
    return () => socket.off("activeThemeChanged", onActiveTheme);
  }, [urlTheme]);

  const themeName = urlTheme && getThemeNames().includes(urlTheme) ? urlTheme : liveTheme;

  const theme = useMemo(
    () => mergeThemeOverride(getTheme(themeName), themeColorOverrides[themeName] || {}),
    [themeName, themeColorOverrides],
  );

  const stripStyle = useMemo(() => {
    const c = theme.colors || {};
    const a = theme.alive || {};
    const r = theme.row || {};
    const accent = c.accent || c.primary || "#00c2c9";
    /** Filled squad bars follow palette (elimination banner + leaderboard header), then explicit alive indicator color from Theme Preview. */
    const barFilled = c.accent || c.primary || a.color || "#ff4655";
    const primaryHex = typeof c.primary === "string" && c.primary.startsWith("#") ? c.primary : "#ffffff";
    return {
      footerBg: accent,
      footerText: c.text || "#ffffff",
      barGreen: barFilled,
      barDead: a.deadColor || "#4a4f54",
      barsBg: r.bgB || r.bgA || "#161616",
      logoBoxBg: c.secondary || r.bgA || "#0a3d45",
      initialsColor: c.text || "#ffffff",
      fontFamily: theme.typography?.fontFamily || "'Segoe UI', 'Inter', system-ui, sans-serif",
      cardBoxShadow: `0 8px 28px rgba(0,0,0,.45), 0 0 0 1px ${hexToRgba(primaryHex, 0.14)}`,
    };
  }, [theme]);

  useEffect(() => {
    const onTeams = (data) => setTeams(Array.isArray(data) ? data : []);
    const onMatchUpdated = (payload) => {
      if (payload && Array.isArray(payload.teams)) setTeams(payload.teams);
    };
    socket.on("teamsUpdated", onTeams);
    socket.on("matchUpdated", onMatchUpdated);
    socket.emit("requestTeams");
    return () => {
      socket.off("teamsUpdated", onTeams);
      socket.off("matchUpdated", onMatchUpdated);
    };
  }, []);

  /** Show strip for final-circle counts only: 1–4 squads still alive (>4 hidden). */
  const stripTeams = useMemo(() => {
    const sorted = stripTeamsFromAlive(teams);
    return sorted.length ? sorted : null;
  }, [teams]);

  const aliveTeams = useMemo(() => {
    return teams.filter((t) => String(t.status || "").toLowerCase() !== "eliminated");
  }, [teams]);

  const percents = useMemo(() => wwcdPercentsForStripTeams(stripTeams), [stripTeams]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "transparent",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {stripTeams && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            ...(position === "bottom"
              ? { bottom: "7%", transform: "translateX(-50%)" }
              : { top: "50%", transform: "translate(-50%, -50%)" }),
            width: "max-content",
            maxWidth: "min(1680px, 96vw)",
            display: "flex",
            flexDirection: "row",
            gap: 14,
            flexWrap: "nowrap",
            alignItems: "stretch",
            justifyContent: "center",
          }}
        >
          {stripTeams.map((team, i) => (
            <TeamCard
              key={team.id ?? `${team.team}-${i}`}
              team={team}
              wwcdPct={percents[i] ?? 0}
              logoBoxBg={stripStyle.logoBoxBg}
              barGreen={stripStyle.barGreen}
              barDead={stripStyle.barDead}
              barsBg={stripStyle.barsBg}
              footerBg={stripStyle.footerBg}
              footerText={stripStyle.footerText}
              initialsColor={stripStyle.initialsColor}
              fontFamily={stripStyle.fontFamily}
              cardBoxShadow={stripStyle.cardBoxShadow}
            />
          ))}
        </div>
      )}

      {debug && !stripTeams && (
        <div
          style={{
            position: "fixed",
            bottom: 12,
            left: 12,
            fontSize: 12,
            color: "rgba(255,255,255,.45)",
            fontFamily: "monospace",
          }}
        >
          WWCD strip hidden ({aliveTeams.length} squad{aliveTeams.length === 1 ? "" : "s"} alive — shows for 1–4
          alive; 5+ hides)
        </div>
      )}

      <style>{`
        *,
        *::before,
        *::after {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html {
          height: 100%;
          overflow: hidden;
          background: transparent !important;
        }
        body {
          overflow: hidden;
          min-height: 100%;
          height: 100%;
          background: transparent !important;
        }
        #root {
          min-height: 100%;
          height: 100%;
          background: transparent !important;
        }
      `}</style>
    </div>
  );
}
