/**
 * Maps legacy overlay theme names (admin / ThemeContext) to broadcast-engine IDs.
 * Used only when the browser source URL includes syncAdmin=1.
 */
export const LEGACY_TO_ENGINE = {
  esports: "br_esports_pro_v0",
  premiumGold: "br_gold_royal_v0",
  neon: "br_neon_rgb_v0",
  cyberpunk: "br_cyberpunk_neon_v0",
  minimal: "br_minimal_clean_v0",
  cleanBroadcast: "br_broadcast_tv_v0",
  pubgTournament: "br_pubg_official_v0",
  futuristic: "br_futuristic_v0",
  darkGlass: "br_glassmorphism_v0",
  rgbAnimated: "br_rgb_border_v0",
  compactPro: "br_compact_pro_v0",
  streamerStyle: "br_streamer_rgb_v0",
};

export const LEGACY_THEME_NAMES = Object.keys(LEGACY_TO_ENGINE);

export function legacyThemeToEngineTheme(legacyName) {
  if (legacyName == null) return null;
  const key = String(legacyName).trim();
  return LEGACY_TO_ENGINE[key] || null;
}
