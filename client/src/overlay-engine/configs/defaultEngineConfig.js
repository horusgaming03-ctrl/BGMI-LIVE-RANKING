/**
 * Broadcast Engine defaults — independent from legacy overlayConfig.
 * URL query overrides: engineTheme, engineDesign, alive, anim, engineAnim=0
 */
export const defaultEngineConfig = {
  engineTheme: "br_esports_pro_v0",
  engineDesign: null, // first design id resolved at runtime
  aliveStyle: "battery",
  animationPack: "subtle",
  enableEngineAnimations: true,
  enableBackgroundEffects: true,
  enableGlow: true,
  compactMode: false,
  board: {
    width: 328,
    maxTeams: 16,
    showHeader: true,
    showAlive: true,
    showFinishes: true,
  },
  wwcd: {
    duration: 8000,
    showLogo: true,
    showConfetti: false,
  },
};
