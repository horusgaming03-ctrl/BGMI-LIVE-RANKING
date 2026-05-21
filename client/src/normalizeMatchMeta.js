const ALLOWED_MAP = new Set(["erangel", "miramar", "rondo"]);

/**
 * Strip Socket.IO match payloads down to header fields (`teams` array ignored).
 * Coerces `number` so overlays/admin stay in sync even if JSON typing differs.
 */
export function normalizeMatchMeta(data) {
  if (!data || typeof data !== "object") return null;
  const mapRaw = typeof data.map === "string" ? data.map.trim().toLowerCase() : "erangel";
  return {
    number: Math.max(1, Number(data.number) || 1),
    status: typeof data.status === "string" ? data.status : "live",
    startedAt: typeof data.startedAt === "number" ? data.startedAt : Date.now(),
    map: ALLOWED_MAP.has(mapRaw) ? mapRaw : "erangel",
    matchLabel: typeof data.matchLabel === "string" ? data.matchLabel : "",
  };
}
