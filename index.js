const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));

const uploadsDir = path.join(__dirname, "uploads");
const logosDir = path.join(uploadsDir, "logos");
const screenshotsDir = path.join(uploadsDir, "screenshots");
const tournamentDir = path.join(uploadsDir, "tournament");
const aliveIconsDir = path.join(uploadsDir, "alive-icons");
const overallStandingsDir = path.join(uploadsDir, "overall-standings");
const wwcdCharsDir = path.join(uploadsDir, "wwcd-chars");

[uploadsDir, logosDir, screenshotsDir, tournamentDir, aliveIconsDir, overallStandingsDir, wwcdCharsDir].forEach((dir) => {
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

// ── BGMI Position Points ──
const POSITION_POINTS = { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 };
const getPositionPoints = (rank) => POSITION_POINTS[rank] || 0;

// ── State ──
let teams = [];
let currentMatch = {
  number: 1,
  status: "live",
  startedAt: Date.now(),
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
  /** Per-slot art for `/overlay/wwcd` character cards: null | /uploads/wwcd-chars/... | https://... */
  wwcdCharacterArts: [null, null, null, null],
};

const dataDir = path.join(__dirname, "data");
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
      teams = raw.teams;
    }
    if (raw.currentMatch && typeof raw.currentMatch === "object") {
      currentMatch = {
        number: Math.max(1, Number(raw.currentMatch.number) || 1),
        status: typeof raw.currentMatch.status === "string" ? raw.currentMatch.status : "live",
        startedAt: typeof raw.currentMatch.startedAt === "number" ? raw.currentMatch.startedAt : Date.now(),
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
    if (Array.isArray(raw.wwcdCharacterArts)) {
      settings.wwcdCharacterArts = sanitizeWwcdCharacterArts(raw.wwcdCharacterArts);
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
          wwcdCharacterArts: settings.wwcdCharacterArts,
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

let activeThemeName = "esports";

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

const sortTeams = () =>
  [...teams].sort(
    (a, b) =>
      b.points - a.points ||
      b.finishes - a.finishes ||
      a.team.localeCompare(b.team)
  );

const broadcast = () => {
  const sorted = sortTeams();
  io.emit("teamsUpdated", sorted);
  io.emit("matchUpdated", { ...currentMatch, teams: sorted });
  schedulePersistMatchState();
};

const broadcastTournament = () => {
  io.emit("tournamentUpdated", getTournamentStats());
  schedulePersistMatchState();
};

const recalculatePoints = (team) => {
  if (!settings.autoCalculate) return;
  team.positionPoints =
    team.status === "eliminated" && team.eliminationRank !== null
      ? getPositionPoints(team.eliminationRank)
      : 0;
  team.points = team.finishes + team.positionPoints;
};

const eliminateTeam = (team) => {
  team.status = "eliminated";
  team.alivePlayers = 0;
  const remaining = teams.filter((t) => t.status !== "eliminated").length;
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
  const alive = teams.filter((t) => t.status !== "eliminated");
  if (alive.length === 1 && teams.length > 1) {
    const winner = alive[0];
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
  processTeamList(teams, currentMatch.number);

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

// ── Existing Routes (backward-compatible) ──

app.get("/teams", (req, res) => {
  res.json(sortTeams());
});

app.post("/teams", (req, res) => {
  const team = String(req.body.team || "").toUpperCase().trim();
  if (!team) return res.status(400).json({ message: "team required" });

  const item = {
    id: Date.now(),
    team,
    status: req.body.status || "alive",
    finishes: Number(req.body.finishes || 0),
    points: Number(req.body.points || 0),
    logo: null,
    alivePlayers: 4,
    positionPoints: 0,
    eliminationRank: null,
    players: req.body.players || [],
  };

  teams.push(item);
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
    logo: null,
    alivePlayers: 4,
    positionPoints: 0,
    eliminationRank: null,
    players: req.body.players || [],
  };
  teams.push(item);
  broadcast();
  res.status(201).json({ created: true, team: item });
});

app.post("/teams/:id", (req, res) => {
  const id = Number(req.params.id);
  const idx = teams.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ message: "not found" });

  const wasEliminated = teams[idx].status === "eliminated";

  teams[idx] = {
    ...teams[idx],
    team: String(req.body.team || teams[idx].team).toUpperCase(),
    status: req.body.status || teams[idx].status,
    finishes: Number(req.body.finishes ?? teams[idx].finishes),
    points: Number(req.body.points ?? teams[idx].points),
  };

  if (!wasEliminated && teams[idx].status === "eliminated" && settings.autoCalculate) {
    eliminateTeam(teams[idx]);
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
  const knockCount = Number(req.body.knockCount || 1);

  if (knockCount >= 4 || req.body.fullElimination) {
    eliminateTeam(team);
  } else {
    team.alivePlayers = Math.max(0, 4 - knockCount);
    if (team.alivePlayers === 0) {
      eliminateTeam(team);
    } else {
      team.status = "knocked";
    }
  }

  broadcast();
  broadcastTournament();
  res.json(team);
});

app.post("/teams/:id/alive", (req, res) => {
  const id = Number(req.params.id);
  const idx = teams.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ message: "not found" });

  const count = Math.max(0, Math.min(4, Number(req.body.alivePlayers)));
  teams[idx].alivePlayers = count;

  if (count === 0) {
    eliminateTeam(teams[idx]);
  } else if (count < 4) {
    teams[idx].status = "knocked";
  } else {
    teams[idx].status = "alive";
  }

  broadcast();
  broadcastTournament();
  res.json(teams[idx]);
});

// ── Match Management ──

app.get("/match/current", (_req, res) => {
  res.json({ ...currentMatch, teams: sortTeams() });
});

app.post("/match/new", (_req, res) => {
  if (teams.length > 0) {
    const winner = teams.find((t) => t.eliminationRank === 1);
    matchHistory.push({
      id: Date.now(),
      number: currentMatch.number,
      status: "ended",
      startedAt: currentMatch.startedAt,
      endedAt: Date.now(),
      teams: teams.map((t) => ({ ...t })),
      winner: winner ? winner.team : null,
    });
  }

  currentMatch = {
    number: currentMatch.number + 1,
    status: "live",
    startedAt: Date.now(),
  };

  teams = teams.map((t) => ({
    ...t,
    status: "alive",
    finishes: 0,
    points: 0,
    alivePlayers: 4,
    positionPoints: 0,
    eliminationRank: null,
  }));

  broadcast();
  broadcastTournament();
  res.json({ match: currentMatch, teams: sortTeams() });
});

app.post("/match/end", (_req, res) => {
  currentMatch.status = "ended";
  broadcast();
  res.json({ match: currentMatch });
});

// ── Match History ──

app.get("/matches/history", (_req, res) => {
  res.json(matchHistory);
});

app.delete("/matches/:id", (req, res) => {
  const id = Number(req.params.id);
  matchHistory = matchHistory.filter((m) => m.id !== id);
  broadcastTournament();
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
  };

  broadcast();
  broadcastTournament();
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
  if (Object.prototype.hasOwnProperty.call(req.body, "wwcdCharacterArts")) {
    if (req.body.wwcdCharacterArts === null) {
      settings.wwcdCharacterArts = [null, null, null, null];
    } else if (Array.isArray(req.body.wwcdCharacterArts)) {
      settings.wwcdCharacterArts = sanitizeWwcdCharacterArts(req.body.wwcdCharacterArts);
    }
  }
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
    activeThemeName = req.body.theme;
    io.emit("activeThemeChanged", activeThemeName);
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
  broadcastTournament();
  res.json({ ok: true, teams: sortTeams() });
});

// ── Tournament Stats ──

app.get("/tournament/overall", (_req, res) => {
  res.json(getTournamentStats());
});

// ── Overlay Commands ──

app.post("/overlay/command", (req, res) => {
  io.emit("overlayCommand", req.body);
  res.json({ ok: true });
});

// ── React SPA (production): API + UI on one port after `npm run build` ──
const clientDist = path.join(__dirname, "client", "dist");
function wantsSpaIndex(reqPath, method) {
  if (method !== "GET" && method !== "HEAD") return false;
  if (reqPath === "/" || reqPath === "/admin" || reqPath === "/register") return true;
  if (reqPath === "/overlay" || reqPath.startsWith("/overlay/")) return true;
  return false;
}
if (fs.existsSync(path.join(clientDist, "index.html"))) {
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
    console.error("Windows (PowerShell): Get-NetTCPConnection -LocalPort " + PORT + " | Select-Object OwningProcess");
    console.error("Then: Stop-Process -Id <PID> -Force\n");
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`API + Socket.IO listening on http://127.0.0.1:${PORT}`);
  console.log(`Overall PNG upload: POST /upload/overall-standings-bg (admin → Tournament → custom background)`);
  if (fs.existsSync(path.join(clientDist, "index.html"))) {
    console.log(`Admin + overlays UI: http://127.0.0.1:${PORT}/admin`);
  } else {
    console.log(`(No client/dist — run "npm run build" in ./client, then restart, or use Vite on :5173 for the UI.)`);
    console.log(`With Vite dev, uploads proxy to this API — keep this process running on port ${PORT}.`);
  }
});
