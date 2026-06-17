function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return null;
  let n = hex.trim().replace(/^#/, "");
  if (n.length === 3) n = n.split("").map((c) => c + c).join("");
  if (n.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(n)) return null;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

/** Pick black or white label text for a row background. */
export function contrastTextOnBg(hex, dark = "#0a0a0a", light = "#ffffff") {
  const c = hexToRgb(hex);
  if (!c) return dark;
  const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return lum > 0.58 ? dark : light;
}

/**
 * One team-area color drives every left row (stripes, highlight, hot row).
 * Legacy per-field overrides still work when leftRowColor is not set.
 */
export function resolveLeftRowPalette(bc = {}) {
  const single = bc.leftRowColor || bc.leftRowA;
  if (bc.leftRowColor) {
    const row = bc.leftRowColor;
    return {
      leftRowA: row,
      leftRowB: row,
      leftRowAccent: row,
      leftRowHot: row,
      leftText: contrastTextOnBg(row),
    };
  }

  return {
    leftRowA: single || "#ffffff",
    leftRowB: bc.leftRowB || "#d8d4f0",
    leftRowAccent: bc.leftRowAccent || "#c4bee8",
    leftRowHot: bc.leftRowHot || "#ff6b00",
    leftText: bc.leftText || contrastTextOnBg(single || "#ffffff"),
  };
}

/** BMPS left-panel row stripe / highlight pattern (configurable colors via CSS). */
export function getBmpsLeftRowVariant(rank, index, options = {}) {
  const hotRank = Number(options.hotRank) || 7;
  if (rank === hotRank && options.enableHotRank !== false) return "hot";
  if (rank === 1 || rank >= 15) return "accent";
  return index % 2 === 0 ? "a" : "b";
}

export const LIVE_RANKING_FONT_OPTIONS = [
  { id: "teko", label: "Teko", stack: "'Teko', sans-serif" },
  { id: "rajdhani", label: "Rajdhani", stack: "'Rajdhani', sans-serif" },
  { id: "bebas", label: "Bebas Neue", stack: "'Bebas Neue', sans-serif" },
  { id: "orbitron", label: "Orbitron", stack: "'Orbitron', sans-serif" },
  { id: "oswald", label: "Oswald", stack: "'Oswald', sans-serif" },
  { id: "inter", label: "Inter", stack: "'Inter', system-ui, sans-serif" },
];

export function resolveFontStack(idOrStack, fallback = "'Teko', sans-serif") {
  if (!idOrStack || typeof idOrStack !== "string") return fallback;
  if (idOrStack.includes(",")) return idOrStack;
  const hit = LIVE_RANKING_FONT_OPTIONS.find((f) => f.id === idOrStack);
  return hit?.stack || fallback;
}

/** Sample teams for theme preview — 16 rows like BMPS broadcast. */
export const BMPS_PREVIEW_TEAMS = [
  { id: 1, team: "TAG", finishes: 9, points: 59, logo: null, alivePlayers: 4, status: "alive" },
  { id: 2, team: "RC", finishes: 8, points: 53, logo: null, alivePlayers: 4, status: "alive" },
  { id: 3, team: "ABZ", finishes: 7, points: 50, logo: null, alivePlayers: 3, status: "knocked" },
  { id: 4, team: "GDR", finishes: 6, points: 48, logo: null, alivePlayers: 4, status: "alive" },
  { id: 5, team: "GODL", finishes: 5, points: 45, logo: null, alivePlayers: 2, status: "knocked" },
  { id: 6, team: "SOUL", finishes: 5, points: 44, logo: null, alivePlayers: 4, status: "alive" },
  { id: 7, team: "K9", finishes: 4, points: 42, logo: null, alivePlayers: 1, status: "knocked" },
  { id: 8, team: "IQ", finishes: 4, points: 40, logo: null, alivePlayers: 0, status: "eliminated" },
  { id: 9, team: "FS", finishes: 3, points: 38, logo: null, alivePlayers: 4, status: "alive" },
  { id: 10, team: "BLIND", finishes: 3, points: 36, logo: null, alivePlayers: 3, status: "knocked" },
  { id: 11, team: "OR", finishes: 2, points: 34, logo: null, alivePlayers: 4, status: "alive" },
  { id: 12, team: "8BIT", finishes: 2, points: 32, logo: null, alivePlayers: 0, status: "eliminated" },
  { id: 13, team: "NXT", finishes: 1, points: 28, logo: null, alivePlayers: 2, status: "knocked" },
  { id: 14, team: "WBG", finishes: 1, points: 26, logo: null, alivePlayers: 0, status: "eliminated" },
  { id: 15, team: "T4M", finishes: 0, points: 22, logo: null, alivePlayers: 1, status: "knocked" },
  { id: 16, team: "WOLF", finishes: 0, points: 20, logo: null, alivePlayers: 0, status: "eliminated" },
];
