/**
 * Animation presets that can be selected via overlayConfig.animationPreset.
 * Each preset maps component roles to CSS animation strings.
 */

const presets = {
  none: {
    board: "none",
    row: (i) => "none",
    header: "none",
    wwcd: "none",
    wwcdOverlay: "none",
    rankUpdate: "none",
  },

  smooth: {
    board: "ov-fadeIn 0.4s ease-out",
    row: (i) => `ov-slideInLeft ${0.25 + i * 0.03}s ease-out`,
    header: "ov-fadeIn 0.3s ease-out",
    wwcd: "ov-wwcdPop 0.5s ease-out",
    wwcdOverlay: "ov-fadeIn 0.3s ease-out",
    rankUpdate: "ov-rankUpdate 0.6s ease-out",
  },

  esportsHype: {
    board: "ov-scaleIn 0.4s cubic-bezier(.17,.67,.29,1.2)",
    row: (i) => `ov-slideInRight ${0.2 + i * 0.04}s cubic-bezier(.17,.67,.29,1.2)`,
    header: "ov-reveal 0.4s ease-out",
    wwcd: "ov-pop 0.6s cubic-bezier(.17,.67,.29,1.2)",
    wwcdOverlay: "ov-fadeIn 0.2s ease-out",
    rankUpdate: "ov-glow 0.8s ease-out",
  },

  cinematic: {
    board: "ov-slideInUp 0.6s ease-out",
    row: (i) => `ov-slideInUp ${0.4 + i * 0.05}s ease-out`,
    header: "ov-slideInDown 0.5s ease-out",
    wwcd: "ov-wwcdPop 0.7s cubic-bezier(.17,.67,.29,1.2)",
    wwcdOverlay: "ov-fadeIn 0.4s ease-out",
    rankUpdate: "ov-pulse 0.6s ease-out",
  },

  snappy: {
    board: "ov-scaleIn 0.2s ease-out",
    row: (i) => `ov-fadeIn ${0.1 + i * 0.02}s ease-out`,
    header: "ov-fadeIn 0.15s ease-out",
    wwcd: "ov-pop 0.35s ease-out",
    wwcdOverlay: "ov-fadeIn 0.15s ease-out",
    rankUpdate: "ov-rankUpdate 0.3s ease-out",
  },

  reveal: {
    board: "ov-reveal 0.6s ease-out",
    row: (i) => `ov-reveal ${0.3 + i * 0.05}s ease-out`,
    header: "ov-reveal 0.4s ease-out",
    wwcd: "ov-scaleIn 0.5s ease-out",
    wwcdOverlay: "ov-fadeIn 0.3s ease-out",
    rankUpdate: "ov-shimmer 1s ease-out",
  },
};

export const getPreset = (name) => presets[name] || presets.smooth;
export default presets;
