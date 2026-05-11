/** WWCD visual bundles for broadcast engine (duration / motion bias). Extend without touching /overlay/wwcd route. */
export const WWCD_ENGINE_PRESETS = {
  default: { label: "Default", durationMul: 1 },
  cinematic_gold: { label: "Cinematic gold", durationMul: 1.15 },
  fast_esports: { label: "Fast esports", durationMul: 0.75 },
  extended: { label: "Extended hold", durationMul: 1.35 },
};

export function getWwcdEnginePreset(id) {
  return WWCD_ENGINE_PRESETS[id] || WWCD_ENGINE_PRESETS.default;
}
