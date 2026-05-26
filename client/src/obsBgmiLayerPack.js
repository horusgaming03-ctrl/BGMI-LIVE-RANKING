/**
 * OBS multi-layer BGMI/PUBG ranking overlay — defaults + merge (client).
 * Server mirrors via sanitizeObsBgmiLayerPackServer() in backend-bgm/index.js
 */

/** Exactly three deco plates: live ranking art, eliminator, top‑4 alive strip (+ live data rows overlay). */
export const OBS_BGMI_LAYER_IDS = ["main_ranking_png", "eliminator_png", "top_four_alive_png"];

/** @type {Record<string, { label: string; hint: string }>} */
export const OBS_BGMI_LAYER_META = {
  main_ranking_png: {
    label: "Live ranking overlay",
    hint: 'PNG frame/decoration only recommended — Admin “minimal” overlays rank, FF/TF, team, dots so art is not duplicated. Use ?chrome=board for built-in gold rows.',
  },
  eliminator_png: { label: "Eliminator", hint: "Killfeed / elimination graphic plate" },
  top_four_alive_png: {
    label: "Top 4 alive strip",
    hint: "Squad strip behind or beside gameplay (decorative; no duplicated text needed in rows)",
  },
};

/** OBS URL slug → canonical layer id (for /overlay/bgmi-layer-plate/:slug) */
export const BGMI_LAYER_PLATE_URL_ALIASES = Object.freeze({
  main: "main_ranking_png",
  main_ranking: "main_ranking_png",
  main_ranking_png: "main_ranking_png",
  ranking: "main_ranking_png",
  live: "main_ranking_png",
  ranking_panel: "main_ranking_png",
  panel: "main_ranking_png",
  eliminator: "eliminator_png",
  eliminator_png: "eliminator_png",
  elims: "eliminator_png",
  top4: "top_four_alive_png",
  top_four: "top_four_alive_png",
  top_four_alive: "top_four_alive_png",
  top_four_alive_png: "top_four_alive_png",
  four_alive: "top_four_alive_png",
  /** “4 alive strip” shorthand — same slot as Top 4 alive */
  strip: "top_four_alive_png",
  alive_strip: "top_four_alive_png",
  squad_strip: "top_four_alive_png",
});

/** @returns {string|null} */
export function resolveBgmiLayerPlateId(slug) {
  if (typeof slug !== "string") return null;
  const trimmed = slug.trim();
  if (!trimmed) return null;
  if (OBS_BGMI_LAYER_IDS.includes(trimmed)) return trimmed;
  const key = trimmed.toLowerCase().replace(/-/g, "_");
  const mapped = BGMI_LAYER_PLATE_URL_ALIASES[key];
  return mapped && OBS_BGMI_LAYER_IDS.includes(mapped) ? mapped : null;
}

function clampPct(n, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, x));
}

function clampInt(n, min, max, fallback) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

function boolish(v, def) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  return def;
}

export function defaultObsBgmiLayerPack() {
  const layers = {};
  const defaults = [
    { id: "main_ranking_png", leftPct: 69, topPct: 7, widthPct: 29, heightPct: 86, scalePct: 100, zIndex: 12, visible: true, path: null },
    { id: "eliminator_png", leftPct: 2, topPct: 8, widthPct: 34, heightPct: 22, scalePct: 100, zIndex: 50, visible: true, path: null },
    { id: "top_four_alive_png", leftPct: 2, topPct: 68, widthPct: 42, heightPct: 18, scalePct: 100, zIndex: 40, visible: true, path: null },
  ];
  for (const d of defaults) {
    layers[d.id] = { ...d };
  }
  return {
    layers,
    dataPanel: {
      visible: true,
      topPct: 10,
      leftPct: 71.5,
      widthPct: 26.5,
      heightPct: 80,
      rowCap: 18,
      fpMetric: "finishes",
      showAliveDots: true,
      accent: "#22c55e",
      /** PNG carries frame/column titles — overlay is text + logos + dots only. Use `board` for built‑in gold row chrome. */
      chrome: "minimal",
      /** `contain`: top/left/width/height % are relative to the *drawn PNG*, not letterbox margins. `viewport`: legacy fullscreen %. */
      dataAnchor: "viewport",
      /** When FF+TF (`FP shows`: Total PTS), render two numeric cells instead of one combined “FF / TF”. */
      metricLayout: "merged",
      showRankPill: true,
    },
  };
}

function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

/** Accept stored paths returned by Node or pasted URLs; coerce to `/uploads/obs-bgmi-layered/…`. */
export function normalizeBgmiLayerStoredPath(rawPath) {
  if (typeof rawPath !== "string") return null;
  let s = rawPath.trim().replace(/\\/g, "/");
  if (!s || s.includes("..")) return null;
  const chunk = "/uploads/obs-bgmi-layered/";
  /** Find `/uploads/obs-bgmi-layered/` case-insensitive (handles pasted full URLs). */
  const lower = s.toLowerCase();
  const at = lower.indexOf("/uploads/obs-bgmi-layered/");
  if (at >= 0) {
    s = chunk + s.slice(at + chunk.length);
  }
  if (s.startsWith("uploads/obs-bgmi-layered/")) s = `/${s}`;
  if (!s.startsWith(chunk)) return null;
  const rest = s.slice(chunk.length).replace(/^\/+/u, "");
  if (!rest || rest.includes("..") || rest.includes("\\")) return null;
  return `${chunk}${rest}`;
}

/**
 * Authoritative snapshot from GET /settings or socket — use server object as seed:
 * mergeObsBgmiLayerPack({}, payload).
 *
 * Merge a partial patch onto defaults or prevState when editing in Admin.
 */
export function mergeObsBgmiLayerPack(patch, prevState = null) {
  const defaults = defaultObsBgmiLayerPack();
  const seed = prevState && typeof prevState === "object" ? deepClone(prevState) : deepClone(defaults);
  if (!patch || typeof patch !== "object") return normalizeStoredPaths(seed);

  const out = deepClone(seed);

  if (patch.dataPanel && typeof patch.dataPanel === "object") {
    const dp = patch.dataPanel;
    if ("visible" in dp) out.dataPanel.visible = boolish(dp.visible, out.dataPanel.visible);
    if ("topPct" in dp) out.dataPanel.topPct = clampPct(dp.topPct, defaults.dataPanel.topPct);
    if ("leftPct" in dp) out.dataPanel.leftPct = clampPct(dp.leftPct, defaults.dataPanel.leftPct);
    if ("widthPct" in dp) out.dataPanel.widthPct = clampPct(dp.widthPct, defaults.dataPanel.widthPct);
    if ("heightPct" in dp) out.dataPanel.heightPct = clampPct(dp.heightPct, defaults.dataPanel.heightPct);
    if ("rowCap" in dp) out.dataPanel.rowCap = clampInt(dp.rowCap, 4, 32, defaults.dataPanel.rowCap);
    if ("fpMetric" in dp) out.dataPanel.fpMetric = String(dp.fpMetric) === "points" ? "points" : "finishes";
    if ("showAliveDots" in dp) out.dataPanel.showAliveDots = boolish(dp.showAliveDots, out.dataPanel.showAliveDots);
    if ("accent" in dp && typeof dp.accent === "string" && /^#[0-9A-Fa-f]{6}$/.test(dp.accent.trim())) {
      out.dataPanel.accent = dp.accent.trim().toLowerCase();
    }
    if ("chrome" in dp && typeof dp.chrome === "string") {
      const c = dp.chrome.trim().toLowerCase();
      out.dataPanel.chrome = c === "board" ? "board" : "minimal";
    }
    if ("dataAnchor" in dp && typeof dp.dataAnchor === "string") {
      const a = dp.dataAnchor.trim().toLowerCase();
      out.dataPanel.dataAnchor = a === "contain" ? "contain" : "viewport";
    }
    if ("metricLayout" in dp && typeof dp.metricLayout === "string") {
      const m = dp.metricLayout.trim().toLowerCase();
      out.dataPanel.metricLayout = m === "split" ? "split" : "merged";
    }
    if ("showRankPill" in dp) out.dataPanel.showRankPill = boolish(dp.showRankPill, out.dataPanel.showRankPill !== false);
  }

  const incoming = patch.layers && typeof patch.layers === "object" ? patch.layers : {};
  for (const id of OBS_BGMI_LAYER_IDS) {
    const raw = incoming[id];
    if (!raw || typeof raw !== "object") continue;
    const cur = { ...(out.layers[id] || defaults.layers[id]) };
    if ("path" in raw) {
      const normalized = normalizeBgmiLayerStoredPath(raw.path);
      cur.path = normalized;
    }
    if ("visible" in raw) cur.visible = boolish(raw.visible, cur.visible !== false);
    if ("leftPct" in raw) cur.leftPct = clampPct(raw.leftPct, defaults.layers[id].leftPct);
    if ("topPct" in raw) cur.topPct = clampPct(raw.topPct, defaults.layers[id].topPct);
    if ("widthPct" in raw) cur.widthPct = Math.max(0.5, clampPct(raw.widthPct, defaults.layers[id].widthPct));
    if ("heightPct" in raw)
      cur.heightPct = raw.heightPct == null ? defaults.layers[id].heightPct : clampPct(raw.heightPct, defaults.layers[id].heightPct);
    if ("scalePct" in raw) cur.scalePct = clampInt(raw.scalePct, 20, 300, defaults.layers[id].scalePct);
    if ("zIndex" in raw) cur.zIndex = clampInt(raw.zIndex, 0, 999, defaults.layers[id].zIndex);
    out.layers[id] = cur;
  }

  return normalizeStoredPaths(out);
}

function normalizeStoredPaths(pack) {
  if (!pack || typeof pack !== "object") return pack;
  const defaults = defaultObsBgmiLayerPack();
  pack.dataPanel = {
    ...defaults.dataPanel,
    ...(pack.dataPanel && typeof pack.dataPanel === "object" ? pack.dataPanel : {}),
  };
  pack.layers = pack.layers && typeof pack.layers === "object" ? pack.layers : {};
  for (const id of OBS_BGMI_LAYER_IDS) {
    pack.layers[id] = {
      ...defaults.layers[id],
      ...(pack.layers[id] && typeof pack.layers[id] === "object" ? pack.layers[id] : {}),
    };
    pack.layers[id].path = normalizeBgmiLayerStoredPath(pack.layers[id].path);
  }
  const keep = new Set(OBS_BGMI_LAYER_IDS);
  for (const k of Object.keys(pack.layers)) {
    if (!keep.has(k)) delete pack.layers[k];
  }
  return pack;
}