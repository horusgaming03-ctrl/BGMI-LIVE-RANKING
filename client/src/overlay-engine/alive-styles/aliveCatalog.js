import { LEGACY_ALIVE_STYLE_IDS } from "./aliveIds";

const MODES = [
  "quad_sq",
  "quad_round",
  "quad_circ",
  "quad_hex",
  "quad_diamond",
  "row_dots",
  "bar_seg",
  "ring_hollow",
  "strip_wide",
  "pill_row",
  "outline_sq",
  "skew_tile",
  "mini_grid",
  "bar_tight",
  "hex_dot",
  "split_vert",
];

/** ~16 modes × 11 variants = 176 procedural styles (IDs alv_000 … alv_175) */
export function buildAliveCatalog() {
  const total = MODES.length * 11;
  const list = [];
  for (let i = 0; i < total; i++) {
    const mode = MODES[i % MODES.length];
    const variant = Math.floor(i / MODES.length);
    list.push({
      id: `alv_${String(i).padStart(3, "0")}`,
      mode,
      variant,
      label: `${mode}_v${variant}`,
    });
  }
  return list;
}

let _cat = null;
let _allIds = null;

export function getAliveCatalog() {
  if (!_cat) _cat = buildAliveCatalog();
  return _cat;
}

export function getAliveEntry(id) {
  const m = typeof id === "string" ? /^alv_(\d+)$/.exec(id) : null;
  if (!m) return null;
  const idx = Number(m[1]);
  const c = getAliveCatalog();
  return c[idx] ?? null;
}

export function isValidAliveId(id) {
  if (!id || typeof id !== "string") return false;
  if (LEGACY_ALIVE_STYLE_IDS.includes(id)) return true;
  return !!getAliveEntry(id);
}

export function getAllAliveStyleIds() {
  if (!_allIds) {
    _allIds = [...LEGACY_ALIVE_STYLE_IDS, ...getAliveCatalog().map((x) => x.id)];
  }
  return _allIds;
}
