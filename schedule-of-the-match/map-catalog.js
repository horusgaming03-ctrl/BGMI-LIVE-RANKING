/** BGMI / PUBG map presets — Erangel, Miramar, Rondo only */
export const MAP_CATALOG = {
  erangel: {
    label: "Erangel",
    displayName: "ERANGEL",
    asset: "../assets/maps/erangel.jpg",
  },
  miramar: {
    label: "Miramar",
    displayName: "MIRAMAR",
    asset: "../assets/maps/miramar.jpg",
  },
  rondo: {
    label: "Rondo",
    displayName: "RONDO",
    asset: "../assets/maps/rondo.jpg",
  },
};

export const MAP_KEYS = Object.keys(MAP_CATALOG);

export function resolveMapImage(match, basePath = "") {
  if (match.mapImageUrl) return match.mapImageUrl;
  const key = (match.mapKey || "erangel").toLowerCase();
  const entry = MAP_CATALOG[key] || MAP_CATALOG.erangel;
  const rel = entry.asset.replace(/^\.\.\//, "");
  return basePath ? `${basePath.replace(/\/?$/, "/")}${rel}` : entry.asset;
}

export function mapDisplayName(match) {
  if (match.mapName) return String(match.mapName).toUpperCase();
  const key = normalizeMapKey(match.mapKey);
  return MAP_CATALOG[key].displayName;
}

/** Only erangel | miramar | rondo — legacy keys fall back to erangel */
export function normalizeMapKey(mapKey) {
  const k = String(mapKey || "erangel").toLowerCase();
  return MAP_CATALOG[k] ? k : "erangel";
}

export function normalizeMatchMaps(config) {
  if (!config?.matches) return config;
  config.matches.forEach((m) => {
    m.mapKey = normalizeMapKey(m.mapKey);
    if (!m.mapName || !MAP_CATALOG[m.mapKey]) {
      m.mapName = MAP_CATALOG[m.mapKey].displayName;
    }
  });
  return config;
}
