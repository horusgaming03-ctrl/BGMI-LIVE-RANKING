/** WWCD art URL for a finished match (replaces map image only). */
export function resolveWwcdImageUrl(match, config, assetBase) {
  const winner = config.winner || {};
  const custom =
    winner.wwcdImageUrl ||
    match.wwcdImageUrl ||
    "";
  if (custom) return custom;
  return assetBase + "assets/badges/wwcd-chicken.png";
}

/** Same slot as map-photo — drops into .match-card__media */
export function createWwcdMapImage(match, config, assetBase, resolveUrl) {
  const img = document.createElement("img");
  img.className = "map-photo wwcd-photo";
  img.alt = "WWCD";
  img.decoding = "async";
  const raw = resolveWwcdImageUrl(match, config, assetBase);
  img.src = typeof resolveUrl === "function" ? resolveUrl(raw) || raw : raw;
  return img;
}
