const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const fs = require("fs");

const googleInt = require("./google/googleIntegration");

const ROOT = path.join(__dirname, "..");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));

const uploadsDir = path.join(ROOT, "uploads");
const logosDir = path.join(uploadsDir, "logos");
const screenshotsDir = path.join(uploadsDir, "screenshots");
const tournamentDir = path.join(uploadsDir, "tournament");
const aliveIconsDir = path.join(uploadsDir, "alive-icons");
const overallStandingsDir = path.join(uploadsDir, "overall-standings");
const wwcdCharsDir = path.join(uploadsDir, "wwcd-chars");
const obsSharedTripleDir = path.join(uploadsDir, "obs-shared-triple");

[uploadsDir, logosDir, screenshotsDir, tournamentDir, aliveIconsDir, overallStandingsDir, wwcdCharsDir, obsSharedTripleDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use("/uploads", express.static(uploadsDir));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST", "DELETE"] },
});

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, logosDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `team-${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

const tournamentLogoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tournamentDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".png";
      cb(null, `tournament-logo-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"];
    const mimeOk = typeof file.mimetype === "string" && file.mimetype.startsWith("image/");
    if (allowed.includes(ext) || mimeOk) return cb(null, true);
    cb(new Error(`Only image files allowed (got ${ext || file.mimetype || "unknown"})`));
  },
});

const aliveIconUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, aliveIconsDir),
    filename: (req, file, cb) => {
      const role = req.query.role === "dead" ? "dead" : "alive";
      const ext = path.extname(file.originalname || "") || ".png";
      const low = ext.toLowerCase();
      const safe = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(low) ? low : ".png";
      cb(null, `${role}-${Date.now()}${safe}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
    const mimeOk = typeof file.mimetype === "string" && file.mimetype.startsWith("image/");
    if (allowed.includes(ext) || mimeOk) return cb(null, true);
    cb(new Error("Only image files allowed for alive icons"));
  },
});

const overallStandingsBgUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, overallStandingsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "") || ".png";
      cb(null, `overall-bg-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowed = [".png", ".jpg", ".jpeg", ".jpe", ".jfif", ".gif", ".webp", ".svg", ".bmp", ".avif", ".heic"];
    const mime = typeof file.mimetype === "string" ? file.mimetype.toLowerCase() : "";
    const mimeOk = mime.startsWith("image/");
    const octetOk = mime === "application/octet-stream" && allowed.includes(ext);
    if (allowed.includes(ext) || mimeOk || octetOk) return cb(null, true);
    cb(new Error(`Only image files allowed (got ${ext || file.mimetype || "unknown"})`));
  },
});

const screenshotUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, screenshotsDir),
    filename: (_req, file, cb) => {
      cb(null, `ss-${Date.now()}${path.extname(file.originalname)}`);
    },
  }),
});

const wwcdCharUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, wwcdCharsDir),
    filename: (req, file, cb) => {
      const slot = Math.max(0, Math.min(3, parseInt(req.params.slot, 10) || 0));
      const ext = path.extname(file.originalname || "") || ".png";
      cb(null, `wwcd-slot-${slot}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"];
    const mimeOk = typeof file.mimetype === "string" && file.mimetype.startsWith("image/");
    if (allowed.includes(ext) || mimeOk) return cb(null, true);
    cb(new Error("Only image files allowed for WWCD characters"));
  },
});

/** PNG only — wired to `/overlay/obs-slot/*`; all three OBS URLs fetch the same file (/uploads/obs-shared-triple/...). */
const obsSharedTriplePngUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, obsSharedTripleDir),
    filename: (_req, _file, cb) => {
      cb(null, `obs-slot-${Date.now()}.png`);
    },
  }),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    // Trust `.png` only — multer/OS MIME pairs are inconsistent (often octet-stream or empty).
    if (ext === ".png") return cb(null, true);
    cb(new Error("OBS shared-slot upload accepts PNG files only."));
  },
});

// ── BGMI placement points + 1 pt per finish (`finishes`) in recalculatePoints ──
// #1→10, #2→6, #3→5, #4→4, #5→3, #6→2, #7→1, #8→1, #9–#25→0
const POSITION_POINTS = { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 };
function getPositionPoints(rank) {
  const r = Math.floor(Number(rank));
  if (!Number.isFinite(r) || r < 1 || r > 25) return 0;
  return POSITION_POINTS[r] ?? 0;
}

const ALLOWED_BGMI_MAPS = new Set(["erangel", "miramar", "rondo"]);

function sanitizeMatchMap(raw) {
  const k = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (ALLOWED_BGMI_MAPS.has(k)) return k;
  return "erangel";
}

function sanitizeMatchLabel(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim().slice(0, 72);
  return s;
}

function extractDriveOrSheetId(raw, kind) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (kind === "folder") {
    const m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
  }
  if (kind === "sheet") {
    const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return s.split("/")[0] || "";
}

function sanitizeGoogleIntegration(raw) {
  const base = {
    enabled: false,
    driveFolderId: "",
    registrationSpreadsheetId: "",
    registrationRange: "Form Responses 1!A:Z",
    syncIntervalMs: 120000,
    autoUpload: true,
    lastExportAt: null,
    lastSheetsSyncAt: null,
    lastDriveSyncAt: null,
    importedDriveFileIds: [],
    lastError: null,
  };
  if (!raw || typeof raw !== "object") return base;
  return {
    enabled: Boolean(raw.enabled),
    driveFolderId: extractDriveOrSheetId(raw.driveFolderId, "folder"),
    registrationSpreadsheetId: extractDriveOrSheetId(raw.registrationSpreadsheetId, "sheet"),
    registrationRange:
      typeof raw.registrationRange === "string" && raw.registrationRange.trim()
        ? raw.registrationRange.trim().slice(0, 120)
        : base.registrationRange,
    syncIntervalMs: Math.max(30_000, Math.min(3_600_000, Number(raw.syncIntervalMs) || 120_000)),
    autoUpload: raw.autoUpload !== false,
    lastExportAt: typeof raw.lastExportAt === "string" ? raw.lastExportAt : null,
    lastSheetsSyncAt: typeof raw.lastSheetsSyncAt === "string" ? raw.lastSheetsSyncAt : null,
    lastDriveSyncAt: typeof raw.lastDriveSyncAt === "string" ? raw.lastDriveSyncAt : null,
    importedDriveFileIds: Array.isArray(raw.importedDriveFileIds)
      ? raw.importedDriveFileIds.filter((x) => typeof x === "string" && x.length < 120).slice(0, 5000)
      : [],
    lastError: typeof raw.lastError === "string" ? raw.lastError.slice(0, 500) : null,
  };
}

/** Treat CSV / legacy payloads safely — Boolean("false") === true otherwise. */
function coerceJsonBool(v, defaultVal = false) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (v == null || v === "") return defaultVal;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
    return defaultVal;
  }
  return defaultVal;
}

function isRondoMapActive() {
  return sanitizeMatchMap(currentMatch.map) === "rondo";
}

/** Each seated player has one Rondo redeploy credit per match (4 total). Consumed per player recalled. */
const RONDO_RECALL_CHARGE_CAP = 4;

function coerceRecallChargesFromTeam(team) {
  const raw = team.rondoRecallChargesRemaining;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(RONDO_RECALL_CHARGE_CAP, Math.trunc(raw)));
  }
  if (typeof raw === "string" && String(raw).trim() !== "") {
    const n = Number(String(raw).trim());
    if (Number.isFinite(n)) return Math.max(0, Math.min(RONDO_RECALL_CHARGE_CAP, Math.trunc(n)));
  }
  const consumed = coerceJsonBool(team.rondoRecallConsumed, false);
  return consumed ? 0 : RONDO_RECALL_CHARGE_CAP;
}

/** Defaults for Rondo recall fields when loading persisted teams. */
function normalizeTeamRondoFields(team) {
  if (!team || typeof team !== "object") return team;
  team.rondoRecallChargesRemaining = coerceRecallChargesFromTeam(team);
  team.rondoRecallConsumed = team.rondoRecallChargesRemaining <= 0;
  team.rondoAwaitingRecall = coerceJsonBool(team.rondoAwaitingRecall, false);
  return team;
}

/** Defaults for `sideOverlayPrefs` — mirror client/src/sideOverlayPrefs.js */
const SIDE_OVERLAY_DEFAULT_PREFS_BACKEND = {
  groupLabel: "GROUP A",
  useLiveMatchNumber: true,
  matchNumberManual: 4,
  useLiveMapName: true,
  mapNameManual: "",
  mapOrdinal: null,
  logoPanelBg: "#f7931e",
  topBarBg: "#ffffff",
  topBarText: "#151515",
  mapAreaBgStart: "#0f5f5f",
  mapAreaBgEnd: "#073030",
  mapNameColor: "#ffffff",
  sparkleColor: "#e63946",
  showSparkle: true,
  bannerScale: 1,
};

/** Coerce `#rgb` / `#rrggbbaa` / `#rrggbb` → `#rrggbb` (matches client clampHexColor) */
function normalizeSideOverlayHex(value, fallback) {
  const fb =
    typeof fallback === "string" && /^#[0-9A-Fa-f]{6}$/.test(String(fallback).trim())
      ? String(fallback).trim().toLowerCase()
      : "#ffffff";
  if (value == null || typeof value !== "string") return fb;
  const s = value.trim();
  const m = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.exec(s);
  if (!m) return fb;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  else if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return fb;
  return `#${h.toLowerCase()}`;
}

function sanitizeSideOverlayPrefs(raw) {
  const d = SIDE_OVERLAY_DEFAULT_PREFS_BACKEND;
  const hc = (v, fb) => normalizeSideOverlayHex(v, fb);

  if (!raw || typeof raw !== "object") return { ...d };

  let mapOrdinal = null;
  if (raw.mapOrdinal !== null && raw.mapOrdinal !== undefined && raw.mapOrdinal !== "") {
    const n = Number(raw.mapOrdinal);
    if (Number.isFinite(n) && n >= 1) mapOrdinal = Math.min(999, Math.trunc(n));
  }

  let matchNum = Number(raw.matchNumberManual);
  if (!Number.isFinite(matchNum) || matchNum < 1) matchNum = d.matchNumberManual;
  matchNum = Math.min(9999, Math.trunc(matchNum));

  let scale = Number(raw.bannerScale);
  if (!Number.isFinite(scale)) scale = d.bannerScale;
  scale = Math.max(0.5, Math.min(1.5, scale));

  const grp = typeof raw.groupLabel === "string" ? raw.groupLabel.trim().slice(0, 40) : "";
  let mapNm = "";
  if (typeof raw.mapNameManual === "string") mapNm = raw.mapNameManual.trim().slice(0, 72);

  return {
    groupLabel: grp || d.groupLabel,
    useLiveMatchNumber: coerceJsonBool(raw.useLiveMatchNumber, true),
    matchNumberManual: matchNum,
    useLiveMapName: coerceJsonBool(raw.useLiveMapName, true),
    mapNameManual: mapNm,
    mapOrdinal,
    logoPanelBg: hc(raw.logoPanelBg, d.logoPanelBg),
    topBarBg: hc(raw.topBarBg, d.topBarBg),
    topBarText: hc(raw.topBarText, d.topBarText),
    mapAreaBgStart: hc(raw.mapAreaBgStart, d.mapAreaBgStart),
    mapAreaBgEnd: hc(raw.mapAreaBgEnd, d.mapAreaBgEnd),
    mapNameColor: hc(raw.mapNameColor, d.mapNameColor),
    sparkleColor: hc(raw.sparkleColor, d.sparkleColor),
    showSparkle: coerceJsonBool(raw.showSparkle, true),
    bannerScale: scale,
  };
}

// ── State ──
let teams = [];
let currentMatch = {
  number: 1,
  status: "live",
  startedAt: Date.now(),
  map: "erangel",
  matchLabel: "",
};

let matchHistory = [];
let settings = {
  autoCalculate: true,
  tournamentLogo: null,
  engineOverlayPrefs: null,
  /** Match board /overlay/themed alive icons — separate so broadcast-engine saves don't wipe them */
  themedOverlayPrefs: null,
  themeColorOverrides: {},
  /** Custom full-bleed PNG for `/overlay/themed/overall` points table */
  overallStandingsBg: null,
  /** One PNG for three isolated OBS URLs: /overlay/obs-slot/(eliminations|top-four|live-ranking) — no transform, same file. */
  obsSharedTriplePng: null,
  /** Overlay cells: gold4 (#·TEAM·FP·STATUS) vs live5 (dashboard FIN·TOTAL·pings). */
  obsSharedTripleColumns: "live5",
  /** When obsSharedTripleColumns === gold4, FP shows points or finishes (dashboard Kills). */
  obsTripleFpMetric: "points",
  /** Per-slot art for `/overlay/wwcd` character cards: null | /uploads/wwcd-chars/... | https://... */
  wwcdCharacterArts: [null, null, null, null],
  /** Google Drive + Sheets (see .env GOOGLE_APPLICATION_CREDENTIALS) */
  googleIntegration: sanitizeGoogleIntegration({}),
  /** Live match board theme id (must match client theme names, e.g. cyberpunk) — persisted across restarts */
  activeTheme: "esports",
  /** Banner strip for `/overlay/side-banner` (tournament graphic + match / map titles) */
  sideOverlayPrefs: sanitizeSideOverlayPrefs({}),
};

const dataDir = path.join(ROOT, "data");
const settingsPersistFile = path.join(dataDir, "app-settings.json");
const teamsStateFile = path.join(dataDir, "teams-state.json");

let matchStatePersistTimer = null;
function schedulePersistMatchState() {
  if (matchStatePersistTimer) clearTimeout(matchStatePersistTimer);
  matchStatePersistTimer = setTimeout(() => {
    matchStatePersistTimer = null;
    persistMatchState();
  }, 280);
}

function persistMatchState() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      teamsStateFile,
      JSON.stringify(
        {
          teams,
          currentMatch,
          matchHistory,
        },
        null,
        2
      )
    );
  } catch (e) {
    console.warn("Could not save teams-state.json:", e.message);
  }
}

function loadMatchState() {
  try {
    if (!fs.existsSync(teamsStateFile)) {
      console.log("[match-state] No data/teams-state.json yet — teams list starts empty (add teams in Admin).");
      return;
    }
    const raw = JSON.parse(fs.readFileSync(teamsStateFile, "utf8"));
    if (Array.isArray(raw.teams)) {
      teams = raw.teams.map((t) => normalizeTeamRondoFields({ ...t }));
    }
    if (raw.currentMatch && typeof raw.currentMatch === "object") {
      currentMatch = {
        number: Math.max(1, Number(raw.currentMatch.number) || 1),
        status: typeof raw.currentMatch.status === "string" ? raw.currentMatch.status : "live",
        startedAt: typeof raw.currentMatch.startedAt === "number" ? raw.currentMatch.startedAt : Date.now(),
        map: sanitizeMatchMap(raw.currentMatch.map),
        matchLabel: sanitizeMatchLabel(raw.currentMatch.matchLabel),
      };
    }
    if (Array.isArray(raw.matchHistory)) {
      matchHistory = raw.matchHistory;
    }
    console.log(
      `[match-state] Restored ${teams.length} team(s), match #${currentMatch.number}, ${matchHistory.length} history entr(y/ies).`
    );
  } catch (e) {
    console.warn("Could not load teams-state.json:", e.message);
  }
}

function emitHistoryUpdated() {
  io.emit("historyUpdated", matchHistory);
}

/** Clears live scoring on every roster row (same baseline as after POST /match/new). */
function resetAllTeamsLiveScores() {
  teams = teams.map((t) => ({
    ...t,
    status: "alive",
    finishes: 0,
    points: 0,
    alivePlayers: 4,
    positionPoints: 0,
    eliminationRank: null,
    rondoRecallChargesRemaining: RONDO_RECALL_CHARGE_CAP,
    rondoRecallConsumed: false,
    rondoAwaitingRecall: false,
  }));
}

/** Clears saved series history and resets every squad's live scores with Match #1 (current map kept). */
function performFullTournamentRestart() {
  matchHistory = [];
  currentMatch.number = 1;
  currentMatch.status = "live";
  currentMatch.startedAt = Date.now();
  currentMatch.matchLabel = "";
  resetAllTeamsLiveScores();
}

/** Push / replace finalized snapshot for currentMatch.number — used when ending a match or starting a new live one while still live */
function archiveCurrentMatchSnapshot() {
  if (!Array.isArray(teams) || teams.length === 0) return;

  const num = Number(currentMatch.number);
  matchHistory = matchHistory.filter((m) => Number(m.number) !== num);

  const winner = teams.find((t) => t.eliminationRank === 1);

  matchHistory.push({
    id: Date.now(),
    number: currentMatch.number,
    status: "ended",
    startedAt: currentMatch.startedAt,
    endedAt: Date.now(),
    map: currentMatch.map || "erangel",
    matchLabel: currentMatch.matchLabel || "",
    teams: teams.map((t) => ({ ...t })),
    winner: winner ? winner.team : null,
  });

  schedulePersistMatchState();
  emitHistoryUpdated();
}

function sanitizeAliveIconPathServer(s) {
  if (typeof s !== "string" || !s.startsWith("/uploads/alive-icons/")) return null;
  if (s.includes("..")) return null;
  return s;
}

function sanitizeOverallStandingsBgServer(s) {
  if (typeof s !== "string" || !s.startsWith("/uploads/overall-standings/")) return null;
  if (s.includes("..")) return null;
  return s;
}

function sanitizeObsSharedTriplePngServer(s) {
  if (typeof s !== "string" || !s.startsWith("/uploads/obs-shared-triple/")) return null;
  if (s.includes("..")) return null;
  return s;
}

/** OBS triple overlay row shape — persisted (pick what your PNG artwork shows). */
function sanitizeObsSharedTripleColumnsServer(v) {
  if (v === "gold4") return "gold4";
  if (v === "live5") return "live5";
  return "live5";
}

/** FP cell in gold4 maps to dashboard PTS or Kills (`finishes`). */
function sanitizeObsTripleFpMetricServer(v) {
  if (v === "finishes") return "finishes";
  return "points";
}

function sanitizeWwcdCharacterArts(input) {
  const src = Array.isArray(input) ? input : [];
  return [0, 1, 2, 3].map((i) => {
    const v = src[i];
    if (v == null || v === "") return null;
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (!t || t.includes("..")) return null;
    if (t.startsWith("/uploads/wwcd-chars/")) return t;
    if (/^https?:\/\//i.test(t) && t.length <= 2048) return t;
    return null;
  });
}

function sanitizeThemedOverlayPrefs(raw) {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  return {
    aliveStyle: typeof raw.aliveStyle === "string" ? raw.aliveStyle : "heart",
    aliveLayout: raw.aliveLayout === "line" ? "line" : "grid",
    aliveCustomAlive: sanitizeAliveIconPathServer(raw.aliveCustomAlive),
    aliveCustomDead: sanitizeAliveIconPathServer(raw.aliveCustomDead),
  };
}

/** Theme id for /overlay/themed — same pattern as themeColorOverrides keys */
function sanitizeActiveThemeServer(v) {
  if (v == null || v === "") return "esports";
  if (typeof v !== "string") return "esports";
  const t = v.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(t)) return "esports";
  return t;
}

function loadPersistedSettings() {
  try {
    if (!fs.existsSync(settingsPersistFile)) return;
    const raw = JSON.parse(fs.readFileSync(settingsPersistFile, "utf8"));
    if (typeof raw.autoCalculate === "boolean") settings.autoCalculate = raw.autoCalculate;
    if (raw.tournamentLogo === null || typeof raw.tournamentLogo === "string") {
      settings.tournamentLogo = raw.tournamentLogo;
    }
    if (raw.engineOverlayPrefs && typeof raw.engineOverlayPrefs === "object") {
      settings.engineOverlayPrefs = raw.engineOverlayPrefs;
    }
    if (raw.themeColorOverrides && typeof raw.themeColorOverrides === "object" && !Array.isArray(raw.themeColorOverrides)) {
      settings.themeColorOverrides = raw.themeColorOverrides;
    }
    if (raw.themedOverlayPrefs && typeof raw.themedOverlayPrefs === "object") {
      settings.themedOverlayPrefs = sanitizeThemedOverlayPrefs(raw.themedOverlayPrefs);
    }
    if (Object.prototype.hasOwnProperty.call(raw, "overallStandingsBg")) {
      settings.overallStandingsBg = sanitizeOverallStandingsBgServer(raw.overallStandingsBg);
    }
    if (Object.prototype.hasOwnProperty.call(raw, "obsSharedTriplePng")) {
      settings.obsSharedTriplePng = sanitizeObsSharedTriplePngServer(raw.obsSharedTriplePng);
    }
    if (Object.prototype.hasOwnProperty.call(raw, "obsSharedTripleColumns")) {
      settings.obsSharedTripleColumns = sanitizeObsSharedTripleColumnsServer(raw.obsSharedTripleColumns);
    }
    if (Object.prototype.hasOwnProperty.call(raw, "obsTripleFpMetric")) {
      settings.obsTripleFpMetric = sanitizeObsTripleFpMetricServer(raw.obsTripleFpMetric);
    }
    if (Array.isArray(raw.wwcdCharacterArts)) {
      settings.wwcdCharacterArts = sanitizeWwcdCharacterArts(raw.wwcdCharacterArts);
    }
    if (raw.googleIntegration && typeof raw.googleIntegration === "object") {
      settings.googleIntegration = sanitizeGoogleIntegration(raw.googleIntegration);
    }
    if (Object.prototype.hasOwnProperty.call(raw, "activeTheme")) {
      settings.activeTheme = sanitizeActiveThemeServer(raw.activeTheme);
    }
    const hasValidSidePrefs =
      raw.sideOverlayPrefs != null &&
      typeof raw.sideOverlayPrefs === "object" &&
      !Array.isArray(raw.sideOverlayPrefs);
    if (hasValidSidePrefs) {
      settings.sideOverlayPrefs = sanitizeSideOverlayPrefs(raw.sideOverlayPrefs);
    } else {
      /* Older app-settings.json omitted this block — write once so overlays + admin share the same snapshot */
      persistAppSettings();
    }
    if (!settings.themedOverlayPrefs && settings.engineOverlayPrefs && typeof settings.engineOverlayPrefs === "object") {
      const op = String(settings.engineOverlayPrefs.overlayPath || "")
        .replace(/\/+$/, "")
        .trim();
      if (op === "/overlay/themed") {
        settings.themedOverlayPrefs = sanitizeThemedOverlayPrefs(settings.engineOverlayPrefs);
        persistAppSettings();
      }
    }
  } catch (e) {
    console.warn("Could not load app-settings.json:", e.message);
  }
}

function persistAppSettings() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      settingsPersistFile,
      JSON.stringify(
        {
          autoCalculate: settings.autoCalculate,
          tournamentLogo: settings.tournamentLogo,
          engineOverlayPrefs: settings.engineOverlayPrefs,
          themedOverlayPrefs: settings.themedOverlayPrefs,
          themeColorOverrides: settings.themeColorOverrides,
          overallStandingsBg: settings.overallStandingsBg,
          obsSharedTriplePng: settings.obsSharedTriplePng,
          obsSharedTripleColumns: settings.obsSharedTripleColumns,
          obsTripleFpMetric: settings.obsTripleFpMetric,
          wwcdCharacterArts: settings.wwcdCharacterArts,
          googleIntegration: settings.googleIntegration,
          activeTheme: settings.activeTheme,
          sideOverlayPrefs: settings.sideOverlayPrefs,
        },
        null,
        2
      )
    );
  } catch (e) {
    console.warn("Could not save app-settings.json:", e.message);
  }
}

loadPersistedSettings();
loadMatchState();

let overlayTheme = {
  headerBg: "#2a2520",
  headerText: "#e0d0b0",
  rowBg1: "#1c1a20",
  rowBg2: "#232128",
  aliveColor: "#d4a23e",
  knockedColor: "#c47a20",
  eliminatedColor: "#2a2d42",
  accentColor: "#d4a23e",
  cardBg: "#1a1820",
  textColor: "#ffffff",
};

let activeThemeName = sanitizeActiveThemeServer(settings.activeTheme);

let wwcdColors = {
  primary: "",
  gold: "",
  accent: "",
  bg: "",
};

// ── Helpers ──
function sanitizeThemeColorOverrides(input) {
  const hex = /^#[0-9A-Fa-f]{3,8}$/;
  const safeThemeId = (k) => typeof k === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(k);
  const cleanHexMap = (o) => {
    if (!o || typeof o !== "object") return undefined;
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof k !== "string" || k.length > 48) continue;
      if (typeof v === "string" && hex.test(v.trim())) out[k] = v.trim();
    }
    return Object.keys(out).length ? out : undefined;
  };
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out = {};
  for (const [themeId, patch] of Object.entries(input)) {
    if (!safeThemeId(themeId) || !patch || typeof patch !== "object") continue;
    const entry = {};
    const c = cleanHexMap(patch.colors);
    if (c) entry.colors = c;
    const a = cleanHexMap(patch.alive);
    if (a) entry.alive = a;
    const r = cleanHexMap(patch.row);
    if (r) entry.row = r;
    if (Object.keys(entry).length) out[themeId] = entry;
  }
  return out;
}

/** Pin `displayOrder` to row 1…N; unassigned rows filled from auto pool in team id order (no A–Z / points). */
function buildLiveRankingOrder(teamList) {
  const arr = Array.isArray(teamList) ? [...teamList] : [];
  const n = arr.length;
  if (n === 0) return [];

  const byRow = new Map();
  const auto = [];
  const sortedInput = [...arr].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));

  for (const t of sortedInput) {
    const raw = Number(t.displayOrder);
    if (Number.isFinite(raw) && raw > 0) {
      let row = Math.trunc(raw);
      if (row < 1) row = 1;
      if (row > n) row = n;
      if (byRow.has(row)) auto.push(t);
      else byRow.set(row, t);
    } else {
      auto.push(t);
    }
  }
  auto.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));

  const out = [];
  let ai = 0;
  for (let row = 1; row <= n; row++) {
    if (byRow.has(row)) out.push(byRow.get(row));
    else if (ai < auto.length) out.push(auto[ai++]);
  }
  while (ai < auto.length) out.push(auto[ai++]);

  const seen = new Set(out.map((t) => t.id));
  for (const t of arr) {
    if (!seen.has(t.id)) {
      out.push(t);
      seen.add(t.id);
    }
  }
  return out;
}

const sortTeams = () => {
  for (let i = 0; i < teams.length; i++) normalizeTeamRondoFields(teams[i]);
  return buildLiveRankingOrder(teams);
};

/** When moving or placing a team at slot `slot` (1-based), swap with occupant if any. `previousSlot` is this team's old slot (null if none / new team). */
function reconcileDisplayOrderSlot(teamId, slot, previousSlot) {
  if (slot == null || !Number.isFinite(Number(slot)) || Number(slot) <= 0) return;
  const sid = Number(teamId);
  const n = Math.trunc(Number(slot));
  const prev =
    previousSlot != null && Number.isFinite(Number(previousSlot)) && Number(previousSlot) > 0
      ? Math.trunc(Number(previousSlot))
      : null;
  const otherIdx = teams.findIndex(
    (t) => Number(t.id) !== sid && Number(t.displayOrder) === n,
  );
  if (otherIdx !== -1) {
    teams[otherIdx].displayOrder = prev;
  }
}

const broadcast = () => {
  const sorted = sortTeams();
  io.emit("teamsUpdated", sorted);
  io.emit("matchUpdated", { ...currentMatch, teams: sorted });
  io.emit("tournamentUpdated", getTournamentStats());
  schedulePersistMatchState();
  scheduleGoogleExport();
};

const broadcastTournament = () => {
  io.emit("tournamentUpdated", getTournamentStats());
  schedulePersistMatchState();
};

const recalculatePoints = (team) => {
  if (!settings.autoCalculate) return;
  // Winner stays alive but gets eliminationRank === 1 in checkForWinner — still needs #1 placement pts.
  team.positionPoints = getPositionPoints(team.eliminationRank);
  team.points = (Number(team.finishes) || 0) + team.positionPoints;
};

const eliminateTeam = (team) => {
  team.status = "eliminated";
  team.alivePlayers = 0;
  team.rondoAwaitingRecall = false;
  team.rondoRecallChargesRemaining = 0;
  team.rondoRecallConsumed = true;
  const remaining = teams.filter(
    (t) => String(t.status) !== "eliminated" && String(t.status) !== "rondo_benched",
  ).length;
  team.eliminationRank = remaining + 1;
  recalculatePoints(team);
  io.emit("teamEliminated", {
    team: team.team,
    logo: team.logo,
    id: team.id,
    rank: team.eliminationRank,
    finishes: team.finishes,
    points: team.points,
  });
  checkForWinner();
};

function rondoBenchTeam(team) {
  team.status = "rondo_benched";
  team.alivePlayers = 0;
  team.eliminationRank = null;
  team.rondoAwaitingRecall = true;
  team.positionPoints = 0;
  if (settings.autoCalculate) team.points = (Number(team.finishes) || 0) + team.positionPoints;
  io.emit("rondoBench", {
    team: team.team,
    logo: team.logo,
    id: team.id,
    awaitingRecall: true,
  });
  checkForWinner();
}

/** Full squad wipe — on Rondo, benches instead of elimination while the squad still has any recall credits. */
function tryCommitFullElimination(team) {
  normalizeTeamRondoFields(team);
  if (!isRondoMapActive()) {
    eliminateTeam(team);
    return;
  }
  if ((team.rondoRecallChargesRemaining || 0) <= 0) {
    eliminateTeam(team);
    return;
  }
  rondoBenchTeam(team);
}

const padSquadNames = (playerList, teamName) => {
  const arr = Array.isArray(playerList) ? playerList.filter(Boolean).map((s) => String(s).trim()) : [];
  const t = String(teamName || "TEAM").toUpperCase();
  for (let i = arr.length; i < 4; i++) arr.push(`${t} · P${i + 1}`);
  return arr.slice(0, 4).map((s) => s.toUpperCase());
};

const splitFinishesAcrossSquad = (total) => {
  const n = 4;
  const t = Math.max(0, Number(total) || 0);
  const base = Math.floor(t / n);
  let r = t % n;
  return Array.from({ length: n }, (_, i) => base + (i < r ? 1 : 0));
};

const buildWwcdTeamStatsPayload = (winner) => {
  const names = padSquadNames(winner.players, winner.team);
  const finishes = splitFinishesAcrossSquad(winner.finishes);
  return {
    team: winner.team,
    logo: winner.logo,
    id: winner.id,
    matchNumber: currentMatch.number,
    teamFinishes: winner.finishes || 0,
    players: names.map((name, i) => ({
      name,
      finishes: finishes[i],
    })),
  };
};

const checkForWinner = () => {
  const competing = teams.filter((t) => {
    const s = String(t.status || "").toLowerCase();
    return s === "alive" || s === "knocked";
  });
  if (competing.length === 1 && teams.length > 1) {
    const winner = competing[0];
    winner.eliminationRank = 1;
    recalculatePoints(winner);
    io.emit("chickenDinner", buildWwcdTeamStatsPayload(winner));
  }
};

const getTournamentStats = () => {
  const statsMap = {};

  const processTeamList = (teamList, matchNum) => {
    teamList.forEach((t) => {
      if (!statsMap[t.team]) {
        statsMap[t.team] = {
          team: t.team,
          logo: t.logo,
          totalPoints: 0,
          totalKills: 0,
          totalPositionPoints: 0,
          chickenDinners: 0,
          matchesPlayed: 0,
          matchPoints: [],
        };
      }
      const s = statsMap[t.team];
      s.totalPoints += t.points || 0;
      s.totalKills += t.finishes || 0;
      s.totalPositionPoints += t.positionPoints || 0;
      s.matchesPlayed++;
      if (t.logo) s.logo = t.logo;
      if (t.eliminationRank === 1) s.chickenDinners++;
      s.matchPoints.push({ match: matchNum, points: t.points || 0, kills: t.finishes || 0, rank: t.eliminationRank });
    });
  };

  matchHistory.forEach((m) => processTeamList(m.teams, m.number));
  if (String(currentMatch.status || "live").toLowerCase() === "live") {
    processTeamList(teams, currentMatch.number);
  }

  const result = Object.values(statsMap).sort(
    (a, b) => b.totalPoints - a.totalPoints || b.totalKills - a.totalKills
  );

  let prevRank = 0;
  result.forEach((s, i) => {
    s.rank = i + 1;
    s.prevRank = prevRank;
    prevRank = s.rank;
  });

  return result;
};

function applyRegistrationFromSheet(row) {
  const teamName = String(row.team || "")
    .toUpperCase()
    .trim();
  if (!teamName) return;
  const players = Array.isArray(row.players) ? row.players : [];
  const existing = teams.findIndex((t) => t.team === teamName);
  if (existing !== -1) {
    teams[existing].players = padSquadNames(players, teamName);
  } else {
    teams.push({
      id: Date.now() + Math.floor(Math.random() * 9999),
      team: teamName,
      status: "alive",
      finishes: 0,
      points: 0,
      displayOrder: null,
      logo: null,
      alivePlayers: 4,
      positionPoints: 0,
      eliminationRank: null,
      players: padSquadNames(players, teamName),
      rondoRecallChargesRemaining: RONDO_RECALL_CHARGE_CAP,
      rondoRecallConsumed: false,
      rondoAwaitingRecall: false,
    });
  }
}

let googleExportTimer = null;
function scheduleGoogleExport() {
  const gi = settings.googleIntegration;
  if (!gi?.enabled || !gi?.autoUpload) return;
  if (!gi.driveFolderId || !googleInt.credentialsPathResolved()) return;
  clearTimeout(googleExportTimer);
  googleExportTimer = setTimeout(() => {
    runGoogleDriveExport().catch((e) => {
      settings.googleIntegration.lastError = (e.message || String(e)).slice(0, 500);
      console.warn("[google export]", e.message || e);
      persistAppSettings();
    });
  }, 90000);
}

async function runGoogleDriveExport() {
  const gi = settings.googleIntegration;
  if (!gi.driveFolderId) return;
  const clients = googleInt.getClients();
  if (!clients) throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path");
  const stats = getTournamentStats();
  const bundle = googleInt.buildExportBundle({
    teams,
    matchHistory,
    currentMatch,
    tournamentStats: stats,
  });
  const csv = googleInt.tournamentStatsToCsvRows(stats);
  await googleInt.uploadTournamentSnapshot(clients, gi.driveFolderId, bundle, csv);
  gi.lastExportAt = new Date().toISOString();
  gi.lastError = null;
  persistAppSettings();
}

async function runGoogleSheetsSync() {
  const gi = settings.googleIntegration;
  if (!gi.registrationSpreadsheetId) return { merged: 0, rows: 0, errors: ["No spreadsheet id configured"] };
  const clients = googleInt.getClients();
  if (!clients) throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS");
  const result = await googleInt.syncRegistrationSheet(
    clients,
    gi.registrationSpreadsheetId,
    gi.registrationRange,
    teams,
    (row) => applyRegistrationFromSheet(row)
  );
  if (result.merged > 0) broadcast();
  gi.lastSheetsSyncAt = new Date().toISOString();
  if (result.errors.length) gi.lastError = result.errors.join("; ").slice(0, 500);
  else gi.lastError = null;
  persistAppSettings();
  return result;
}

async function runGoogleDriveFolderSync() {
  const gi = settings.googleIntegration;
  if (!gi.driveFolderId) return { imported: 0, skipped: 0 };
  const clients = googleInt.getClients();
  if (!clients) throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS");
  const r = await googleInt.syncFolderImages(
    clients.drive,
    gi.driveFolderId,
    teams,
    logosDir,
    gi.importedDriveFileIds,
    (team, relPath) => {
      team.logo = relPath;
    }
  );
  if (r.imported > 0) broadcast();
  gi.lastDriveSyncAt = new Date().toISOString();
  persistAppSettings();
  return r;
}

let googlePollTimer = null;
function restartGooglePoller() {
  clearInterval(googlePollTimer);
  const gi = settings.googleIntegration;
  if (!gi.enabled || !googleInt.credentialsPathResolved()) return;
  const ms = gi.syncIntervalMs || 120000;
  googlePollTimer = setInterval(() => {
    if (!settings.googleIntegration.enabled) return;
    runGoogleSheetsSync().catch((e) => console.warn("[google sheets]", e.message));
    runGoogleDriveFolderSync().catch((e) => console.warn("[google drive]", e.message));
  }, ms);
  console.log(`[google] Polling Drive + Sheets every ${ms}ms`);
}

// ── Existing Routes (backward-compatible) ──

/** Admin “Screen order”: 1 = first row; unset / 0 = sort by points (standings). */
function parseDisplayOrderInput(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const t = Math.trunc(n);
  return Math.min(99999, Math.max(1, t));
}

app.get("/teams", (req, res) => {
  res.json(sortTeams());
});

app.post("/teams", (req, res) => {
  const team = String(req.body.team || "").toUpperCase().trim();
  if (!team) return res.status(400).json({ message: "team required" });

  const nextOrder = parseDisplayOrderInput(req.body.displayOrder);
  const item = {
    id: Date.now(),
    team,
    status: req.body.status || "alive",
    finishes: Number(req.body.finishes || 0),
    points: Number(req.body.points || 0),
    displayOrder: nextOrder,
    logo: null,
    alivePlayers: 4,
    positionPoints: 0,
    eliminationRank: null,
    players: req.body.players || [],
    rondoRecallChargesRemaining: RONDO_RECALL_CHARGE_CAP,
    rondoRecallConsumed: false,
    rondoAwaitingRecall: false,
  };

  teams.push(item);
  if (nextOrder != null) reconcileDisplayOrderSlot(item.id, nextOrder, null);
  broadcast();
  res.status(201).json(item);
});

app.post("/teams/:id/players", (req, res) => {
  const id = Number(req.params.id);
  const idx = teams.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ message: "not found" });
  teams[idx].players = Array.isArray(req.body.players) ? req.body.players : [];
  broadcast();
  res.json(teams[idx]);
});

app.post("/teams/register", (req, res) => {
  const team = String(req.body.team || "").toUpperCase().trim();
  if (!team) return res.status(400).json({ message: "team name required" });

  const existing = teams.findIndex((t) => t.team === team);
  if (existing !== -1) {
    teams[existing].players = req.body.players || teams[existing].players || [];
    broadcast();
    return res.json({ updated: true, team: teams[existing] });
  }

  const item = {
    id: Date.now(),
    team,
    status: "alive",
    finishes: 0,
    points: 0,
    displayOrder: null,
    logo: null,
    alivePlayers: 4,
    positionPoints: 0,
    eliminationRank: null,
    players: req.body.players || [],
    rondoRecallChargesRemaining: RONDO_RECALL_CHARGE_CAP,
    rondoRecallConsumed: false,
    rondoAwaitingRecall: false,
  };
  teams.push(item);
  broadcast();
  res.status(201).json({ created: true, team: item });
});

app.post("/teams/:id", (req, res) => {
  const id = Number(req.params.id);
  const idx = teams.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ message: "not found" });

  const prevStatus = teams[idx].status;
  const wasEliminated = prevStatus === "eliminated";
  let nextStatus = req.body.status !== undefined ? req.body.status : teams[idx].status;
  const wantsEliminated = String(nextStatus || "").toLowerCase() === "eliminated";

  /** Defer writing "eliminated" until elimination pipeline runs — Rondo benches first wipe. Not for finalize-from-bench. */
  if (!wasEliminated && wantsEliminated && prevStatus !== "rondo_benched") nextStatus = prevStatus;

  const cur = teams[idx];
  const prevSlot =
    cur.displayOrder != null && Number(cur.displayOrder) > 0 ? Number(cur.displayOrder) : null;
  let nextDisplayOrder =
    req.body.displayOrder !== undefined ? parseDisplayOrderInput(req.body.displayOrder) : cur.displayOrder ?? null;

  if (req.body.displayOrder !== undefined && nextDisplayOrder != null) {
    if (prevSlot !== nextDisplayOrder) {
      reconcileDisplayOrderSlot(id, nextDisplayOrder, prevSlot);
    }
  }

  teams[idx] = {
    ...cur,
    team: String(req.body.team || cur.team).toUpperCase(),
    status: nextStatus,
    finishes: Number(req.body.finishes ?? cur.finishes),
    points: Number(req.body.points ?? cur.points),
    displayOrder: nextDisplayOrder,
  };

  if (!wasEliminated && wantsEliminated) {
    if (prevStatus === "rondo_benched") eliminateTeam(teams[idx]);
    else tryCommitFullElimination(teams[idx]);
  } else if (settings.autoCalculate) {
    recalculatePoints(teams[idx]);
  }

  broadcast();
  res.json(teams[idx]);
});

app.delete("/teams/:id", (req, res) => {
  const id = Number(req.params.id);
  teams = teams.filter((t) => t.id !== id);
  broadcast();
  res.json({ ok: true });
});

// ── Knock System ──

app.post("/teams/:id/knock", (req, res) => {
  const id = Number(req.params.id);
  const idx = teams.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ message: "not found" });

  const team = teams[idx];
  if (team.status === "rondo_benched") {
    return res.status(400).json({
      message: "Benched for Rondo recall — use Recall, set eliminated from roster, or Final OUT here",
    });
  }
  const knockReq = Number(req.body.knockCount);
  const knockCount = Number.isFinite(knockReq) ? knockReq : 1;

  /** Only treat explicit truthy markers as full elimination — stray strings like "false" must not wipe. */
  const fullFlag = req.body.fullElimination;
  const forcedFullElimination =
    fullFlag === true ||
    fullFlag === 1 ||
    (typeof fullFlag === "string" && fullFlag.trim().toLowerCase() === "true");

  if (knockCount >= 4 || forcedFullElimination) {
    tryCommitFullElimination(team);
  } else {
    team.alivePlayers = Math.max(0, 4 - knockCount);
    if (team.alivePlayers === 0) {
      tryCommitFullElimination(team);
    } else {
      team.status = "knocked";
    }
  }

  broadcast();
  res.json(team);
});

app.post("/teams/:id/alive", (req, res) => {
  const id = Number(req.params.id);
  const idx = teams.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ message: "not found" });

  const count = Math.max(0, Math.min(4, Number(req.body.alivePlayers)));
  if (teams[idx].status === "rondo_benched") {
    return res.status(400).json({ message: "Cannot set alive count while benched — trigger Rondo recall first" });
  }
  teams[idx].alivePlayers = count;

  if (count === 0) {
    tryCommitFullElimination(teams[idx]);
  } else if (count < 4) {
    teams[idx].status = "knocked";
  } else {
    teams[idx].status = "alive";
  }

  broadcast();
  res.json(teams[idx]);
});

app.post("/teams/:id/rondo-recall", (req, res) => {
  if (!isRondoMapActive()) return res.status(400).json({ message: "Rondo recall only when match map is Rondo" });

  const id = Number(req.params.id);
  const idx = teams.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ message: "not found" });

  normalizeTeamRondoFields(teams[idx]);
  const team = teams[idx];
  const st = String(team.status || "").toLowerCase();
  const ap = Math.max(0, Math.min(4, Number(team.alivePlayers) || 0));
  let charges = team.rondoRecallChargesRemaining;
  const awaitingRecall = coerceJsonBool(team.rondoAwaitingRecall, false);

  const fromBench = st === "rondo_benched" && awaitingRecall;

  const partialEligible =
    charges > 0 &&
    st !== "eliminated" &&
    st !== "rondo_benched" &&
    ap >= 1 &&
    ap <= 3 &&
    (st === "alive" || st === "knocked");

  if (!fromBench && !partialEligible) {
    return res.status(400).json({
      message:
        charges <= 0
          ? "No recall credits left on this squad (4 total per match, one per seated player)."
          : "Recall unavailable — need recall bench awaiting deploy, or 1–3 players up mid-fight.",
    });
  }

  team.rondoAwaitingRecall = false;

  if (fromBench) {
    const maxBenchSlots = Math.min(4, charges);
    const rawBody = req.body && (req.body.addAliveSlots ?? req.body.redeployCount);
    let addSlots;
    if (rawBody === undefined || rawBody === null || rawBody === "") {
      addSlots = maxBenchSlots;
    } else {
      const n = Number(rawBody);
      if (!Number.isFinite(n)) {
        return res.status(400).json({ message: "addAliveSlots must be a number (knocked seats to redeploy from bench)." });
      }
      addSlots = Math.trunc(n);
      if (addSlots < 1 || addSlots > maxBenchSlots) {
        return res.status(400).json({
          message: `Bench redeploy uses 1–${maxBenchSlots} recall credit(s); each credit returns one seated player.`,
        });
      }
    }
    charges -= addSlots;
    team.rondoRecallChargesRemaining = charges;
    team.alivePlayers = addSlots;
    team.status = addSlots === 4 ? "alive" : "knocked";
  } else {
    const maxAdd = 4 - ap;
    const rawBody = req.body && (req.body.addAliveSlots ?? req.body.redeployCount);
    let addSlots;
    if (rawBody === undefined || rawBody === null || rawBody === "") {
      addSlots = Math.min(maxAdd, charges);
    } else {
      const n = Number(rawBody);
      if (!Number.isFinite(n)) {
        return res.status(400).json({ message: "addAliveSlots must be a number (how many knocked players to recall)." });
      }
      addSlots = Math.trunc(n);
      if (addSlots < 1 || addSlots > maxAdd) {
        return res.status(400).json({
          message: `Recall must revive 1–${maxAdd} player slot(s) (currently ${ap}/4 up).`,
        });
      }
    }
    if (addSlots > charges) {
      return res.status(400).json({
        message: `Need ${addSlots} recall credits but squad only has ${charges} left (one credit per recalled player).`,
      });
    }
    const nextAlive = Math.min(4, ap + addSlots);
    team.alivePlayers = nextAlive;
    team.status = nextAlive === 4 ? "alive" : "knocked";
    team.rondoRecallChargesRemaining = charges - addSlots;
  }

  team.rondoRecallConsumed = team.rondoRecallChargesRemaining <= 0;
  if (settings.autoCalculate) recalculatePoints(team);
  broadcast();
  res.json(team);
});

/** Mistaken OUT on Rondo (first wipe) — bench only. Restores full 4/4 alive; does not spend or refund recall credits. */
app.post("/teams/:id/rondo-undo-out", (req, res) => {
  if (!isRondoMapActive()) return res.status(400).json({ message: "Undo OUT only when match map is Rondo" });

  const id = Number(req.params.id);
  const idx = teams.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ message: "not found" });

  normalizeTeamRondoFields(teams[idx]);
  const team = teams[idx];
  if (String(team.status || "").toLowerCase() !== "rondo_benched") {
    return res.status(400).json({
      message: "Undo OUT only works while the squad is on recall bench (mistaken wipe). If already eliminated, edit the team in Roster or Match stats.",
    });
  }

  team.status = "alive";
  team.alivePlayers = 4;
  team.rondoAwaitingRecall = false;
  team.eliminationRank = null;
  if (settings.autoCalculate) recalculatePoints(team);
  checkForWinner();
  broadcast();
  res.json(team);
});

// ── Match Management ──

app.get("/match/current", (_req, res) => {
  res.json({ ...currentMatch, teams: sortTeams() });
});

app.post("/match/new", (_req, res) => {
  if (teams.length > 0 && String(currentMatch.status || "live").toLowerCase() === "live") {
    archiveCurrentMatchSnapshot();
  }

  currentMatch = {
    number: currentMatch.number + 1,
    status: "live",
    startedAt: Date.now(),
    map: currentMatch.map ? sanitizeMatchMap(currentMatch.map) : "erangel",
    matchLabel: "",
  };

  resetAllTeamsLiveScores();

  broadcast();
  res.json({ match: currentMatch, teams: sortTeams() });
});

/** Full new tournament: Match #1, cleared history, all squad scores reset (same map). */
app.post("/match/series-restart", (_req, res) => {
  performFullTournamentRestart();
  broadcast();
  emitHistoryUpdated();
  persistMatchState();
  res.json({
    match: {
      number: currentMatch.number,
      status: currentMatch.status,
      startedAt: currentMatch.startedAt,
      map: currentMatch.map,
      matchLabel: currentMatch.matchLabel || "",
    },
    tournamentReset: true,
  });
});

app.post("/match/end", (_req, res) => {
  archiveCurrentMatchSnapshot();
  currentMatch.status = "ended";
  broadcast();
  res.json({ match: currentMatch });
});

app.post("/match/meta", (req, res) => {
  const body = req.body || {};
  const prevMatchNumber = Math.max(1, Math.min(99999, Math.floor(Number(currentMatch.number)) || 1));
  let tournamentReset = false;

  if (Object.prototype.hasOwnProperty.call(body, "map")) {
    currentMatch.map = sanitizeMatchMap(body.map);
  }
  if (Object.prototype.hasOwnProperty.call(body, "matchLabel")) {
    currentMatch.matchLabel = sanitizeMatchLabel(body.matchLabel);
  }
  if (Object.prototype.hasOwnProperty.call(body, "number")) {
    const n = Number(body.number);
    if (Number.isFinite(n)) {
      const nextNum = Math.max(1, Math.min(99999, Math.floor(n)));
      /** Moving to Match #1 from #2+ = new tournament: clear series history & reset all squad scores. */
      if (nextNum === 1 && prevMatchNumber !== 1) {
        performFullTournamentRestart();
        tournamentReset = true;
      } else {
        currentMatch.number = nextNum;
      }
    }
  }

  broadcast();
  emitHistoryUpdated();
  persistMatchState();
  res.json({
    match: {
      number: currentMatch.number,
      status: currentMatch.status,
      startedAt: currentMatch.startedAt,
      map: currentMatch.map,
      matchLabel: currentMatch.matchLabel || "",
    },
    tournamentReset: Boolean(tournamentReset),
  });
});

// ── Match History ──

app.get("/matches/history", (_req, res) => {
  res.json(matchHistory);
});

app.delete("/matches/:id", (req, res) => {
  const id = Number(req.params.id);
  matchHistory = matchHistory.filter((m) => m.id !== id);
  broadcastTournament();
  emitHistoryUpdated();
  res.json({ ok: true });
});

app.post("/matches/:id/restore", (req, res) => {
  const id = Number(req.params.id);
  const match = matchHistory.find((m) => m.id === id);
  if (!match) return res.status(404).json({ message: "match not found" });

  teams = match.teams.map((t) => ({ ...t }));
  currentMatch = {
    number: match.number,
    status: "live",
    startedAt: Date.now(),
    map: sanitizeMatchMap(match.map),
    matchLabel: sanitizeMatchLabel(match.matchLabel),
  };

  broadcast();
  emitHistoryUpdated();
  res.json({ match: currentMatch, teams: sortTeams() });
});

// ── Settings ──

app.get("/settings", (_req, res) => res.json(settings));

app.post("/settings", (req, res) => {
  if (req.body.autoCalculate !== undefined) {
    settings.autoCalculate = Boolean(req.body.autoCalculate);
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "tournamentLogo")) {
    settings.tournamentLogo = req.body.tournamentLogo || null;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "themedOverlayPrefs")) {
    const tp = req.body.themedOverlayPrefs;
    if (tp && typeof tp === "object") {
      settings.themedOverlayPrefs = sanitizeThemedOverlayPrefs(tp);
    } else if (tp === null) {
      settings.themedOverlayPrefs = null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "engineOverlayPrefs")) {
    const ep = req.body.engineOverlayPrefs;
    if (ep && typeof ep === "object") {
      settings.engineOverlayPrefs = {
        overlayPath:
          typeof ep.overlayPath === "string" && ep.overlayPath.startsWith("/")
            ? ep.overlayPath
            : "/overlay/broadcast-engine",
        aliveStyle: typeof ep.aliveStyle === "string" ? ep.aliveStyle : "battery",
        animationPack: typeof ep.animationPack === "string" ? ep.animationPack : "subtle",
        engineTheme: typeof ep.engineTheme === "string" ? ep.engineTheme : null,
        engineDesign: typeof ep.engineDesign === "string" ? ep.engineDesign : null,
        engineAnimations: typeof ep.engineAnimations === "boolean" ? ep.engineAnimations : true,
        aliveLayout: ep.aliveLayout === "line" ? "line" : "grid",
        aliveCustomAlive: sanitizeAliveIconPathServer(ep.aliveCustomAlive),
        aliveCustomDead: sanitizeAliveIconPathServer(ep.aliveCustomDead),
      };
    } else {
      settings.engineOverlayPrefs = null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "themeColorOverrides")) {
    const raw = req.body.themeColorOverrides;
    if (raw === null) {
      settings.themeColorOverrides = {};
    } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      settings.themeColorOverrides = sanitizeThemeColorOverrides(raw);
    }
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "overallStandingsBg")) {
    const v = req.body.overallStandingsBg;
    if (v === null || v === "") settings.overallStandingsBg = null;
    else settings.overallStandingsBg = sanitizeOverallStandingsBgServer(v);
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "obsSharedTriplePng")) {
    const v = req.body.obsSharedTriplePng;
    if (v === null || v === "") settings.obsSharedTriplePng = null;
    else settings.obsSharedTriplePng = sanitizeObsSharedTriplePngServer(v);
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "obsSharedTripleColumns")) {
    settings.obsSharedTripleColumns = sanitizeObsSharedTripleColumnsServer(req.body.obsSharedTripleColumns);
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "obsTripleFpMetric")) {
    settings.obsTripleFpMetric = sanitizeObsTripleFpMetricServer(req.body.obsTripleFpMetric);
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "wwcdCharacterArts")) {
    if (req.body.wwcdCharacterArts === null) {
      settings.wwcdCharacterArts = [null, null, null, null];
    } else if (Array.isArray(req.body.wwcdCharacterArts)) {
      settings.wwcdCharacterArts = sanitizeWwcdCharacterArts(req.body.wwcdCharacterArts);
    }
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "sideOverlayPrefs")) {
    settings.sideOverlayPrefs = sanitizeSideOverlayPrefs(req.body.sideOverlayPrefs || {});
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "activeTheme")) {
    settings.activeTheme = sanitizeActiveThemeServer(req.body.activeTheme);
    activeThemeName = settings.activeTheme;
    io.emit("activeThemeChanged", activeThemeName);
  }
  persistAppSettings();
  io.emit("settingsUpdated", settings);
  if (Object.prototype.hasOwnProperty.call(req.body, "tournamentLogo")) {
    io.emit("tournamentLogoUpdated", { tournamentLogo: settings.tournamentLogo });
  }
  res.json(settings);
});

// ── Logo Upload ──

app.post("/upload/tournament-logo", (req, res) => {
  tournamentLogoUpload.single("logo")(req, res, (err) => {
    if (err) {
      console.error("tournament-logo:", err.message);
      return res.status(400).json({ message: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file received — use PNG, JPG, or WebP." });
    }
    settings.tournamentLogo = `/uploads/tournament/${req.file.filename}`;
    persistAppSettings();
    io.emit("settingsUpdated", settings);
    io.emit("tournamentLogoUpdated", { tournamentLogo: settings.tournamentLogo });
    res.json({ tournamentLogo: settings.tournamentLogo, ok: true });
  });
});

app.post("/upload/overall-standings-bg", (req, res) => {
  overallStandingsBgUpload.single("file")(req, res, (err) => {
    if (err) {
      console.error("overall-standings-bg:", err.message);
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "Image too large (max 30 MB)." });
        }
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
      return res.status(400).json({ message: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file — form field name must be "file".' });
    }
    settings.overallStandingsBg = `/uploads/overall-standings/${req.file.filename}`;
    persistAppSettings();
    io.emit("settingsUpdated", settings);
    res.json({ path: settings.overallStandingsBg, ok: true });
  });
});

/** Isolated OBS triple-slot PNG — each /overlay/obs-slot/* route renders this file as-is (PNG only). */
app.post("/upload/obs-shared-triple", (req, res) => {
  obsSharedTriplePngUpload.single("file")(req, res, (err) => {
    if (err) {
      console.error("obs-shared-triple:", err.message);
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "PNG too large (max 40 MB)." });
        }
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
      return res.status(400).json({ message: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file — form field name must be "file".' });
    }
    settings.obsSharedTriplePng = `/uploads/obs-shared-triple/${req.file.filename}`;
    persistAppSettings();
    io.emit("settingsUpdated", settings);
    res.json({
      path: settings.obsSharedTriplePng,
      ok: true,
      overlayUrls: [
        "/overlay/obs-slot/eliminations",
        "/overlay/obs-slot/top-four",
        "/overlay/obs-slot/live-ranking",
      ],
    });
  });
});

app.post("/upload/alive-icon", (req, res) => {
  aliveIconUpload.single("file")(req, res, (err) => {
    if (err) {
      console.error("alive-icon:", err.message);
      return res.status(400).json({ message: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file — form field name must be "file".' });
    }
    const rel = `/uploads/alive-icons/${req.file.filename}`;
    res.json({ path: rel, url: rel, ok: true });
  });
});

app.post("/upload/wwcd-character/:slot", (req, res) => {
  const slotNum = parseInt(req.params.slot, 10);
  if (Number.isNaN(slotNum) || slotNum < 0 || slotNum > 3) {
    return res.status(400).json({ message: "slot must be 0–3" });
  }
  wwcdCharUpload.single("file")(req, res, (err) => {
    if (err) {
      console.error("wwcd-character:", err.message);
      return res.status(400).json({ message: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file — form field name must be "file".' });
    }
    const rel = `/uploads/wwcd-chars/${req.file.filename}`;
    const arts = sanitizeWwcdCharacterArts(settings.wwcdCharacterArts || []);
    arts[slotNum] = rel;
    settings.wwcdCharacterArts = arts;
    persistAppSettings();
    io.emit("settingsUpdated", settings);
    res.json({ ok: true, slot: slotNum, path: rel, wwcdCharacterArts: arts });
  });
});

app.post("/overlay/wwcd-characters", (req, res) => {
  const slot = Number(req.body.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot > 3) {
    return res.status(400).json({ message: "body.slot must be 0–3" });
  }
  const arts = sanitizeWwcdCharacterArts(settings.wwcdCharacterArts || []);
  const url = req.body.imageUrl;
  if (url == null || url === "") {
    arts[slot] = null;
  } else if (typeof url === "string") {
    const t = url.trim();
    if (t === "") arts[slot] = null;
    else if (/^https?:\/\//i.test(t) && t.length <= 2048 && !t.includes("..")) arts[slot] = t;
    else return res.status(400).json({ message: "Invalid image URL (use http(s)://...)" });
  } else {
    return res.status(400).json({ message: "imageUrl must be string or empty" });
  }
  settings.wwcdCharacterArts = arts;
  persistAppSettings();
  io.emit("settingsUpdated", settings);
  res.json({ ok: true, wwcdCharacterArts: arts });
});

app.post("/teams/:id/logo", logoUpload.single("logo"), (req, res) => {
  const id = Number(req.params.id);
  const idx = teams.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ message: "not found" });

  if (req.file) {
    teams[idx].logo = `/uploads/logos/${req.file.filename}`;
    broadcast();
    res.json({ logo: teams[idx].logo });
  } else {
    res.status(400).json({ message: "No file uploaded" });
  }
});

// ── Overlay Theme ──

app.get("/overlay/theme", (_req, res) => res.json(overlayTheme));

app.post("/overlay/theme", (req, res) => {
  Object.assign(overlayTheme, req.body);
  io.emit("themeUpdated", overlayTheme);
  res.json(overlayTheme);
});

app.get("/overlay/active-theme", (_req, res) => res.json({ theme: activeThemeName }));

app.post("/overlay/active-theme", (req, res) => {
  if (req.body.theme) {
    activeThemeName = sanitizeActiveThemeServer(req.body.theme);
    settings.activeTheme = activeThemeName;
    persistAppSettings();
    io.emit("activeThemeChanged", activeThemeName);
    io.emit("settingsUpdated", settings);
  }
  res.json({ theme: activeThemeName });
});

app.get("/overlay/wwcd-colors", (_req, res) => res.json(wwcdColors));

app.post("/overlay/wwcd-colors", (req, res) => {
  Object.assign(wwcdColors, req.body);
  io.emit("wwcdColorsChanged", wwcdColors);
  res.json(wwcdColors);
});

// ── Screenshot Upload & OCR ──

app.post("/upload/screenshots", screenshotUpload.array("screenshots", 10), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ message: "No files uploaded" });

  let allResults = [];
  try {
    const Tesseract = require("tesseract.js");
    for (const file of req.files) {
      const { data } = await Tesseract.recognize(file.path, "eng", { logger: () => {} });
      const lines = data.text.split("\n").filter((l) => l.trim());
      let rankCounter = 0;
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;
        const maybeRank = parseInt(parts[0]);
        const hasRank = !isNaN(maybeRank) && maybeRank >= 1 && maybeRank <= 25;
        if (hasRank) rankCounter = maybeRank; else rankCounter++;
        const nameIndex = hasRank ? 1 : 0;
        const teamName = parts[nameIndex] || parts[0];
        const numericParts = parts.slice(nameIndex + 1);
        const pts = parseInt(numericParts[numericParts.length - 1]) || 0;
        const fin = numericParts.length > 1 ? parseInt(numericParts[numericParts.length - 2]) || 0 : 0;

        const knownTeam = teams.find((t) => t.team === teamName.toUpperCase());
        allResults.push({
          rank: rankCounter,
          team: knownTeam ? knownTeam.team : teamName.toUpperCase(),
          finishes: fin,
          points: pts,
          source: file.originalname,
        });
      }
    }
  } catch (err) {
    console.log("OCR processing:", err.message);
  }

  res.json({
    screenshots: req.files.map((f) => `/uploads/screenshots/${f.filename}`),
    ocrResults: allResults,
    message: allResults.length > 0 ? `Processed ${req.files.length} screenshot(s) — review below` : "OCR unavailable — enter data manually",
  });
});

app.post("/upload/screenshot", screenshotUpload.single("screenshot"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const filePath = req.file.path;
  const fileUrl = `/uploads/screenshots/${req.file.filename}`;
  let ocrResults = [];

  try {
    const Tesseract = require("tesseract.js");
    const { data } = await Tesseract.recognize(filePath, "eng", {
      logger: () => {},
    });
    const lines = data.text.split("\n").filter((l) => l.trim());

    let rankCounter = 0;
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;

      const maybeRank = parseInt(parts[0]);
      const hasRank = !isNaN(maybeRank) && maybeRank >= 1 && maybeRank <= 25;
      if (hasRank) {
        rankCounter = maybeRank;
      } else {
        rankCounter++;
      }

      const nameIndex = hasRank ? 1 : 0;
      const teamName = parts[nameIndex] || parts[0];
      const numericParts = parts.slice(nameIndex + 1);
      const pts = parseInt(numericParts[numericParts.length - 1]) || 0;
      const fin = numericParts.length > 1 ? parseInt(numericParts[numericParts.length - 2]) || 0 : 0;

      ocrResults.push({
        rank: rankCounter,
        team: teamName.toUpperCase(),
        finishes: fin,
        points: pts,
      });
    }
  } catch (err) {
    console.log("OCR processing:", err.message);
  }

  res.json({ screenshot: fileUrl, ocrResults, message: ocrResults.length > 0 ? "OCR processed — review and correct below" : "OCR unavailable — enter data manually" });
});

app.post("/apply-screenshot", (req, res) => {
  const { results } = req.body;
  if (!Array.isArray(results)) return res.status(400).json({ message: "results array required" });

  results.forEach((r) => {
    const idx = teams.findIndex((t) => t.team === String(r.team).toUpperCase());
    if (idx !== -1) {
      teams[idx].finishes = Number(r.finishes || 0);
      if (r.rank) {
        const rank = Number(r.rank);
        teams[idx].eliminationRank = rank;
        teams[idx].positionPoints = getPositionPoints(rank);
        teams[idx].status = "eliminated";
        teams[idx].alivePlayers = 0;
      }
      if (settings.autoCalculate) {
        teams[idx].points = teams[idx].finishes + teams[idx].positionPoints;
      } else {
        teams[idx].points = Number(r.points || 0);
      }
    }
  });

  broadcast();
  res.json({ ok: true, teams: sortTeams() });
});

// ── Tournament Stats ──

app.get("/tournament/overall", (_req, res) => {
  res.json(getTournamentStats());
});

// ── Google Drive + Sheets (service account) ──

app.get("/integrations/google/status", (_req, res) => {
  const cred = googleInt.credentialsPathResolved();
  res.json({
    credentialsConfigured: Boolean(cred),
    credentialsFile: cred ? path.basename(cred) : null,
    integration: settings.googleIntegration,
  });
});

app.post("/integrations/google/config", (req, res) => {
  const body = req.body || {};
  settings.googleIntegration = sanitizeGoogleIntegration({
    ...settings.googleIntegration,
    ...body,
  });
  persistAppSettings();
  restartGooglePoller();
  io.emit("settingsUpdated", settings);
  res.json({ ok: true, googleIntegration: settings.googleIntegration });
});

app.post("/integrations/google/export", async (_req, res) => {
  try {
    await runGoogleDriveExport();
    io.emit("settingsUpdated", settings);
    res.json({ ok: true, lastExportAt: settings.googleIntegration.lastExportAt });
  } catch (e) {
    settings.googleIntegration.lastError = (e.message || String(e)).slice(0, 500);
    persistAppSettings();
    res.status(500).json({ ok: false, message: e.message || String(e) });
  }
});

app.post("/integrations/google/sync", async (_req, res) => {
  try {
    const sheets = await runGoogleSheetsSync();
    const drive = await runGoogleDriveFolderSync();
    io.emit("settingsUpdated", settings);
    res.json({ ok: true, sheets, drive, teams: sortTeams() });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message || String(e) });
  }
});

// ── Overlay Commands ──

app.post("/overlay/command", (req, res) => {
  io.emit("overlayCommand", req.body);
  res.json({ ok: true });
});

// ── React SPA (production): API + UI on one port after `npm run build` ──
const clientDist = path.join(ROOT, "client", "dist");
const serveSpa = process.env.SERVE_SPA !== "false";
function wantsSpaIndex(reqPath, method) {
  if (method !== "GET" && method !== "HEAD") return false;
  if (reqPath === "/" || reqPath === "/admin" || reqPath === "/register") return true;
  if (reqPath === "/overlay" || reqPath.startsWith("/overlay/")) return true;
  return false;
}
if (serveSpa && fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (!wantsSpaIndex(req.path, req.method)) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
  console.log(`[static] Serving React app from ${clientDist}`);
}

// ── Socket.IO ──

io.on("connection", (socket) => {
  socket.emit("teamsUpdated", sortTeams());
  socket.emit("matchUpdated", { ...currentMatch, teams: sortTeams() });
  socket.emit("tournamentUpdated", getTournamentStats());
  socket.emit("settingsUpdated", settings);
  socket.emit("themeUpdated", overlayTheme);
  socket.emit("activeThemeChanged", activeThemeName);
  socket.emit("wwcdColorsChanged", wwcdColors);

  socket.on("requestTeams", () => socket.emit("teamsUpdated", sortTeams()));
  socket.on("requestMatch", () => socket.emit("matchUpdated", { ...currentMatch, teams: sortTeams() }));
  socket.on("requestTournament", () => socket.emit("tournamentUpdated", getTournamentStats()));
  socket.on("requestHistory", () => socket.emit("historyUpdated", matchHistory));
  socket.on("requestTheme", () => socket.emit("themeUpdated", overlayTheme));
  socket.on("requestActiveTheme", () => socket.emit("activeThemeChanged", activeThemeName));
  socket.on("requestWwcdColors", () => socket.emit("wwcdColorsChanged", wwcdColors));
  socket.on("requestSettings", () => socket.emit("settingsUpdated", settings));

  socket.on("requestTournamentLogo", () => {
    socket.emit("tournamentLogoUpdated", { tournamentLogo: settings.tournamentLogo });
    socket.emit("settingsUpdated", settings);
  });
});

const PORT = Number(process.env.PORT) || 3001;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n[${err.code}] Port ${PORT} is already in use.`);
    console.error("You probably already have this API running — use that terminal, or stop it first.");
    console.error("From the project root you can free the port and start in one step:");
    console.error(`  npm run start:fresh`);
    console.error("Or only kill the listener, then run node again:");
    console.error(`  node scripts/kill-port-listeners.mjs ${PORT}`);
    console.error("Windows (PowerShell) manual: Get-NetTCPConnection -LocalPort " + PORT + " -State Listen | Select-Object OwningProcess");
    console.error("Then: Stop-Process -Id <PID> -Force\n");
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`API + Socket.IO listening on http://127.0.0.1:${PORT} (all interfaces — use your LAN IP from another PC/OBS)`);
  console.log(`Overall PNG upload: POST /upload/overall-standings-bg (admin → Tournament → custom background)`);
  console.log(`OBS shared PNG (3 URLs): POST /upload/obs-shared-triple → /overlay/obs-slot/eliminations | top-four | live-ranking`);
  restartGooglePoller();
  if (!serveSpa) {
    console.log(`(SERVE_SPA=false — API only. Run Vite dev in ./client or use "npm start" for built UI.)`);
  } else if (fs.existsSync(path.join(clientDist, "index.html"))) {
    console.log(`Admin + overlays UI: http://127.0.0.1:${PORT}/admin`);
  } else {
    console.log(`(No client/dist — run "npm run build" in ./client, then restart, or use Vite on :5173 for the UI.)`);
    console.log(`With Vite dev, uploads proxy to this API — keep this process running on port ${PORT}.`);
  }
});
