import { useEffect, useState, useCallback, useMemo } from "react";
import { getTheme, getThemeNames } from "./overlays/themes";
import overlayConfig from "./overlays/overlayConfig";
import socket, { API } from "./overlays/socket";
import { mergeThemeOverride } from "./overlays/utils/mergeThemeOverride";

function defaultElimTheme() {
  const names = getThemeNames();
  const t = overlayConfig?.activeTheme;
  if (typeof t === "string" && names.includes(t)) return t;
  return names[0] || "esports";
}

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex, amount) {
  const h = hex.replace("#", "");
  const clamp = (n) => Math.max(0, Math.min(255, n));
  const r = clamp(parseInt(h.substring(0, 2), 16) - amount);
  const g = clamp(parseInt(h.substring(2, 4), 16) - amount);
  const b = clamp(parseInt(h.substring(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export default function EliminationOverlay() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("theme");
  /** Use `?theme=live`, `?theme=auto`, or omit `theme` so colors follow Admin active theme via socket. Pinned `?theme=neon` stays on that id. */
  const urlTheme = raw && raw !== "live" && raw !== "auto" ? raw : null;
  const [liveTheme, setLiveTheme] = useState(() => urlTheme || defaultElimTheme());
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
    if (urlTheme) return;
    fetch(`${API}/overlay/active-theme`)
      .then((r) => r.json())
      .then((d) => {
        const t = d?.theme;
        if (typeof t === "string" && getThemeNames().includes(t)) setLiveTheme(t);
      })
      .catch(() => {});
    const onActiveTheme = (name) => {
      if (getThemeNames().includes(name)) setLiveTheme(name);
    };
    socket.on("activeThemeChanged", onActiveTheme);
    socket.emit("requestActiveTheme");
    return () => socket.off("activeThemeChanged", onActiveTheme);
  }, [urlTheme]);

  const themeName = urlTheme || liveTheme;

  const theme = useMemo(
    () => mergeThemeOverride(getTheme(themeName), themeColorOverrides[themeName] || {}),
    [themeName, themeColorOverrides],
  );

  const [queue, setQueue] = useState([]);
  const [banner, setBanner] = useState(null);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [processing, setProcessing] = useState(false);

  const showBanner = useCallback((data) => {
    setQueue((prev) => [...prev, data]);
  }, []);

  useEffect(() => {
    if (processing || queue.length === 0) return;
    setProcessing(true);

    const data = queue[0];
    setQueue((prev) => prev.slice(1));
    setExiting(false);
    setBanner(data);
    setVisible(true);

    setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        setBanner(null);
        setExiting(false);
        setProcessing(false);
      }, 600);
    }, 4500);
  }, [queue, processing]);

  useEffect(() => {
    socket.on("teamEliminated", showBanner);

    const onCommand = (cmd) => {
      if (cmd.type === "testElimination") {
        showBanner({
          team: cmd.team || "TEST",
          logo: cmd.logo || null,
          rank: cmd.rank || 14,
          finishes: cmd.finishes ?? 0,
          points: cmd.points ?? 0,
        });
      }
    };
    socket.on("overlayCommand", onCommand);

    return () => {
      socket.off("teamEliminated", showBanner);
      socket.off("overlayCommand", onCommand);
    };
  }, [showBanner]);

  const c = theme.colors;
  const primary = c.primary;
  const accent = c.accent || c.primary;
  const gold = c.gold || "#f0c040";
  const secondary = c.secondary || "#0f1923";

  const elimGrad = `linear-gradient(90deg, ${darken(accent, 40)} 0%, ${accent} 40%, ${primary} 70%, ${darken(accent, 40)} 100%)`;
  const rankBg = `linear-gradient(135deg, ${darken(secondary, 10)} 0%, ${secondary} 100%)`;
  const logoBg = `linear-gradient(180deg, ${darken(secondary, 5)} 0%, ${darken(secondary, 20)} 100%)`;
  const finishBg = `linear-gradient(90deg, ${darken(secondary, -20)} 0%, ${darken(secondary, -30)} 60%, ${darken(secondary, -20)} 100%)`;
  const nameBg = `linear-gradient(90deg, ${gold}, ${darken(gold, 30)})`;
  const glowColor = hexToRgba(primary, 0.3);
  const glowColorStrong = hexToRgba(primary, 0.5);
  const textShadow = `0 2px 20px ${hexToRgba(accent, 0.5)}, 0 0 40px ${hexToRgba(primary, 0.3)}`;

  const dynamicKeyframes = `
@keyframes elimPulseGlow {
  0%, 100% { box-shadow: 0 0 20px ${glowColor}, 0 4px 30px rgba(0,0,0,.5); }
  50%      { box-shadow: 0 0 35px ${glowColorStrong}, 0 4px 30px rgba(0,0,0,.5); }
}
`;

  if (!visible || !banner) return (
    <div style={s.root}>
      <style>{cssReset}{cssKeyframes}{dynamicKeyframes}</style>
    </div>
  );

  const animClass = exiting ? "elim-exit" : "elim-enter";

  return (
    <div style={s.root}>
      <div className={animClass} style={s.bannerWrap}>
        {/* Left — Rank + Logo */}
        <div style={s.leftBlock}>
          <div style={{ ...s.rankSection, background: rankBg }}>
            <span style={{ ...s.rankHash, color: c.textMuted }}>#</span>
            <span style={s.rankNum}>{banner.rank ?? "?"}</span>
          </div>
          <div style={{ ...s.logoSection, background: logoBg, borderTop: `2px solid ${gold}` }}>
            {banner.logo ? (
              <img src={`${API}${banner.logo}`} alt="" style={{ ...s.logoImg, border: `2px solid ${hexToRgba(gold, 0.5)}` }} />
            ) : (
              <div style={{ ...s.logoFallback, background: `linear-gradient(135deg, ${gold}, ${darken(gold, 50)})`, border: `2px solid ${hexToRgba(gold, 0.5)}` }}>
                {(banner.team || "TM").slice(0, 2)}
              </div>
            )}
          </div>
        </div>

        {/* Right — Info */}
        <div style={s.rightBlock}>
          <div style={{ ...s.finishBar, background: finishBg }}>
            <div className="elim-finish-slide" style={s.finishInner}>
              <span style={s.finishNum}>{banner.finishes ?? 0}</span>
              <span style={s.finishLabel}>FINISHES</span>
            </div>
          </div>
          <div style={{ ...s.elimBar, background: elimGrad }}>
            <div className="elim-text-slide" style={s.elimInner}>
              <span style={{ ...s.elimText, textShadow }}>ELIMINATED</span>
            </div>
          </div>
        </div>

        {/* Team name */}
        <div className="elim-name-pop" style={{ ...s.nameTag, background: nameBg }}>
          {banner.team}
        </div>
      </div>

      <style>{cssReset}{cssKeyframes}{dynamicKeyframes}</style>
    </div>
  );
}

const cssReset = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { overflow: hidden; background: transparent; }
`;

const cssKeyframes = `
@keyframes elimSlideIn {
  0%   { transform: translateX(-120%); opacity: 0; }
  30%  { opacity: 1; }
  100% { transform: translateX(0); }
}
@keyframes elimSlideOut {
  0%   { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(120%); opacity: 0; }
}
@keyframes elimFinishSlide {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(0); }
}
@keyframes elimTextSlide {
  0%   { transform: translateX(-100%); opacity: 0; }
  50%  { opacity: 1; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes elimNamePop {
  0%   { opacity: 0; transform: translateY(8px) scale(0.9); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes elimLogoPulse {
  0%   { transform: scale(0.5) rotate(-10deg); opacity: 0; }
  60%  { transform: scale(1.08) rotate(2deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
.elim-enter {
  animation: elimSlideIn 0.6s cubic-bezier(.22,.68,.31,1.2) forwards,
             elimPulseGlow 2s ease-in-out 0.8s infinite;
}
.elim-exit {
  animation: elimSlideOut 0.5s cubic-bezier(.55,.06,.68,.19) forwards;
}
.elim-finish-slide {
  animation: elimFinishSlide 0.4s ease-out 0.3s both;
}
.elim-text-slide {
  animation: elimTextSlide 0.5s ease-out 0.45s both;
}
.elim-name-pop {
  animation: elimNamePop 0.4s ease-out 0.65s both;
}
`;

const s = {
  root: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    padding: "60px 50px",
    background: "transparent",
    fontFamily: "'Rajdhani', 'Inter', system-ui, sans-serif",
  },
  bannerWrap: {
    display: "flex",
    position: "relative",
    filter: "drop-shadow(0 6px 20px rgba(0,0,0,.6))",
  },
  leftBlock: {
    width: 110,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  rankSection: {
    height: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderBottom: "2px solid rgba(255,255,255,.06)",
    clipPath: "polygon(0 0, 100% 0, 95% 100%, 0 100%)",
  },
  rankHash: {
    fontSize: 18,
    fontWeight: 700,
  },
  rankNum: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: 900,
    lineHeight: 1,
  },
  logoSection: {
    height: 90,
    display: "grid",
    placeItems: "center",
    clipPath: "polygon(0 0, 95% 0, 100% 100%, 0 100%)",
  },
  logoImg: {
    width: 62,
    height: 62,
    objectFit: "cover",
    borderRadius: 8,
    animation: "elimLogoPulse 0.5s ease-out 0.5s both",
  },
  logoFallback: {
    width: 62,
    height: 62,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    color: "#1a1400",
    fontSize: 22,
    fontWeight: 900,
    animation: "elimLogoPulse 0.5s ease-out 0.5s both",
  },
  rightBlock: {
    display: "flex",
    flexDirection: "column",
    minWidth: 340,
  },
  finishBar: {
    height: 42,
    overflow: "hidden",
    clipPath: "polygon(0 0, 100% 0, 97% 100%, 2% 100%)",
  },
  finishInner: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  finishNum: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: 900,
  },
  finishLabel: {
    color: "#c0c4d0",
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: 3,
  },
  elimBar: {
    height: 90,
    overflow: "hidden",
    clipPath: "polygon(2% 0, 97% 0, 100% 100%, 0 100%)",
    borderTop: "2px solid rgba(255,255,255,.1)",
  },
  elimInner: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  elimText: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: 900,
    letterSpacing: 6,
  },
  nameTag: {
    position: "absolute",
    bottom: -32,
    left: 8,
    color: "#1a1400",
    padding: "4px 20px",
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 2,
    clipPath: "polygon(3% 0, 100% 0, 97% 100%, 0 100%)",
    boxShadow: "0 4px 12px rgba(0,0,0,.4)",
  },
};
