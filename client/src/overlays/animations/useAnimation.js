import { useMemo } from "react";
import { getPreset } from "./presets";

/**
 * Hook: resolves animation strings from the active preset.
 * Returns animation: "none" when animations are disabled.
 */
export default function useAnimation(config) {
  const preset = useMemo(
    () => getPreset(config.animationPreset),
    [config.animationPreset]
  );

  const enabled = config.enableAnimations;

  return useMemo(
    () => ({
      board: enabled ? preset.board : "none",
      row: (i) => (enabled ? preset.row(i) : "none"),
      header: enabled ? preset.header : "none",
      wwcd: enabled ? preset.wwcd : "none",
      wwcdOverlay: enabled ? preset.wwcdOverlay : "none",
      rankUpdate: enabled ? preset.rankUpdate : "none",
    }),
    [enabled, preset]
  );
}
