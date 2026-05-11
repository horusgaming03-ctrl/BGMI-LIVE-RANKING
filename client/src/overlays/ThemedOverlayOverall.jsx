import { useEffect, useMemo, useState } from "react";
import { ThemeProvider, useTheme } from "./ThemeContext";
import useAnimation from "./animations/useAnimation";
import keyframes from "./animations/keyframes";
import BackgroundEffects from "./effects/BackgroundEffects";
import ThemeSwitcher from "./components/ThemeSwitcher";
import { getPresetConfig } from "./presets";
import socket, { API } from "./socket";
import { mergeThemeOverride } from "./utils/mergeThemeOverride";

/**
 * Themed overall standings overlay.
 * Preserves identical socket/data logic from OverlayOverall.jsx
 * while applying the theme engine for visuals.
 */
function OverallInner() {
  const { theme: baseTheme, themeName, config } = useTheme();
  const anim = useAnimation(config);
  const [stats, setStats] = useState([]);
  const [match, setMatch] = useState({ number: 1 });
  const [themeColorOverrides, setThemeColorOverrides] = useState({});
  const [overallStandingsBg, setOverallStandingsBg] = useState(null);

  useEffect(() => {
    const onSettings = (s) => {
      setThemeColorOverrides(s?.themeColorOverrides && typeof s.themeColorOverrides === "object" ? s.themeColorOverrides : {});
      setOverallStandingsBg(s?.overallStandingsBg && typeof s.overallStandingsBg === "string" ? s.overallStandingsBg : null);
    };
    socket.on("settingsUpdated", onSettings);
    socket.emit("requestSettings");
    return () => socket.off("settingsUpdated", onSettings);
  }, []);

  const theme = useMemo(
    () => mergeThemeOverride(baseTheme, themeColorOverrides[themeName] || {}),
    [baseTheme, themeName, themeColorOverrides],
  );

  useEffect(() => {
    const onTournament = (data) => setStats(Array.isArray(data) ? data : []);
    const onMatch = (data) => setMatch(data);
    const onCommand = (cmd) => {
      if (cmd.type === "toggleFullscreen") {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
    };

    socket.on("tournamentUpdated", onTournament);
    socket.on("matchUpdated", onMatch);
    socket.on("overlayCommand", onCommand);
    socket.emit("requestTournament");
    socket.emit("requestMatch");

    const interval = setInterval(() => socket.emit("requestTournament"), 5000);
    return () => {
      socket.off("tournamentUpdated", onTournament);
      socket.off("matchUpdated", onMatch);
      socket.off("overlayCommand", onCommand);
      clearInterval(interval);
    };
  }, []);

  const topFragger = useMemo(
    () => (stats.length ? [...stats].sort((a, b) => b.totalKills - a.totalKills)[0] : null),
    [stats]
  );
  const topWWCD = useMemo(
    () => (stats.length ? [...stats].sort((a, b) => b.chickenDinners - a.chickenDinners)[0] : null),
    [stats]
  );

  const layoutQs = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const useImageLayout = Boolean(overallStandingsBg) && layoutQs.get("layout") !== "theme";

  if (!stats.length) {
    return (
      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          fontFamily: theme.typography.fontFamily,
        }}
      >
        {useImageLayout ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${API}${overallStandingsBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ) : null}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            color: theme.colors.text,
            background: useImageLayout ? "transparent" : "#000",
            fontSize: 28,
            fontWeight: 800,
            textAlign: "center",
            padding: 40,
            textShadow: useImageLayout ? "0 2px 12px rgba(0,0,0,.9)" : undefined,
          }}
        >
          No tournament data yet. Complete matches to see overall standings.
        </div>
      </div>
    );
  }

  if (useImageLayout) {
    const t = theme.typography;
    const panel = "rgba(8,10,18,0.88)";
    return (
      <div style={{ minHeight: "100vh", width: "100vw", position: "relative", color: "#f0f4fc", fontFamily: t.fontFamily }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${API}${overallStandingsBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              borderRadius: 20,
              overflow: "hidden",
              border: `1px solid ${theme.colors.gold}55`,
              boxShadow: "0 20px 50px rgba(0,0,0,.6)",
              background: panel,
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 22px",
                borderBottom: "1px solid rgba(255,255,255,.12)",
              }}
            >
              <span style={{ color: theme.colors.gold, fontSize: 13, fontWeight: 900, letterSpacing: "0.15em" }}>
                OVERALL STANDINGS
              </span>
              <span
                style={{
                  background: `${theme.colors.accent}33`,
                  border: `1px solid ${theme.colors.accent}55`,
                  color: theme.colors.accent,
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                AFTER {match.number || 1} MATCHES
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 30,
                flexWrap: "wrap",
                padding: "12px 22px",
                borderBottom: "1px solid rgba(255,255,255,.08)",
              }}
            >
              <MvpItem label="LEADER" value={`${stats[0]?.team} — ${stats[0]?.totalPoints} PTS`} theme={theme} icon="🏆" />
              {topFragger && (
                <MvpItem label="TOP FRAGGER" value={`${topFragger.team} — ${topFragger.totalKills} KILLS`} theme={theme} icon="🎯" />
              )}
              {topWWCD && topWWCD.chickenDinners > 0 && (
                <MvpItem label="MOST WWCD" value={`${topWWCD.team} — ${topWWCD.chickenDinners}x`} theme={theme} icon="🍗" />
              )}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1.4fr 60px 80px 80px 70px 100px",
                color: theme.colors.gold,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                padding: "14px 22px",
                fontSize: 11,
                background: "rgba(0,0,0,.25)",
              }}
            >
              <div>#</div>
              <div>Team</div>
              <div>M</div>
              <div>Kills</div>
              <div>Pos Pts</div>
              <div>WWCD</div>
              <div>Total</div>
            </div>
            {stats.map((team, idx) => {
              const isTop3 = idx < 3;
              return (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1.4fr 60px 80px 80px 70px 100px",
                    alignItems: "center",
                    padding: "10px 22px",
                    borderTop: "1px solid rgba(255,255,255,.08)",
                    background: isTop3 ? "rgba(241,207,105,0.12)" : idx % 2 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                    borderLeft: isTop3 ? `3px solid ${theme.colors.gold}` : "3px solid transparent",
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 900, color: isTop3 ? theme.colors.gold : "#fff" }}>{idx + 1}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: team.logo ? undefined : `linear-gradient(135deg, ${theme.colors.gold}, ${theme.colors.primary})`,
                        backgroundImage: team.logo ? `url(${API}${team.logo})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 900,
                        fontSize: 12,
                        flexShrink: 0,
                        color: team.logo ? "transparent" : "#000",
                      }}
                    >
                      {team.logo ? "" : team.team.slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{team.team}</div>
                      {team.chickenDinners > 0 && (
                        <div style={{ fontSize: 11, color: theme.colors.gold }}>🏆 ×{team.chickenDinners}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, textAlign: "center" }}>{team.matchesPlayed}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, textAlign: "center" }}>{team.totalKills}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, textAlign: "center", color: theme.colors.gold }}>
                    {team.totalPositionPoints}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, textAlign: "center", color: theme.colors.gold }}>
                    {team.chickenDinners}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, textAlign: "center", color: isTop3 ? theme.colors.accent : "#fff" }}>
                    {team.totalPoints}
                  </div>
                </div>
              );
            })}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "10px 22px",
                background: "rgba(0,0,0,.2)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,.45)",
              }}
            >
              POINTS TABLE · LIVE SYNC
            </div>
          </div>
        </div>
        <ThemeSwitcher />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { overflow-x: hidden; background: transparent; }
          ${keyframes}
        `}</style>
      </div>
    );
  }

  const t = theme.typography;
  const glowEnabled = config.enableGlow;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: "transparent",
        color: theme.colors.text,
        padding: 24,
        boxSizing: "border-box",
        fontFamily: t.fontFamily,
        position: "relative",
      }}
    >
      <BackgroundEffects theme={theme} enabled={config.enableBackgroundEffects} />

      <div
        style={{
          width: "100%",
          borderRadius: 28,
          overflow: "hidden",
          background: theme.gradients.panel,
          border: theme.borders.panel,
          boxShadow: glowEnabled ? theme.shadows.board : "0 8px 30px rgba(0,0,0,.4)",
          animation: anim.board,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 22px",
            background: theme.gradients.header,
            borderBottom: theme.borders.header,
            animation: anim.header,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                color: theme.colors.accent,
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: "0.15em",
              }}
            >
              HORUS ESPORTS
            </span>
            <span style={{ color: `${theme.colors.text}30` }}>|</span>
            <span
              style={{
                color: theme.colors.gold,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.1em",
              }}
            >
              OVERALL STANDINGS
            </span>
          </div>
          <div>
            <span
              style={{
                background: `${theme.colors.accent}18`,
                border: `1px solid ${theme.colors.accent}35`,
                color: theme.colors.accent,
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: "0.05em",
              }}
            >
              AFTER {match.number || 1} MATCHES
            </span>
          </div>
        </div>

        {/* MVP Strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 30,
            padding: "12px 22px",
            background: `${theme.colors.text}05`,
            borderBottom: `1px solid ${theme.colors.text}0d`,
          }}
        >
          <MvpItem label="LEADER" value={`${stats[0]?.team} — ${stats[0]?.totalPoints} PTS`} theme={theme} icon="🏆" />
          {topFragger && (
            <MvpItem label="TOP FRAGGER" value={`${topFragger.team} — ${topFragger.totalKills} KILLS`} theme={theme} icon="🎯" />
          )}
          {topWWCD && topWWCD.chickenDinners > 0 && (
            <MvpItem label="MOST WWCD" value={`${topWWCD.team} — ${topWWCD.chickenDinners}x`} theme={theme} icon="🍗" />
          )}
        </div>

        {/* Column Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 1.4fr 60px 80px 80px 70px 100px",
            background: theme.row.bgB,
            color: theme.colors.gold,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            padding: "14px 22px",
            fontSize: 11,
          }}
        >
          <div>#</div>
          <div>Team</div>
          <div>M</div>
          <div>Kills</div>
          <div>Pos Pts</div>
          <div>WWCD</div>
          <div>Total</div>
        </div>

        {/* Rows */}
        {stats.map((team, idx) => {
          const isTop3 = idx < 3;
          return (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1.4fr 60px 80px 80px 70px 100px",
                alignItems: "center",
                padding: "10px 22px",
                borderTop: `1px solid ${theme.colors.text}0d`,
                background: isTop3
                  ? `${theme.colors.gold}${["14", "0F", "0A"][idx] || "0A"}`
                  : idx % 2 ? theme.row.bgB : theme.row.bgA,
                borderLeft: isTop3
                  ? `3px solid ${theme.colors.gold}`
                  : "3px solid transparent",
                animation: anim.row(idx),
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 900, color: isTop3 ? theme.colors.gold : theme.colors.text }}>
                {idx + 1}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: team.logo ? undefined : `linear-gradient(135deg, ${theme.colors.gold}, ${theme.colors.primary})`,
                    backgroundImage: team.logo ? `url(${API}${team.logo})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    color: team.logo ? "transparent" : "#000",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {team.logo ? "" : team.team.slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em" }}>
                    {team.team}
                  </div>
                  {team.chickenDinners > 0 && (
                    <div style={{ fontSize: 12, color: theme.colors.gold, marginTop: 2 }}>
                      🏆 ×{team.chickenDinners}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, textAlign: "center" }}>{team.matchesPlayed}</div>
              <div style={{ fontSize: 22, fontWeight: 900, textAlign: "center" }}>{team.totalKills}</div>
              <div style={{ fontSize: 22, fontWeight: 900, textAlign: "center", color: theme.colors.gold }}>{team.totalPositionPoints}</div>
              <div style={{ fontSize: 22, fontWeight: 900, textAlign: "center", color: theme.colors.gold }}>{team.chickenDinners}</div>
              <div style={{ fontSize: 30, fontWeight: 900, textAlign: "center", color: isTop3 ? theme.colors.accent : theme.colors.text }}>
                {team.totalPoints}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "12px 22px",
            background: theme.row.bgA,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: theme.colors.textMuted }}>HORUS TOURNAMENT SYSTEM</span>
          <span style={{ color: theme.colors.textMuted }}>POWERED BY LIVE SYNC</span>
        </div>
      </div>

      <ThemeSwitcher />

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow-x: hidden; background: transparent; }
        ${keyframes}
      `}</style>
    </div>
  );
}

function MvpItem({ label, value, theme, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: theme.colors.textMuted }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 900, color: theme.colors.text }}>
        {value}
      </span>
    </div>
  );
}

export default function ThemedOverlayOverall() {
  const params = new URLSearchParams(window.location.search);
  const themeName = params.get("theme") || undefined;
  const presetName = params.get("preset");
  const preset = presetName ? getPresetConfig(presetName) : null;
  return (
    <ThemeProvider
      initialTheme={preset?.theme || themeName}
      initialConfig={preset || undefined}
      listenForLive={true}
    >
      <OverallInner />
    </ThemeProvider>
  );
}
