import { hslToHex } from "../utils/hslToHex";

/** Broadcast-style families → base hue for 100+ unique tournament looks */
const FAMILIES = [
  ["esports_pro", 355],
  ["pubg_official", 202],
  ["bgmi_tournament", 283],
  ["cyberpunk_neon", 288],
  ["neon_rgb", 305],
  ["gold_royal", 45],
  ["minimal_clean", 210],
  ["glassmorphism", 200],
  ["dark_matte", 260],
  ["metallic", 215],
  ["anime_vibrant", 330],
  ["sci_fi_hud", 190],
  ["futuristic", 175],
  ["military_tactical", 95],
  ["luxury_premium", 38],
  ["arcade_retro", 145],
  ["streamer_rgb", 275],
  ["holographic", 265],
  ["fire_ember", 18],
  ["ice_glacier", 195],
  ["shadow_ninja", 245],
  ["dynamic_gradient", 310],
  ["tech_overlay", 205],
  ["broadcast_tv", 0],
  ["mobile_arena", 230],
  ["compact_pro", 350],
  ["modern_ui", 220],
  ["classic_scoreboard", 40],
  ["led_matrix", 120],
  ["digital_matrix", 145],
  ["energy_pulse", 25],
  ["deep_space", 245],
  ["retro_wave", 315],
  ["dynamic_glow", 280],
  ["ultra_clean", 200],
  ["rgb_border", 300],
  ["elite_championship", 48],
  ["velvet_night", 275],
  ["carbon_fiber", 225],
  ["plasma_core", 185],
  ["titan_steel", 210],
  ["aurora_borealis", 160],
];

/**
 * Build 120+ unique theme objects compatible with existing overlay theme shape.
 */
export function buildEngineThemeLibrary() {
  const map = new Map();

  for (const [slug, baseHue] of FAMILIES) {
    for (let v = 0; v < 5; v++) {
      const id = `br_${slug}_v${v}`;
      const hue = (baseHue + v * 11 + slug.length * 3) % 360;
      const primary = hslToHex(hue, 72, 54);
      const secondary = hslToHex((hue + 180) % 360, 45, 11);
      const accent = hslToHex((hue + 35) % 360, 70, 52);
      const gold = hslToHex((hue + 52) % 360, 85, 58);
      const text = v % 2 === 0 ? "#f4f6fb" : "#e8eaf0";
      const textMuted = hslToHex(hue, 15, 55);
      const rowA = hslToHex(hue, 22, 13);
      const rowB = hslToHex(hue, 18, 10);

      map.set(id, {
        name: `${slug.replace(/_/g, " ")} · ${v}`,
        colors: {
          primary,
          secondary,
          accent,
          text,
          textMuted,
          gold,
        },
        gradients: {
          panel: `linear-gradient(165deg, ${rowA} 0%, ${secondary} 55%, ${rowB} 100%)`,
          header: `linear-gradient(90deg, ${primary} 0%, ${accent} 50%, ${primary} 100%)`,
          row: `linear-gradient(90deg, ${primary}14 0%, transparent 100%)`,
          topLine: `linear-gradient(90deg, ${primary}, ${gold}, ${accent})`,
          wwcd: `linear-gradient(180deg, ${secondary} 0%, #0a0812 100%)`,
        },
        glow: {
          primary: `0 0 22px ${primary}55`,
          accent: `0 0 34px ${accent}44`,
          board: `0 0 72px ${primary}22`,
        },
        borders: {
          panel: `1px solid ${primary}55`,
          row: "1px solid rgba(255,255,255,.05)",
          header: `1px solid ${primary}66`,
          alive: "none",
        },
        typography: {
          fontFamily:
            v % 3 === 0
              ? "'Rajdhani', 'Inter', system-ui, sans-serif"
              : v % 3 === 1
                ? "'Orbitron', 'Inter', system-ui, sans-serif"
                : "'Inter', 'Segoe UI', system-ui, sans-serif",
          headerSize: 11,
          rankSize: 15 + (v % 3),
          teamSize: 11 + (v % 2),
          numberSize: 15 + (v % 3),
          wwcdTitleSize: 20,
          wwcdMainSize: 62,
          wwcdTeamSize: 38,
        },
        shadows: {
          board: "0 10px 44px rgba(0,0,0,.65)",
          row: "none",
          wwcd: `0 0 88px ${primary}35`,
        },
        row: {
          bgA: rowA,
          bgB: rowB,
          height: 40 + (v % 5) * 2,
          hoverBg: `${primary}18`,
          borderRadius: [0, 2, 4, 6, 8][v % 5],
        },
        alive: {
          color: primary,
          deadColor: hslToHex(hue, 20, 18),
          shape: ["square", "circle", "diamond", "square"][v % 4],
          size: 7 + (v % 4),
          gap: 2,
        },
        wwcd: {
          overlayBg: "rgba(0,0,0,.93)",
          titleColor: primary,
          mainColor: "#ffffff",
          teamColor: gold,
          borderColor: primary,
        },
        topLine: {
          height: 2 + (v % 3),
        },
        _engine: { id, family: slug, variant: v },
      });
    }
  }

  return map;
}

let _cached = null;
export function getEngineThemeMap() {
  if (!_cached) _cached = buildEngineThemeLibrary();
  return _cached;
}

export function getEngineThemeIds() {
  return Array.from(getEngineThemeMap().keys());
}

export function getEngineTheme(id) {
  const m = getEngineThemeMap();
  const t = m.get(id);
  if (t) return t;
  const first = m.keys().next().value;
  return m.get(first);
}
