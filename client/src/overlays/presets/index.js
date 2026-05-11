/**
 * Ready-to-use overlay presets combining a theme + animation + config.
 * Use: /overlay/themed?preset=tournamentDefault
 */

const presets = {
  tournamentDefault: {
    theme: "premiumGold",
    animationPreset: "smooth",
    enableGlow: true,
    enableAnimations: true,
    enableBackgroundEffects: false,
    compactMode: false,
    aliveStyle: "crown",
    aliveLayout: "grid",
  },

  esportsLive: {
    theme: "esports",
    animationPreset: "esportsHype",
    enableGlow: true,
    enableAnimations: true,
    enableBackgroundEffects: true,
    compactMode: false,
    aliveStyle: "battery",
    aliveLayout: "grid",
  },

  neonNight: {
    theme: "neon",
    animationPreset: "cinematic",
    enableGlow: true,
    enableAnimations: true,
    enableBackgroundEffects: true,
    compactMode: false,
    aliveStyle: "neon_node",
    aliveLayout: "line",
  },

  cyberpunkArena: {
    theme: "cyberpunk",
    animationPreset: "esportsHype",
    enableGlow: true,
    enableAnimations: true,
    enableBackgroundEffects: true,
    compactMode: false,
    aliveStyle: "hex",
    aliveLayout: "line",
  },

  cleanStream: {
    theme: "minimal",
    animationPreset: "snappy",
    enableGlow: false,
    enableAnimations: true,
    enableBackgroundEffects: false,
    compactMode: false,
    aliveStyle: "minimal_dot",
    aliveLayout: "line",
  },

  broadcastPro: {
    theme: "cleanBroadcast",
    animationPreset: "smooth",
    enableGlow: false,
    enableAnimations: true,
    enableBackgroundEffects: false,
    compactMode: false,
    aliveStyle: "rounded",
    aliveLayout: "grid",
  },

  pubgClassic: {
    theme: "pubgTournament",
    animationPreset: "reveal",
    enableGlow: true,
    enableAnimations: true,
    enableBackgroundEffects: false,
    compactMode: false,
    aliveStyle: "flame",
    aliveLayout: "grid",
  },

  futureVision: {
    theme: "futuristic",
    animationPreset: "cinematic",
    enableGlow: true,
    enableAnimations: true,
    enableBackgroundEffects: true,
    compactMode: false,
    aliveStyle: "pulse_ring",
    aliveLayout: "line",
  },

  glassPanel: {
    theme: "darkGlass",
    animationPreset: "smooth",
    enableGlow: true,
    enableAnimations: true,
    enableBackgroundEffects: false,
    compactMode: false,
    aliveStyle: "dots",
    aliveLayout: "grid",
  },

  rgbGamer: {
    theme: "rgbAnimated",
    animationPreset: "esportsHype",
    enableGlow: true,
    enableAnimations: true,
    enableBackgroundEffects: true,
    compactMode: false,
    aliveStyle: "esports_ring",
    aliveLayout: "line",
  },

  compactMinimal: {
    theme: "compactPro",
    animationPreset: "snappy",
    enableGlow: false,
    enableAnimations: true,
    enableBackgroundEffects: false,
    compactMode: true,
    board: { width: 260 },
    aliveStyle: "minimal_dot",
    aliveLayout: "line",
  },

  streamerVibes: {
    theme: "streamerStyle",
    animationPreset: "smooth",
    enableGlow: true,
    enableAnimations: true,
    enableBackgroundEffects: false,
    compactMode: false,
    aliveStyle: "heart",
    aliveLayout: "grid",
  },
};

export const getPresetConfig = (name) => presets[name] || null;
export const getPresetNames = () => Object.keys(presets);
export default presets;
