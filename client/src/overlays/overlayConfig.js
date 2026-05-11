/**
 * Master overlay configuration.
 * Edit this single file to control the entire themed overlay system.
 */
const overlayConfig = {
  activeTheme: "esports",

  enableAnimations: true,
  enableGlow: true,
  enableBackgroundEffects: true,
  compactMode: false,

  animationPreset: "smooth",
  animationSpeed: 1,

  wwcdStyle: "cinematic",
  rowStyle: "default",

  board: {
    width: 320,
    maxTeams: 16,
    showHeader: true,
    showAlive: true,
    showFinishes: true,
  },

  wwcd: {
    duration: 30000,
    showLogo: true,
    showConfetti: false,
  },
};

export default overlayConfig;
