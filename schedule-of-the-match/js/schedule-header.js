/** Text centered above match cards (Subtitle in admin — any text, same size). */

export const CARDS_BANNER_MIN_PX = 108;
export const CARDS_BANNER_DEFAULT_PX = 108;
export const CARDS_BANNER_FONT = "Bebas Neue";

/** Size is locked in cardsBannerSize — changing the label text must not shrink it. */
export function resolveCardsBannerFontPx(header) {
  const h = header || {};
  const dedicated = Number(h.cardsBannerSize);
  if (Number.isFinite(dedicated) && dedicated >= CARDS_BANNER_MIN_PX) return Math.round(dedicated);
  const legacy = Number(h.subtitleSize);
  if (Number.isFinite(legacy) && legacy >= CARDS_BANNER_MIN_PX) return Math.round(legacy);
  if (Number.isFinite(legacy) && legacy > 0) return CARDS_BANNER_MIN_PX;
  return CARDS_BANNER_DEFAULT_PX;
}

export function syncCardsBannerSize(header) {
  if (!header) return header;
  const px = resolveCardsBannerFontPx(header);
  header.cardsBannerSize = px;
  header.subtitleSize = px;
  return header;
}

export function normalizeHeaderBanner(config) {
  if (!config?.header) return config;
  syncCardsBannerSize(config.header);
  return config;
}