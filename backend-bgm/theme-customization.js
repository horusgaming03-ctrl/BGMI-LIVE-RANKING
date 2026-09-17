/**
 * Theme Customization — upload screenshot, extract palette, generate overlay theme.
 * Visual layer only — does not touch teams[], scoring, or match state.
 */

const fs = require("fs");
const path = require("path");
const multer = require("multer");
const BASE_TEMPLATES = require("./theme-base-templates");

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const ALLOWED_FAMILIES = new Set(["classic", "broadcast", "minimal"]);

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function emptyStore() {
  return { themes: [], lastAnalyzed: null };
}

function nextCustomId() {
  return `custom_${Date.now()}`;
}

function sanitizeFamily(v) {
  const f = String(v || "classic").toLowerCase();
  return ALLOWED_FAMILIES.has(f) ? f : "classic";
}

function sanitizeSourceImage(v, uploadsDir) {
  if (typeof v !== "string" || !v.startsWith("/uploads/theme-customization/")) return null;
  const rel = v.replace(/^\/uploads\/theme-customization\//, "");
  if (!rel || rel.includes("..") || rel.includes("\\")) return null;
  const abs = path.join(uploadsDir, "theme-customization", rel);
  if (!fs.existsSync(abs)) return null;
  return v;
}

function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s, l };
}

function toHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

function averageColor(list) {
  if (!list.length) return "#ffffff";
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of list) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  return toHex(r / list.length, g / list.length, b / list.length);
}

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return toHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

function estimateRowHeight(pixels, width, height) {
  if (!width || !height) return 42;
  const rowScores = [];
  for (let y = 1; y < height - 1; y += 1) {
    let diff = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const j = ((y - 1) * width + x) * 3;
      diff +=
        Math.abs(pixels[i] - pixels[j]) +
        Math.abs(pixels[i + 1] - pixels[j + 1]) +
        Math.abs(pixels[i + 2] - pixels[j + 2]);
    }
    rowScores.push({ y, diff });
  }
  rowScores.sort((a, b) => b.diff - a.diff);
  const peaks = rowScores.slice(0, 8).map((p) => p.y).sort((a, b) => a - b);
  if (peaks.length >= 2) {
    const gaps = [];
    for (let i = 1; i < peaks.length; i += 1) {
      const g = peaks[i] - peaks[i - 1];
      if (g >= 24 && g <= 72) gaps.push(g);
    }
    if (gaps.length) {
      gaps.sort((a, b) => a - b);
      return Math.round(gaps[Math.floor(gaps.length / 2)] * (720 / height));
    }
  }
  return 42;
}

function estimateEdgeContrast(pixels, width, height) {
  let total = 0;
  let count = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 1; x < width; x += 2) {
      const i = (y * width + x) * 3;
      const j = (y * width + x - 1) * 3;
      total +=
        Math.abs(pixels[i] - pixels[j]) +
        Math.abs(pixels[i + 1] - pixels[j + 1]) +
        Math.abs(pixels[i + 2] - pixels[j + 2]);
      count += 1;
    }
  }
  return count ? total / count : 0;
}

async function extractPalette(imagePath) {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    return null;
  }
  try {
    const { data, info } = await sharp(imagePath)
      .resize(160, 90, { fit: "inside" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = [];
    for (let i = 0; i < data.length; i += 3) {
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    }

    const dark = [];
    const bright = [];
    const saturated = [];
    const goldLike = [];

    for (const p of pixels) {
      const lum = luminance(p.r, p.g, p.b);
      const sat = saturation(p.r, p.g, p.b);
      const hsl = rgbToHsl(p.r, p.g, p.b);
      if (lum < 0.22) dark.push(p);
      if (lum > 0.62) bright.push(p);
      if (sat > 0.42 && lum > 0.12) saturated.push(p);
      if (hsl.h >= 32 && hsl.h <= 58 && sat > 0.3 && lum > 0.25) goldLike.push(p);
    }

    const background = averageColor(dark.length ? dark : pixels.filter((p) => luminance(p.r, p.g, p.b) < 0.35));
    const accent = averageColor(saturated.length ? saturated : pixels.filter((p) => saturation(p.r, p.g, p.b) > 0.25));
    const textPrimary = averageColor(bright.length ? bright : pixels.filter((p) => luminance(p.r, p.g, p.b) > 0.55));
    const textMuted = mixHex(background, textPrimary, 0.45);
    const gold = averageColor(goldLike.length ? goldLike : saturated.length ? saturated : bright);

    const aliveCandidates = saturated.filter((p) => {
      const hsl = rgbToHsl(p.r, p.g, p.b);
      return hsl.h >= 80 && hsl.h <= 160;
    });
    const alive = averageColor(aliveCandidates.length ? aliveCandidates : saturated.length ? saturated : [hexToRgb(accent)]);

    const dead = mixHex(background, "#000000", 0.35);
    const rowA = mixHex(background, textPrimary, 0.08);
    const rowB = mixHex(background, accent, 0.12);
    const rowHeight = estimateRowHeight(data, info.width, info.height);
    const edgeContrast = estimateEdgeContrast(data, info.width, info.height);

    let fontFamily = "'Rajdhani', 'Inter', sans-serif";
    if (edgeContrast > 42) fontFamily = "'Orbitron', 'Rajdhani', sans-serif";
    else if (edgeContrast > 24) fontFamily = "'Rajdhani', 'Inter', sans-serif";
    else fontFamily = "'Inter', 'Roboto', sans-serif";

    const glowStrength = saturated.length / Math.max(1, pixels.length) > 0.18 ? 0.35 : 0.18;

    return {
      background,
      accent,
      textPrimary,
      textMuted,
      gold,
      alive,
      dead,
      rowA,
      rowB,
      rowHeight,
      fontFamily,
      glowStrength,
      edgeContrast,
    };
  } catch (e) {
    console.warn("Theme image analysis failed:", e.message);
    return null;
  }
}

function applyPaletteToTheme(theme, family, palette, displayName) {
  const p = palette || {};
  const bg = p.background || theme.colors.secondary;
  const accent = p.accent || theme.colors.accent;
  const text = p.textPrimary || theme.colors.text;
  const muted = p.textMuted || theme.colors.textMuted;
  const gold = p.gold || theme.colors.gold;
  const alive = p.alive || accent;
  const dead = p.dead || theme.alive?.deadColor || "#333333";
  const rowH = p.rowHeight || theme.row?.height || 42;
  const font = p.fontFamily || theme.typography?.fontFamily;
  const glowA = p.glowStrength || 0.25;

  theme.name = displayName || theme.name;
  theme.colors.primary = accent;
  theme.colors.secondary = bg;
  theme.colors.accent = accent;
  theme.colors.text = text;
  theme.colors.textMuted = muted;
  theme.colors.gold = gold;

  if (theme.gradients) {
    theme.gradients.panel =
      family === "broadcast"
        ? bg
        : `linear-gradient(180deg, ${bg} 0%, ${mixHex(bg, "#000000", 0.25)} 100%)`;
    theme.gradients.header = accent;
    theme.gradients.topLine = `linear-gradient(90deg, ${accent}, ${gold}, ${accent})`;
    theme.gradients.wwcd = `linear-gradient(180deg, ${mixHex(bg, accent, 0.15)} 0%, ${bg} 100%)`;
  }

  if (theme.glow) {
    theme.glow.primary = glowA > 0.28 ? `0 0 20px ${rgba(accent, glowA)}` : theme.glow.primary || "none";
    theme.glow.accent = `0 0 12px ${rgba(accent, glowA * 0.8)}`;
    theme.glow.board = `0 8px 32px ${rgba("#000000", 0.55)}`;
  }

  if (theme.row) {
    theme.row.bgA = p.rowA || theme.row.bgA;
    theme.row.bgB = p.rowB || theme.row.bgB;
    theme.row.height = Math.max(34, Math.min(56, Math.round(rowH)));
  }

  if (theme.alive) {
    theme.alive.color = alive;
    theme.alive.deadColor = dead;
  }

  if (theme.typography) {
    theme.typography.fontFamily = font;
    if (theme.typography.numbersFontFamily) theme.typography.numbersFontFamily = font;
  }

  if (theme.wwcd) {
    theme.wwcd.titleColor = accent;
    theme.wwcd.teamColor = accent;
    theme.wwcd.borderColor = accent;
    theme.wwcd.mainColor = text;
  }

  if (family === "classic" && theme.esportsRanking) {
    theme.esportsRanking.panelBg = bg;
    theme.esportsRanking.rowBg = p.rowA || theme.esportsRanking.rowBg;
    theme.esportsRanking.rowBorder = rgba(accent, 0.55);
    theme.esportsRanking.rankGold = gold;
    theme.esportsRanking.aliveColor = alive;
    theme.esportsRanking.knockedColor = accent;
    theme.esportsRanking.headerRank = accent;
    theme.esportsRanking.footerTag = accent;
    theme.esportsRanking.fontFamily = font;
  }

  if (family === "broadcast" && theme.broadcast) {
    theme.broadcast.headerBg = mixHex(bg, accent, 0.35);
    theme.broadcast.headerText = muted;
    theme.broadcast.statsBg = bg;
    theme.broadcast.statsText = text;
    theme.broadcast.leftRowColor = p.rowA || theme.broadcast.leftRowColor;
    theme.broadcast.leftRowB = p.rowB || theme.broadcast.leftRowB;
    theme.broadcast.statusAlive = alive;
    theme.broadcast.statusDead = dead;
    theme.broadcast.knockedColor = accent;
  }

  if (family === "minimal" && theme.broadcast) {
    theme.broadcast.panelBgTop = mixHex(bg, text, 0.06);
    theme.broadcast.panelBgBottom = bg;
    theme.broadcast.panelBg = `linear-gradient(180deg, ${mixHex(bg, text, 0.06)} 0%, ${bg} 100%)`;
    theme.broadcast.headerBg = mixHex(bg, accent, 0.4);
    theme.broadcast.headerText = text;
    theme.broadcast.textColor = text;
    theme.broadcast.textDim = muted;
    theme.broadcast.statusAlive = alive;
    theme.broadcast.statusDead = dead;
    theme.broadcast.knockedColor = gold;
    theme.broadcast.eliminatedColor = accent;
  }

  return theme;
}

function buildThemeFromAnalysis(layoutFamily, palette, displayName) {
  const family = sanitizeFamily(layoutFamily);
  const base = deepClone(BASE_TEMPLATES[family] || BASE_TEMPLATES.classic);
  return applyPaletteToTheme(base, family, palette, displayName);
}

module.exports = function mountThemeCustomization({
  app,
  io,
  dataDir,
  uploadsDir,
  getSettings,
  persistAppSettings,
  getActiveTheme,
  setActiveTheme,
  sanitizeActiveTheme,
}) {
  const storeFile = path.join(dataDir, "theme-customization.json");
  const themeCustomizationDir = path.join(uploadsDir, "theme-customization");
  if (!fs.existsSync(themeCustomizationDir)) fs.mkdirSync(themeCustomizationDir, { recursive: true });

  let store = emptyStore();

  function saveStore() {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));
    } catch (e) {
      console.warn("Could not save theme-customization.json:", e.message);
    }
  }

  function loadStore() {
    try {
      if (!fs.existsSync(storeFile)) {
        store = emptyStore();
        return;
      }
      const raw = JSON.parse(fs.readFileSync(storeFile, "utf8"));
      store = {
        themes: Array.isArray(raw.themes) ? raw.themes : [],
        lastAnalyzed: raw.lastAnalyzed || null,
      };
    } catch (e) {
      console.warn("Could not load theme-customization.json:", e.message);
      store = emptyStore();
    }
  }

  function syncCustomOverlayThemes() {
    const settings = getSettings();
    const map = {};
    for (const entry of store.themes) {
      if (entry?.id && entry.theme && typeof entry.theme === "object") {
        map[entry.id] = entry.theme;
      }
    }
    settings.customOverlayThemes = map;
    persistAppSettings();
    io.emit("settingsUpdated", settings);
  }

  loadStore();
  syncCustomOverlayThemes();

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, themeCustomizationDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const safeExt = ALLOWED_IMAGE_EXTS.has(ext) ? ext : ".png";
        cb(null, `ref-${Date.now()}${safeExt}`);
      },
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const mime = String(file.mimetype || "").toLowerCase();
      const okExt = ALLOWED_IMAGE_EXTS.has(ext);
      const okMime = mime.startsWith("image/") && !mime.includes("svg");
      if (okExt && okMime) cb(null, true);
      else cb(new Error("Only PNG, JPG, JPEG, or WebP images are allowed."));
    },
  });

  function findTheme(id) {
    return store.themes.find((t) => t.id === id) || null;
  }

  function publicPayload() {
    return {
      themes: store.themes.map(({ id, name, layoutFamily, sourceImage, createdAt, theme }) => ({
        id,
        name,
        layoutFamily,
        sourceImage,
        createdAt,
        theme,
      })),
      lastAnalyzed: store.lastAnalyzed,
      activeTheme: getActiveTheme(),
    };
  }

  app.get("/theme-customization", (_req, res) => {
    res.json(publicPayload());
  });

  app.post("/theme-customization/upload", (req, res) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        const msg = err.code === "LIMIT_FILE_SIZE" ? "Image must be 8 MB or smaller." : err.message;
        return res.status(400).json({ error: msg });
      }
      if (!req.file) return res.status(400).json({ error: "No image received." });
      const url = `/uploads/theme-customization/${req.file.filename}`;
      res.json({ sourceImage: url, ok: true });
    });
  });

  app.post("/theme-customization/analyze", async (req, res) => {
    const layoutFamily = sanitizeFamily(req.body?.layoutFamily);
    const sourceImage = sanitizeSourceImage(req.body?.sourceImage, uploadsDir);
    if (!sourceImage) return res.status(400).json({ error: "Valid sourceImage path is required." });

    const displayName = String(req.body?.name || "Custom Theme").trim().slice(0, 80) || "Custom Theme";
    const absPath = path.join(uploadsDir, "theme-customization", path.basename(sourceImage));
    const palette = await extractPalette(absPath);
    const theme = buildThemeFromAnalysis(layoutFamily, palette, displayName);

    let entry = null;
    const existingId = typeof req.body?.id === "string" ? req.body.id.trim() : "";
    if (existingId && findTheme(existingId)) {
      entry = findTheme(existingId);
      entry.name = displayName;
      entry.layoutFamily = layoutFamily;
      entry.sourceImage = sourceImage;
      entry.theme = theme;
    } else {
      entry = {
        id: nextCustomId(),
        name: displayName,
        layoutFamily,
        sourceImage,
        createdAt: Date.now(),
        theme,
      };
      store.themes.unshift(entry);
    }

    store.lastAnalyzed = {
      id: entry.id,
      at: Date.now(),
      layoutFamily,
      sourceImage,
      palette: palette || null,
      analysisFailed: !palette,
    };

    saveStore();
    syncCustomOverlayThemes();

    res.json({
      ok: true,
      theme: entry,
      analysisFailed: !palette,
      message: palette ? "Theme analyzed from image." : "Analysis unavailable — using family defaults.",
    });
  });

  app.post("/theme-customization/save", (req, res) => {
    const body = req.body || {};
    const layoutFamily = sanitizeFamily(body.layoutFamily);
    const sourceImage = body.sourceImage ? sanitizeSourceImage(body.sourceImage, uploadsDir) : null;
    const name = String(body.name || "Custom Theme").trim().slice(0, 80) || "Custom Theme";
    const themeObj = body.theme && typeof body.theme === "object" ? body.theme : null;
    if (!themeObj) return res.status(400).json({ error: "theme object is required." });

    let entry = null;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (id && findTheme(id)) {
      entry = findTheme(id);
      entry.name = name;
      entry.layoutFamily = layoutFamily;
      if (sourceImage) entry.sourceImage = sourceImage;
      entry.theme = themeObj;
    } else {
      entry = {
        id: id && /^custom_[a-zA-Z0-9_]+$/.test(id) ? id : nextCustomId(),
        name,
        layoutFamily,
        sourceImage,
        createdAt: Date.now(),
        theme: themeObj,
      };
      store.themes.unshift(entry);
    }

    saveStore();
    syncCustomOverlayThemes();
    res.json({ ok: true, theme: entry });
  });

  app.post("/theme-customization/:id/apply", (req, res) => {
    const entry = findTheme(req.params.id);
    if (!entry) return res.status(404).json({ error: "Theme not found." });
    const safeId = sanitizeActiveTheme(entry.id);
    setActiveTheme(safeId);
    res.json({ ok: true, theme: safeId, activeTheme: getActiveTheme() });
  });

  app.post("/theme-customization/:id/rename", (req, res) => {
    const entry = findTheme(req.params.id);
    if (!entry) return res.status(404).json({ error: "Theme not found." });
    const name = String(req.body?.name || "").trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: "name is required." });
    entry.name = name;
    if (entry.theme && typeof entry.theme === "object") entry.theme.name = name;
    saveStore();
    syncCustomOverlayThemes();
    res.json({ ok: true, theme: entry });
  });

  app.patch("/theme-customization/:id/theme", (req, res) => {
    const entry = findTheme(req.params.id);
    if (!entry) return res.status(404).json({ error: "Theme not found." });
    const patch = req.body?.theme;
    if (!patch || typeof patch !== "object") return res.status(400).json({ error: "theme patch required." });
    entry.theme = { ...entry.theme, ...patch };
    if (patch.colors && typeof patch.colors === "object") {
      entry.theme.colors = { ...entry.theme.colors, ...patch.colors };
    }
    if (patch.alive && typeof patch.alive === "object") {
      entry.theme.alive = { ...entry.theme.alive, ...patch.alive };
    }
    if (patch.row && typeof patch.row === "object") {
      entry.theme.row = { ...entry.theme.row, ...patch.row };
    }
    saveStore();
    syncCustomOverlayThemes();
    res.json({ ok: true, theme: entry });
  });

  app.delete("/theme-customization/:id", (req, res) => {
    const id = req.params.id;
    const idx = store.themes.findIndex((t) => t.id === id);
    if (idx < 0) return res.status(404).json({ error: "Theme not found." });

    const entry = store.themes[idx];
    store.themes.splice(idx, 1);

    if (getActiveTheme() === id) {
      setActiveTheme("esports");
    }

    if (entry?.sourceImage) {
      const rel = entry.sourceImage.replace(/^\/uploads\/theme-customization\//, "");
      const abs = path.join(themeCustomizationDir, rel);
      if (fs.existsSync(abs)) {
        try {
          fs.unlinkSync(abs);
        } catch {
          /* ignore */
        }
      }
    }

    saveStore();
    syncCustomOverlayThemes();
    res.json({ ok: true, activeTheme: getActiveTheme() });
  });
};
