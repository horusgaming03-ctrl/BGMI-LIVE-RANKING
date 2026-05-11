import { memo } from "react";
import { useTheme } from "../ThemeContext";

/**
 * Floating dev/preview panel for switching themes live.
 * Add ?switcher=1 to the overlay URL to show it.
 * Hidden by default in production / OBS.
 */
function ThemeSwitcher() {
  const { theme, themeName, switchTheme, availableThemes, config, updateConfig } = useTheme();

  const show = new URLSearchParams(window.location.search).get("switcher") === "1";
  if (!show) return null;

  return (
    <div style={panel}>
      <div style={title}>Theme Switcher</div>

      <div style={section}>
        <div style={label}>Theme</div>
        <select
          value={themeName}
          onChange={(e) => switchTheme(e.target.value)}
          style={select}
        >
          {availableThemes.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div style={section}>
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={config.enableAnimations}
            onChange={(e) => updateConfig({ enableAnimations: e.target.checked })}
          />
          Animations
        </label>
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={config.enableGlow}
            onChange={(e) => updateConfig({ enableGlow: e.target.checked })}
          />
          Glow Effects
        </label>
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={config.enableBackgroundEffects}
            onChange={(e) => updateConfig({ enableBackgroundEffects: e.target.checked })}
          />
          Background FX
        </label>
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={config.compactMode}
            onChange={(e) => updateConfig({ compactMode: e.target.checked })}
          />
          Compact Mode
        </label>
      </div>

      <div style={section}>
        <div style={label}>Animation Preset</div>
        <select
          value={config.animationPreset}
          onChange={(e) => updateConfig({ animationPreset: e.target.value })}
          style={select}
        >
          {["none", "smooth", "esportsHype", "cinematic", "snappy", "reveal"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

const panel = {
  position: "fixed",
  top: 10,
  right: 10,
  width: 200,
  background: "rgba(0,0,0,.85)",
  border: "1px solid rgba(255,255,255,.15)",
  borderRadius: 8,
  padding: 12,
  zIndex: 99999,
  fontFamily: "Inter, system-ui, sans-serif",
  color: "#fff",
  fontSize: 12,
  backdropFilter: "blur(10px)",
};

const title = {
  fontWeight: 800,
  fontSize: 13,
  marginBottom: 10,
  letterSpacing: "0.05em",
  borderBottom: "1px solid rgba(255,255,255,.1)",
  paddingBottom: 8,
};

const section = { marginBottom: 10 };

const label = {
  fontSize: 10,
  fontWeight: 700,
  color: "#999",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 4,
};

const select = {
  width: "100%",
  padding: "4px 6px",
  background: "#222",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: 4,
  fontSize: 12,
  outline: "none",
};

const checkRow = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  marginBottom: 4,
  cursor: "pointer",
};

export default memo(ThemeSwitcher);
