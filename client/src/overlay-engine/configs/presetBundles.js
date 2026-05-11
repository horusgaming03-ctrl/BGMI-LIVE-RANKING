import { getDesignCatalog } from "../designs";
import { defaultEngineConfig } from "./defaultEngineConfig";

function designId(label, wave) {
  const hit = getDesignCatalog().find((d) => d.label === `${label}_w${wave}`);
  return hit?.id || getDesignCatalog()[0]?.id || "dsgn_pro_wave0_000";
}

/** Named one-click looks — URL: ?bundle=arena_default (explicit params override) */
export const PRESET_BUNDLE_DEFS = {
  arena_default: {
    label: "Arena default",
    engineTheme: "br_esports_pro_v0",
    design: ["pro", 0],
    aliveStyle: "rounded",
    animationPack: "subtle",
    engineAnimations: true,
  },
  cyber_neon: {
    label: "Cyber neon",
    engineTheme: "br_cyberpunk_neon_v2",
    design: ["hud", 3],
    aliveStyle: "neon_node",
    animationPack: "neon",
    engineAnimations: true,
  },
  gold_championship: {
    label: "Gold championship",
    engineTheme: "br_elite_championship_v1",
    design: ["elite", 2],
    aliveStyle: "crown",
    animationPack: "cinematic",
    engineAnimations: true,
  },
  pubg_night: {
    label: "PUBG night",
    engineTheme: "br_pubg_official_v3",
    design: ["arena_night", 1],
    aliveStyle: "battery",
    animationPack: "broadcast",
    engineAnimations: true,
  },
  minimal_clean: {
    label: "Minimal clean",
    engineTheme: "br_ultra_clean_v0",
    design: ["frameless", 0],
    aliveStyle: "minimal_dot",
    animationPack: "none",
    engineAnimations: false,
  },
  rgb_stream: {
    label: "RGB stream",
    engineTheme: "br_streamer_rgb_v2",
    design: ["chroma", 4],
    aliveStyle: "star",
    animationPack: "esports",
    engineAnimations: true,
  },
  tactical_military: {
    label: "Tactical",
    engineTheme: "br_military_tactical_v1",
    design: ["studio", 2],
    aliveStyle: "shield",
    animationPack: "subtle",
    engineAnimations: true,
  },
  holographic_show: {
    label: "Holographic show",
    engineTheme: "br_holographic_v3",
    design: ["masters", 5],
    aliveStyle: "pulse_ring",
    animationPack: "neon",
    engineAnimations: true,
  },
  matrix_board: {
    label: "Matrix board",
    engineTheme: "br_digital_matrix_v2",
    design: ["wildcard", 7],
    aliveStyle: "hex",
    animationPack: "esports",
    engineAnimations: true,
  },
  broadcast_tv: {
    label: "Broadcast TV",
    engineTheme: "br_broadcast_tv_v1",
    design: ["premier", 3],
    aliveStyle: "dots",
    animationPack: "broadcast",
    engineAnimations: true,
  },
};

export function getPresetBundleIds() {
  return Object.keys(PRESET_BUNDLE_DEFS);
}

export function getPresetBundle(id) {
  const b = PRESET_BUNDLE_DEFS[id];
  if (!b) return null;
  const [label, wave] = b.design;
  return {
    bundleId: id,
    label: b.label,
    engineTheme: b.engineTheme || defaultEngineConfig.engineTheme,
    engineDesign: designId(label, wave),
    aliveStyle: b.aliveStyle || defaultEngineConfig.aliveStyle,
    animationPack: b.animationPack || defaultEngineConfig.animationPack,
    engineAnimations: b.engineAnimations !== false,
  };
}
