/**
 * Isolated Round Robin group-match system.
 * Own team roster (name + logo per group) — does not use Live Rankings teams[].
 * Scoring uses injected getPositionPoints() from the live-ranking backend.
 */

const fs = require("fs");
const path = require("path");
const multer = require("multer");

const MIN_GROUP_TEAMS = 8;
const MAX_GROUP_TEAMS = 10;
const ALLOWED_STATUS = new Set(["alive", "knocked", "eliminated", "rondo_benched"]);
const RONDO_RECALL_CHARGE_CAP = 4;
const LOGO_IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"];

/** Set in mountRoundRobin — module-level knock helpers emit overlay events here. */
let roundRobinIo = null;

function logoExtFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("png")) return ".png";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  if (m.includes("svg")) return ".svg";
  if (m.includes("bmp")) return ".bmp";
  return ".png";
}

function emptyState() {
  return {
    groups: defaultGroups(),
    matches: [],
    allowSameGroup: false,
    nextMatchSeq: 1,
  };
}

function defaultGroups() {
  return ["A", "B", "C", "D", "E"].map((letter, i) => ({
    id: `grp-${letter.toLowerCase()}`,
    name: `GROUP ${letter}`,
    letter,
    teams: [],
    createdAt: Date.now() + i,
  }));
}

function padMatchId(seq) {
  const n = Math.max(1, Math.floor(Number(seq) || 1));
  return n < 1000 ? `RR-${String(n).padStart(3, "0")}` : `RR-${n}`;
}

function nextLetter(groups) {
  const used = new Set((groups || []).map((g) => String(g.letter || "").toUpperCase()));
  for (let i = 0; i < 26; i += 1) {
    const L = String.fromCharCode(65 + i);
    if (!used.has(L)) return L;
  }
  let n = 1;
  while (used.has(`G${n}`)) n += 1;
  return `G${n}`;
}

function nextTeamId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function nextFreeSlot(group) {
  const used = new Set((group.teams || []).map((t) => Number(t.slot)));
  for (let s = 1; s <= MAX_GROUP_TEAMS; s += 1) {
    if (!used.has(s)) return s;
  }
  return null;
}

function sanitizeGroupTeams(rawTeams, letter) {
  const out = [];
  const seenSlot = new Set();
  const seenId = new Set();
  const list = Array.isArray(rawTeams) ? rawTeams : [];
  for (const row of list) {
    if (!row) continue;
    const id = Number(row.id != null ? row.id : row.teamId);
    if (!Number.isFinite(id)) continue;
    if (seenId.has(String(id))) continue;
    let slot = Math.floor(Number(row.slot));
    if (!Number.isFinite(slot) || slot < 1) slot = out.length + 1;
    if (slot > MAX_GROUP_TEAMS || seenSlot.has(slot)) continue;
    seenSlot.add(slot);
    seenId.add(String(id));
    const name = String(row.team || "").trim().slice(0, 48);
    out.push({
      id,
      team: name ? name.toUpperCase() : `TEAM ${letter || ""}${slot}`,
      logo: row.logo || null,
      slot,
    });
    if (out.length >= MAX_GROUP_TEAMS) break;
  }
  out.sort((a, b) => a.slot - b.slot);
  return out;
}

function normalizeGroup(g, i, allGroups) {
  const letter = String(g.letter || nextLetter(allGroups || [])).toUpperCase().slice(0, 4);
  let teams = [];
  if (Array.isArray(g.teams) && g.teams.length) {
    teams = sanitizeGroupTeams(g.teams, letter);
  }
  return {
    id: g.id || `grp-${Date.now()}-${i}`,
    name: String(g.name || `GROUP ${letter}`).trim().slice(0, 40) || `GROUP ${i + 1}`,
    letter,
    teams,
    createdAt: g.createdAt || Date.now() + i,
  };
}

function findGroup(state, groupId) {
  return (state.groups || []).find((g) => String(g.id) === String(groupId)) || null;
}

function findMatch(state, matchId) {
  return (state.matches || []).find((m) => String(m.id) === String(matchId)) || null;
}

function findTeamContext(state, teamId) {
  for (const group of state.groups || []) {
    const team = (group.teams || []).find((t) => String(t.id) === String(teamId));
    if (team) return { group, team };
  }
  return null;
}

function teamInActiveMatch(state, teamId) {
  return (state.matches || []).find(
    (m) =>
      ["upcoming", "live"].includes(String(m.status).toLowerCase()) &&
      (m.teams || []).some((t) => String(t.teamId) === String(teamId)),
  );
}

function groupInLiveMatch(state, groupId) {
  const live = liveMatch(state);
  if (!live) return false;
  return String(live.group1Id) === String(groupId) || String(live.group2Id) === String(groupId);
}

function refreshUpcomingMatchesForGroup(state, groupId) {
  for (const m of state.matches || []) {
    if (String(m.status).toLowerCase() !== "upcoming") continue;
    if (String(m.group1Id) !== String(groupId) && String(m.group2Id) !== String(groupId)) continue;
    const g1 = findGroup(state, m.group1Id);
    const g2 = findGroup(state, m.group2Id);
    if (!g1 || !g2) continue;
    m.teams = snapshotLobby(g1, g2);
    m.group1Name = g1.name;
    m.group2Name = g2.name;
  }
}

function syncTeamToActiveMatches(state, teamId, patch) {
  for (const m of state.matches || []) {
    const st = String(m.status).toLowerCase();
    if (st !== "upcoming" && st !== "live") continue;
    for (const row of m.teams || []) {
      if (String(row.teamId) !== String(teamId)) continue;
      if (patch.team != null) row.team = patch.team;
      if (Object.prototype.hasOwnProperty.call(patch, "logo")) row.logo = patch.logo;
      if (patch.slot != null) row.slot = patch.slot;
      if (patch.slotLabel != null) row.slotLabel = patch.slotLabel;
    }
  }
}

function syncGroupNameToActiveMatches(state, groupId, groupName) {
  for (const m of state.matches || []) {
    const st = String(m.status).toLowerCase();
    if (st !== "upcoming" && st !== "live") continue;
    if (String(m.group1Id) === String(groupId)) m.group1Name = groupName;
    if (String(m.group2Id) === String(groupId)) m.group2Name = groupName;
    for (const row of m.teams || []) {
      if (String(row.groupId) === String(groupId)) row.groupName = groupName;
    }
  }
}

function matchLabel(state, match) {
  const g1 = findGroup(state, match.group1Id);
  const g2 = findGroup(state, match.group2Id);
  const n1 = g1?.name || match.group1Name || "GROUP";
  const n2 = g2?.name || match.group2Name || "GROUP";
  if (String(match.group1Id) === String(match.group2Id)) return n1;
  return `${n1} vs ${n2}`;
}

function overlayTeam(row, index) {
  return {
    id: Number(row.teamId) || 0,
    team: row.team || "",
    logo: row.logo || null,
    finishes: Number(row.finishes) || 0,
    points: Number(row.points) || 0,
    positionPoints: Number(row.positionPoints) || 0,
    alivePlayers: Number.isFinite(Number(row.alivePlayers)) ? Number(row.alivePlayers) : 4,
    status: row.status || "alive",
    displayOrder: index + 1,
    eliminationRank: row.eliminationRank == null ? null : Number(row.eliminationRank),
    groupId: row.groupId,
    groupName: row.groupName,
    slot: row.slot,
    slotLabel: row.slotLabel || "",
    rondoRecallChargesRemaining: row.rondoRecallChargesRemaining,
    rondoRecallConsumed: row.rondoRecallConsumed,
    rondoAwaitingRecall: row.rondoAwaitingRecall,
    rondoKnockAliveOnly: row.rondoKnockAliveOnly,
  };
}

function isRondoMapMatch(match) {
  return String(match?.map || "erangel").toLowerCase() === "rondo";
}

function coerceJsonBool(v, defaultVal = false) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (v == null || v === "") return defaultVal;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  return defaultVal;
}

function coerceRecallCharges(row) {
  const raw = row?.rondoRecallChargesRemaining;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(RONDO_RECALL_CHARGE_CAP, Math.trunc(raw)));
  }
  if (typeof raw === "string" && String(raw).trim() !== "") {
    const n = Number(String(raw).trim());
    if (Number.isFinite(n)) return Math.max(0, Math.min(RONDO_RECALL_CHARGE_CAP, Math.trunc(n)));
  }
  const consumed = coerceJsonBool(row?.rondoRecallConsumed, false);
  return consumed ? 0 : RONDO_RECALL_CHARGE_CAP;
}

function normalizeLobbyRondoFields(row) {
  if (!row || typeof row !== "object") return row;
  row.rondoRecallChargesRemaining = coerceRecallCharges(row);
  row.rondoRecallConsumed = row.rondoRecallChargesRemaining <= 0;
  row.rondoAwaitingRecall = coerceJsonBool(row.rondoAwaitingRecall, false);
  row.rondoKnockAliveOnly = coerceJsonBool(row.rondoKnockAliveOnly, false);
  return row;
}

function clearLobbyRondoKnockAliveOnly(row) {
  if (row && typeof row === "object") row.rondoKnockAliveOnly = false;
}

function initLobbyRondoFields(row) {
  if (!row || typeof row !== "object") return;
  row.rondoRecallChargesRemaining = RONDO_RECALL_CHARGE_CAP;
  row.rondoRecallConsumed = false;
  row.rondoAwaitingRecall = false;
}

function competingLobbyRows(match) {
  return (match.teams || []).filter((t) => {
    const s = String(t.status || "").toLowerCase();
    return s === "alive" || s === "knocked";
  });
}

function recalcLobbyRow(row, getPositionPoints, autoCalculate) {
  applyScore(row, {}, getPositionPoints, autoCalculate);
}

function checkLobbyWinner(match, getPositionPoints, autoCalculate) {
  const competing = competingLobbyRows(match);
  if (competing.length === 1 && (match.teams || []).length > 1) {
    competing[0].eliminationRank = 1;
    recalcLobbyRow(competing[0], getPositionPoints, autoCalculate);
  }
}

function eliminateLobbyRow(match, row, getPositionPoints, autoCalculate) {
  row.status = "eliminated";
  row.alivePlayers = 0;
  row.rondoAwaitingRecall = false;
  row.rondoRecallChargesRemaining = 0;
  row.rondoRecallConsumed = true;
  const remaining = competingLobbyRows(match).filter((t) => String(t.teamId) !== String(row.teamId)).length;
  row.eliminationRank = remaining + 1;
  recalcLobbyRow(row, getPositionPoints, autoCalculate);
  checkLobbyWinner(match, getPositionPoints, autoCalculate);
  roundRobinIo?.emit("teamEliminated", {
    team: row.team,
    logo: row.logo,
    id: row.teamId,
    rank: row.eliminationRank,
    finishes: row.finishes,
    points: row.points,
    source: "roundRobin",
  });
}

function rondoBenchLobbyRow(row, getPositionPoints, autoCalculate) {
  row.status = "rondo_benched";
  row.alivePlayers = 0;
  row.eliminationRank = null;
  row.rondoAwaitingRecall = true;
  row.positionPoints = 0;
  recalcLobbyRow(row, getPositionPoints, autoCalculate);
}

function tryCommitLobbyFullElimination(match, row, getPositionPoints, autoCalculate) {
  normalizeLobbyRondoFields(row);
  if (!isRondoMapMatch(match)) {
    eliminateLobbyRow(match, row, getPositionPoints, autoCalculate);
    return;
  }
  if ((row.rondoRecallChargesRemaining || 0) <= 0) {
    eliminateLobbyRow(match, row, getPositionPoints, autoCalculate);
    return;
  }
  rondoBenchLobbyRow(row, getPositionPoints, autoCalculate);
  checkLobbyWinner(match, getPositionPoints, autoCalculate);
}

function restoreLobbyEliminated(match, row, getPositionPoints, autoCalculate) {
  if (String(row.status || "").toLowerCase() !== "eliminated") return false;
  const oldRank = row.eliminationRank != null ? Math.trunc(Number(row.eliminationRank)) : null;
  row.status = "alive";
  row.alivePlayers = 4;
  row.eliminationRank = null;
  row.positionPoints = 0;
  row.rondoAwaitingRecall = false;
  if (isRondoMapMatch(match)) {
    normalizeLobbyRondoFields(row);
    row.rondoKnockAliveOnly = true;
  }
  if (oldRank != null && Number.isFinite(oldRank)) {
    (match.teams || []).forEach((t) => {
      if (String(t.teamId) === String(row.teamId)) return;
      if (String(t.status || "").toLowerCase() !== "eliminated") return;
      const r = t.eliminationRank != null ? Math.trunc(Number(t.eliminationRank)) : null;
      if (r != null && r > oldRank) {
        t.eliminationRank = r - 1;
        recalcLobbyRow(t, getPositionPoints, autoCalculate);
      }
    });
  }
  (match.teams || []).forEach((t) => {
    if (String(t.teamId) === String(row.teamId)) return;
    const s = String(t.status || "").toLowerCase();
    if ((s === "alive" || s === "knocked") && t.eliminationRank === 1) {
      t.eliminationRank = null;
      recalcLobbyRow(t, getPositionPoints, autoCalculate);
    }
  });
  recalcLobbyRow(row, getPositionPoints, autoCalculate);
  return true;
}

function applyScore(row, body, getPositionPoints, autoCalculate) {
  if (body && Object.prototype.hasOwnProperty.call(body, "finishes")) {
    row.finishes = Math.max(0, Math.floor(Number(body.finishes) || 0));
  }
  if (body && Object.prototype.hasOwnProperty.call(body, "eliminationRank")) {
    const raw = body.eliminationRank;
    if (raw === "" || raw == null) {
      row.eliminationRank = null;
    } else {
      const r = Math.floor(Number(raw));
      row.eliminationRank = Number.isFinite(r) && r >= 1 && r <= 25 ? r : null;
    }
  }
  if (body && body.status != null) {
    const s = String(body.status).toLowerCase();
    if (ALLOWED_STATUS.has(s)) {
      row.status = s;
      if (s === "eliminated") row.alivePlayers = 0;
    }
  }
  if (body && Object.prototype.hasOwnProperty.call(body, "alivePlayers")) {
    row.alivePlayers = Math.max(0, Math.min(4, Math.floor(Number(body.alivePlayers) || 0)));
  }

  if (autoCalculate) {
    row.positionPoints = getPositionPoints(row.eliminationRank);
    row.points = (Number(row.finishes) || 0) + row.positionPoints;
    return;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, "positionPoints")) {
    row.positionPoints = Math.max(0, Math.floor(Number(body.positionPoints) || 0));
  }
  if (body && Object.prototype.hasOwnProperty.call(body, "points")) {
    row.points = Math.max(0, Math.floor(Number(body.points) || 0));
  }
}

function snapshotLobby(group1, group2) {
  const groups = String(group1.id) === String(group2.id) ? [group1] : [group1, group2];
  const rows = [];
  for (const g of groups) {
    const sorted = [...(g.teams || [])].sort((a, b) => a.slot - b.slot);
    for (const t of sorted) {
      rows.push({
        teamId: t.id,
        team: t.team,
        logo: t.logo || null,
        groupId: g.id,
        groupName: g.name,
        groupLetter: g.letter,
        slot: t.slot,
        slotLabel: `${g.letter}${t.slot}`,
        finishes: 0,
        positionPoints: 0,
        points: 0,
        eliminationRank: null,
        status: "alive",
        alivePlayers: 4,
      });
    }
  }
  return rows;
}

function getStandings(state) {
  const statsMap = {};
  (state.matches || []).forEach((m) => {
    if (String(m.status).toLowerCase() !== "completed") return;
    (m.teams || []).forEach((t) => {
      const key = String(t.teamId);
      if (!statsMap[key]) {
        statsMap[key] = {
          teamId: t.teamId,
          team: t.team,
          logo: t.logo || null,
          groupId: t.groupId,
          groupName: t.groupName,
          groupLetter: t.groupLetter,
          matchesPlayed: 0,
          totalFinishes: 0,
          totalPositionPoints: 0,
          totalPoints: 0,
          chickenDinners: 0,
          matchPoints: [],
        };
      }
      const s = statsMap[key];
      s.team = t.team || s.team;
      s.logo = t.logo || s.logo;
      s.groupId = t.groupId || s.groupId;
      s.groupName = t.groupName || s.groupName;
      s.totalPoints += Number(t.points) || 0;
      s.totalFinishes += Number(t.finishes) || 0;
      s.totalPositionPoints += Number(t.positionPoints) || 0;
      s.matchesPlayed += 1;
      if (Number(t.eliminationRank) === 1) s.chickenDinners += 1;
      s.matchPoints.push({
        matchId: m.id,
        points: Number(t.points) || 0,
        finishes: Number(t.finishes) || 0,
        rank: t.eliminationRank,
      });
    });
  });

  const result = Object.values(statsMap).sort(
    (a, b) => b.totalPoints - a.totalPoints || b.totalFinishes - a.totalFinishes,
  );
  result.forEach((row, i) => {
    row.rank = i + 1;
  });
  return result;
}

function liveMatch(state) {
  return (state.matches || []).find((m) => String(m.status).toLowerCase() === "live") || null;
}

function currentMatch(state) {
  const live = liveMatch(state);
  if (live) return live;
  const upcoming = [...(state.matches || [])]
    .filter((m) => String(m.status).toLowerCase() === "upcoming")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (upcoming[0]) return upcoming[0];
  const done = [...(state.matches || [])]
    .filter((m) => String(m.status).toLowerCase() === "completed")
    .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
  return done[0] || null;
}

function matchSeqNumber(match) {
  const m = String(match?.id || "").match(/RR-(\d+)/i);
  return m ? Math.max(1, Number(m[1]) || 1) : 1;
}

function overlayPayload(state) {
  const live = liveMatch(state);
  if (!live) {
    return {
      teams: [],
      match: {
        number: 1,
        status: "ended",
        startedAt: Date.now(),
        map: "erangel",
        matchLabel: "",
      },
    };
  }
  return {
    teams: (live.teams || []).map((row, i) => overlayTeam(row, i)),
    match: {
      number: matchSeqNumber(live),
      status: "live",
      startedAt: live.startedAt || Date.now(),
      map: live.map || "erangel",
      matchLabel: matchLabel(state, live),
    },
  };
}

function publicGroup(group) {
  return {
    id: group.id,
    name: group.name,
    letter: group.letter,
    createdAt: group.createdAt,
    teams: (group.teams || []).map((t) => ({
      id: t.id,
      teamId: t.id,
      team: t.team,
      logo: t.logo || null,
      slot: t.slot,
      slotLabel: `${group.letter}${t.slot}`,
    })),
  };
}

function publicMatch(state, match) {
  if (!match) return null;
  const g1 = findGroup(state, match.group1Id);
  const g2 = findGroup(state, match.group2Id);
  return {
    ...match,
    group1Name: g1?.name || match.group1Name,
    group2Name: g2?.name || match.group2Name,
    label: matchLabel(state, match),
    teamCount: (match.teams || []).length,
  };
}

function mountRoundRobin(opts) {
  const { app, io, dataDir, logosDir, getPositionPoints, getAutoCalculate, sanitizeMatchMap } = opts;
  roundRobinIo = io;

  const stateFile = path.join(dataDir, "round-robin-state.json");
  let state = emptyState();
  let persistTimer = null;

  const rrLogoUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, logosDir),
      filename: (req, file, cb) => {
        let ext = path.extname(file.originalname || "").toLowerCase();
        if (!LOGO_IMAGE_EXTS.includes(ext)) ext = logoExtFromMime(file.mimetype);
        cb(null, `rr-team-${req.params.teamId}-${Date.now()}${ext}`);
      },
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const mimeOk = typeof file.mimetype === "string" && file.mimetype.startsWith("image/");
      if (LOGO_IMAGE_EXTS.includes(ext) || mimeOk) return cb(null, true);
      cb(new Error(`Only image files allowed (${ext || file.mimetype || "unknown"})`));
    },
  });

  function persist() {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch (e) {
      console.warn("Could not save round-robin-state.json:", e.message);
    }
  }

  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persist();
    }, 280);
  }

  function load() {
    try {
      if (!fs.existsSync(stateFile)) {
        state = emptyState();
        persist();
        return;
      }
      const raw = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      const groupsRaw = Array.isArray(raw.groups) && raw.groups.length ? raw.groups : defaultGroups();
      state = {
        groups: groupsRaw.map((g, i) => normalizeGroup(g, i, groupsRaw)),
        matches: Array.isArray(raw.matches) ? raw.matches : [],
        allowSameGroup: Boolean(raw.allowSameGroup),
        nextMatchSeq: Math.max(1, Math.floor(Number(raw.nextMatchSeq) || 1)),
      };
    } catch (e) {
      console.warn("Could not load round-robin-state.json:", e.message);
      state = emptyState();
    }
  }

  function publicState() {
    const cur = currentMatch(state);
    return {
      groups: state.groups.map((g) => publicGroup(g)),
      matches: state.matches.map((m) => publicMatch(state, m)),
      allowSameGroup: Boolean(state.allowSameGroup),
      liveMatch: publicMatch(state, liveMatch(state)),
      currentMatch: publicMatch(state, cur),
      standings: getStandings(state),
      overlay: overlayPayload(state),
    };
  }

  function broadcastRr() {
    const payload = publicState();
    io.emit("roundRobinUpdated", payload);
    io.emit("roundRobinStandingsUpdated", payload.standings);
    schedulePersist();
  }

  function sendOk(res, extra) {
    const payload = publicState();
    res.json(extra ? { ...payload, ...extra } : payload);
  }

  function sendErr(res, status, message) {
    res.status(status).json({ error: message });
  }

  function requireLiveLobbyRow(req, res) {
    const match = findMatch(state, req.params.id);
    if (!match) {
      sendErr(res, 404, "Match not found.");
      return null;
    }
    if (String(match.status).toLowerCase() !== "live") {
      sendErr(res, 400, "Knock updates only while the match is LIVE.");
      return null;
    }
    const row = (match.teams || []).find((t) => String(t.teamId) === String(req.params.teamId));
    if (!row) {
      sendErr(res, 404, "Team is not in this Round Robin match.");
      return null;
    }
    if (isRondoMapMatch(match)) normalizeLobbyRondoFields(row);
    return { match, row };
  }

  load();

  app.get("/round-robin", (_req, res) => {
    res.json(publicState());
  });

  app.get("/round-robin/standings", (_req, res) => {
    res.json(getStandings(state));
  });

  app.get("/round-robin/overlay", (_req, res) => {
    res.json(overlayPayload(state));
  });

  app.post("/round-robin/settings", (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (Object.prototype.hasOwnProperty.call(body, "allowSameGroup")) {
      state.allowSameGroup = Boolean(body.allowSameGroup);
    }
    broadcastRr();
    sendOk(res);
  });

  app.post("/round-robin/groups", (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const letter = nextLetter(state.groups);
    const requested = String(body.name || "").trim().slice(0, 40);
    const group = {
      id: `grp-${Date.now()}`,
      name: requested || `GROUP ${letter}`,
      letter,
      teams: [],
      createdAt: Date.now(),
    };
    state.groups.push(group);
    broadcastRr();
    sendOk(res, { group: publicGroup(group) });
  });

  app.post("/round-robin/groups/:id", (req, res) => {
    const group = findGroup(state, req.params.id);
    if (!group) return sendErr(res, 404, "Group not found.");
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (body.name != null) {
      const name = String(body.name).trim().slice(0, 40);
      if (name) {
        group.name = name;
        syncGroupNameToActiveMatches(state, group.id, name);
      }
    }
    broadcastRr();
    sendOk(res);
  });

  app.delete("/round-robin/groups/:id", (req, res) => {
    const group = findGroup(state, req.params.id);
    if (!group) return sendErr(res, 404, "Group not found.");
    const liveBlocking = (state.matches || []).find(
      (m) =>
        String(m.status).toLowerCase() === "live" &&
        (String(m.group1Id) === String(group.id) || String(m.group2Id) === String(group.id)),
    );
    if (liveBlocking) {
      return sendErr(res, 400, `Cannot delete ${group.name} while match ${liveBlocking.id} is LIVE. End the match first.`);
    }
    const removedMatches = (state.matches || []).filter(
      (m) => String(m.group1Id) === String(group.id) || String(m.group2Id) === String(group.id),
    ).length;
    state.matches = (state.matches || []).filter(
      (m) => String(m.group1Id) !== String(group.id) && String(m.group2Id) !== String(group.id),
    );
    state.groups = state.groups.filter((g) => String(g.id) !== String(group.id));
    broadcastRr();
    sendOk(res, {
      removedMatches,
      message:
        removedMatches > 0
          ? `${group.name} deleted (${removedMatches} match record${removedMatches === 1 ? "" : "s"} removed).`
          : `${group.name} deleted.`,
    });
  });

  app.post("/round-robin/groups/:id/teams", (req, res) => {
    const group = findGroup(state, req.params.id);
    if (!group) return sendErr(res, 404, "Group not found.");
    if (groupInLiveMatch(state, group.id)) {
      return sendErr(res, 400, "Cannot add teams while this group has a LIVE match. End the match first.");
    }
    if (!Array.isArray(group.teams)) group.teams = [];
    if (group.teams.length >= MAX_GROUP_TEAMS) {
      return sendErr(res, 400, `A group can have at most ${MAX_GROUP_TEAMS} teams.`);
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const name = String(body.team || "").trim().slice(0, 48);
    if (!name) return sendErr(res, 400, "Team name is required.");

    let slot = body.slot != null ? Math.floor(Number(body.slot)) : nextFreeSlot(group);
    if (!Number.isFinite(slot) || slot < 1 || slot > MAX_GROUP_TEAMS) {
      return sendErr(res, 400, "No free slot available in this group.");
    }
    if (group.teams.some((t) => Number(t.slot) === slot)) {
      return sendErr(res, 400, `Slot ${group.letter}${slot} is already taken.`);
    }

    const team = {
      id: nextTeamId(),
      team: name.toUpperCase(),
      logo: body.logo || null,
      slot,
    };
    group.teams.push(team);
    group.teams.sort((a, b) => a.slot - b.slot);

    syncTeamToActiveMatches(state, team.id, {
      team: team.team,
      logo: team.logo,
      slot: team.slot,
      slotLabel: `${group.letter}${team.slot}`,
    });
    refreshUpcomingMatchesForGroup(state, group.id);

    broadcastRr();
    sendOk(res, {
      team: {
        ...team,
        teamId: team.id,
        slotLabel: `${group.letter}${team.slot}`,
        groupId: group.id,
        groupName: group.name,
      },
    });
  });

  app.post("/round-robin/teams/:teamId", (req, res) => {
    const ctx = findTeamContext(state, req.params.teamId);
    if (!ctx) return sendErr(res, 404, "Round Robin team not found.");
    const { group, team } = ctx;
    const body = req.body && typeof req.body === "object" ? req.body : {};

    if (body.team != null) {
      const name = String(body.team).trim().slice(0, 48);
      if (name) team.team = name.toUpperCase();
    }
    if (body.slot != null) {
      const slot = Math.floor(Number(body.slot));
      if (Number.isFinite(slot) && slot >= 1 && slot <= MAX_GROUP_TEAMS) {
        const other = group.teams.find((t) => String(t.id) !== String(team.id) && Number(t.slot) === slot);
        if (other) return sendErr(res, 400, `Slot ${group.letter}${slot} is already taken.`);
        team.slot = slot;
      }
    }

    group.teams.sort((a, b) => a.slot - b.slot);
    syncTeamToActiveMatches(state, team.id, {
      team: team.team,
      logo: team.logo,
      slot: team.slot,
      slotLabel: `${group.letter}${team.slot}`,
    });
    refreshUpcomingMatchesForGroup(state, group.id);

    broadcastRr();
    sendOk(res, {
      team: {
        ...team,
        teamId: team.id,
        slotLabel: `${group.letter}${team.slot}`,
        groupId: group.id,
        groupName: group.name,
      },
    });
  });

  app.delete("/round-robin/teams/:teamId", (req, res) => {
    const ctx = findTeamContext(state, req.params.teamId);
    if (!ctx) return sendErr(res, 404, "Round Robin team not found.");
    const active = teamInActiveMatch(state, ctx.team.id);
    if (active) {
      return sendErr(res, 400, `Cannot delete team while match ${active.id} is ${active.status}.`);
    }
    ctx.group.teams = (ctx.group.teams || []).filter((t) => String(t.id) !== String(ctx.team.id));
    refreshUpcomingMatchesForGroup(state, ctx.group.id);
    broadcastRr();
    sendOk(res);
  });

  app.post("/round-robin/teams/:teamId/logo", (req, res) => {
    rrLogoUpload.single("logo")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return sendErr(res, 400, "Logo too large (max 8 MB).");
        }
        return sendErr(res, 400, err.message || "Logo upload failed.");
      }

      const ctx = findTeamContext(state, req.params.teamId);
      if (!ctx) return sendErr(res, 404, "Round Robin team not found.");
      if (!req.file) return sendErr(res, 400, "No file received — use PNG, JPG, WebP, GIF, or SVG.");

      ctx.team.logo = `/uploads/logos/${req.file.filename}`;
      syncTeamToActiveMatches(state, ctx.team.id, { logo: ctx.team.logo });
      broadcastRr();
      res.json({ logo: ctx.team.logo, ok: true, ...publicState() });
    });
  });

  app.post("/round-robin/matches", (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const g1 = findGroup(state, body.group1Id);
    const g2 = findGroup(state, body.group2Id);
    if (!g1 || !g2) return sendErr(res, 400, "Select two valid groups.");

    const same = String(g1.id) === String(g2.id);
    if (same && !state.allowSameGroup) {
      return sendErr(res, 400, "Same-group matches are disabled. Enable the option to allow Group A vs Group A.");
    }

    const c1 = (g1.teams || []).length;
    const c2 = (g2.teams || []).length;
    if (c1 < MIN_GROUP_TEAMS || c1 > MAX_GROUP_TEAMS) {
      return sendErr(res, 400, `${g1.name} must have ${MIN_GROUP_TEAMS}–${MAX_GROUP_TEAMS} teams (currently ${c1}).`);
    }
    if (!same && (c2 < MIN_GROUP_TEAMS || c2 > MAX_GROUP_TEAMS)) {
      return sendErr(res, 400, `${g2.name} must have ${MIN_GROUP_TEAMS}–${MAX_GROUP_TEAMS} teams (currently ${c2}).`);
    }

    const teams = snapshotLobby(g1, g2);
    const map =
      typeof sanitizeMatchMap === "function" ? sanitizeMatchMap(body.map) : String(body.map || "erangel");

    const match = {
      id: padMatchId(state.nextMatchSeq),
      group1Id: g1.id,
      group2Id: g2.id,
      group1Name: g1.name,
      group2Name: g2.name,
      map,
      status: "upcoming",
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
      teams,
    };
    state.nextMatchSeq += 1;
    state.matches.push(match);
    broadcastRr();
    sendOk(res, { match: publicMatch(state, match) });
  });

  app.post("/round-robin/matches/:id/start", (req, res) => {
    const match = findMatch(state, req.params.id);
    if (!match) return sendErr(res, 404, "Match not found.");
    if (String(match.status).toLowerCase() === "completed") {
      return sendErr(res, 400, "Completed matches cannot be started again.");
    }
    const otherLive = liveMatch(state);
    if (otherLive && String(otherLive.id) !== String(match.id)) {
      return sendErr(res, 400, `Match ${otherLive.id} is already LIVE. End it before starting another.`);
    }
    match.status = "live";
    match.startedAt = match.startedAt || Date.now();
    if (req.body && req.body.map && typeof sanitizeMatchMap === "function") {
      match.map = sanitizeMatchMap(req.body.map);
    }
    if (isRondoMapMatch(match)) {
      for (const row of match.teams || []) initLobbyRondoFields(row);
    }
    broadcastRr();
    sendOk(res, { match: publicMatch(state, match) });
  });

  app.post("/round-robin/matches/:id/end", (req, res) => {
    const match = findMatch(state, req.params.id);
    if (!match) return sendErr(res, 404, "Match not found.");
    if (String(match.status).toLowerCase() === "completed") {
      return sendErr(res, 400, "This match is already completed.");
    }
    const auto = typeof getAutoCalculate === "function" ? Boolean(getAutoCalculate()) : true;
    (match.teams || []).forEach((row) => applyScore(row, {}, getPositionPoints, auto));
    match.status = "completed";
    match.endedAt = Date.now();
    broadcastRr();
    sendOk(res, { match: publicMatch(state, match) });
  });

  app.post("/round-robin/matches/:id/meta", (req, res) => {
    const match = findMatch(state, req.params.id);
    if (!match) return sendErr(res, 404, "Match not found.");
    if (String(match.status).toLowerCase() === "completed") {
      return sendErr(res, 400, "Completed matches cannot be edited.");
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (body.map != null && typeof sanitizeMatchMap === "function") {
      match.map = sanitizeMatchMap(body.map);
    }
    broadcastRr();
    sendOk(res, { match: publicMatch(state, match) });
  });

  app.post("/round-robin/matches/:id/teams/:teamId", (req, res) => {
    const ctx = requireLiveLobbyRow(req, res);
    if (!ctx) return;
    const { match, row } = ctx;
    const auto = typeof getAutoCalculate === "function" ? Boolean(getAutoCalculate()) : true;
    applyScore(row, req.body || {}, getPositionPoints, auto);
    broadcastRr();
    sendOk(res, { match: publicMatch(state, match), row });
  });

  app.post("/round-robin/matches/:id/teams/:teamId/knock", (req, res) => {
    const ctx = requireLiveLobbyRow(req, res);
    if (!ctx) return;
    const { match, row } = ctx;
    const auto = typeof getAutoCalculate === "function" ? Boolean(getAutoCalculate()) : true;

    if (String(row.status || "").toLowerCase() === "rondo_benched") {
      return sendErr(res, 400, "Benched for Rondo recall — deploy recall before knock updates.");
    }

    clearLobbyRondoKnockAliveOnly(row);

    const knockReq = Number(req.body?.knockCount);
    const knockCount = Number.isFinite(knockReq) ? knockReq : 1;
    const fullFlag = req.body?.fullElimination;
    const forcedFullElimination =
      fullFlag === true ||
      fullFlag === 1 ||
      (typeof fullFlag === "string" && fullFlag.trim().toLowerCase() === "true");

    if (knockCount >= 4 || forcedFullElimination) {
      tryCommitLobbyFullElimination(match, row, getPositionPoints, auto);
    } else {
      row.alivePlayers = Math.max(0, 4 - knockCount);
      if (row.alivePlayers === 0) {
        normalizeLobbyRondoFields(row);
        if (isRondoMapMatch(match) && (row.rondoRecallChargesRemaining || 0) > 0) {
          row.status = "knocked";
        } else {
          tryCommitLobbyFullElimination(match, row, getPositionPoints, auto);
        }
      } else {
        row.status = "knocked";
        recalcLobbyRow(row, getPositionPoints, auto);
      }
    }

    broadcastRr();
    sendOk(res, { match: publicMatch(state, match), row });
  });

  app.post("/round-robin/matches/:id/teams/:teamId/alive", (req, res) => {
    const ctx = requireLiveLobbyRow(req, res);
    if (!ctx) return;
    const { match, row } = ctx;
    const auto = typeof getAutoCalculate === "function" ? Boolean(getAutoCalculate()) : true;

    if (String(row.status || "").toLowerCase() === "rondo_benched") {
      return sendErr(res, 400, "Cannot set alive count while benched — trigger Rondo recall first.");
    }

    clearLobbyRondoKnockAliveOnly(row);

    const count = Math.max(0, Math.min(4, Number(req.body?.alivePlayers)));
    const wasEliminated = String(row.status || "").toLowerCase() === "eliminated";

    if (count > 0 && wasEliminated) {
      restoreLobbyEliminated(match, row, getPositionPoints, auto);
      row.alivePlayers = count;
      row.status = count < 4 ? "knocked" : "alive";
      recalcLobbyRow(row, getPositionPoints, auto);
      broadcastRr();
      return sendOk(res, { match: publicMatch(state, match), row });
    }

    row.alivePlayers = count;
    if (count === 0) {
      normalizeLobbyRondoFields(row);
      if (isRondoMapMatch(match) && (row.rondoRecallChargesRemaining || 0) > 0) {
        row.status = "knocked";
        recalcLobbyRow(row, getPositionPoints, auto);
      } else {
        tryCommitLobbyFullElimination(match, row, getPositionPoints, auto);
      }
    } else if (count < 4) {
      row.status = "knocked";
      recalcLobbyRow(row, getPositionPoints, auto);
    } else {
      row.status = "alive";
      recalcLobbyRow(row, getPositionPoints, auto);
    }

    broadcastRr();
    sendOk(res, { match: publicMatch(state, match), row });
  });

  app.post("/round-robin/matches/:id/teams/:teamId/restore-elimination", (req, res) => {
    const ctx = requireLiveLobbyRow(req, res);
    if (!ctx) return;
    const { match, row } = ctx;
    const auto = typeof getAutoCalculate === "function" ? Boolean(getAutoCalculate()) : true;
    if (!restoreLobbyEliminated(match, row, getPositionPoints, auto)) {
      return sendErr(res, 400, "Team is not eliminated.");
    }
    broadcastRr();
    sendOk(res, { match: publicMatch(state, match), row });
  });

  app.post("/round-robin/matches/:id/teams/:teamId/rondo-recall", (req, res) => {
    const ctx = requireLiveLobbyRow(req, res);
    if (!ctx) return;
    const { match, row } = ctx;
    const auto = typeof getAutoCalculate === "function" ? Boolean(getAutoCalculate()) : true;

    if (!isRondoMapMatch(match)) {
      return sendErr(res, 400, "Rondo recall only when Round Robin match map is Rondo.");
    }

    normalizeLobbyRondoFields(row);
    clearLobbyRondoKnockAliveOnly(row);
    const st = String(row.status || "").toLowerCase();
    const ap = Math.max(0, Math.min(4, Number(row.alivePlayers) || 0));
    let charges = row.rondoRecallChargesRemaining;
    const awaitingRecall = coerceJsonBool(row.rondoAwaitingRecall, false);
    const fromBench = st === "rondo_benched" && awaitingRecall;
    const partialEligible =
      charges > 0 &&
      st !== "eliminated" &&
      st !== "rondo_benched" &&
      ap >= 1 &&
      ap <= 3 &&
      (st === "alive" || st === "knocked");

    if (!fromBench && !partialEligible) {
      return sendErr(
        res,
        400,
        charges <= 0
          ? "No recall credits left on this squad (4 total per match, one per seated player)."
          : "Recall unavailable — need recall bench awaiting deploy, or 1–3 players up mid-fight.",
      );
    }

    row.rondoAwaitingRecall = false;
    const body = req.body && typeof req.body === "object" ? req.body : {};

    if (fromBench) {
      const maxBenchSlots = Math.min(4, charges);
      const rawBody = body.addAliveSlots ?? body.redeployCount;
      let addSlots;
      if (rawBody === undefined || rawBody === null || rawBody === "") {
        addSlots = maxBenchSlots;
      } else {
        const n = Number(rawBody);
        if (!Number.isFinite(n)) {
          return sendErr(res, 400, "addAliveSlots must be a number (knocked seats to redeploy from bench).");
        }
        addSlots = Math.trunc(n);
        if (addSlots < 1 || addSlots > maxBenchSlots) {
          return sendErr(
            res,
            400,
            `Bench redeploy uses 1–${maxBenchSlots} recall credit(s); each credit returns one seated player.`,
          );
        }
      }
      charges -= addSlots;
      row.rondoRecallChargesRemaining = charges;
      row.alivePlayers = addSlots;
      row.status = addSlots === 4 ? "alive" : "knocked";
    } else {
      const maxAdd = 4 - ap;
      const rawBody = body.addAliveSlots ?? body.redeployCount;
      let addSlots;
      if (rawBody === undefined || rawBody === null || rawBody === "") {
        addSlots = Math.min(maxAdd, charges);
      } else {
        const n = Number(rawBody);
        if (!Number.isFinite(n)) {
          return sendErr(res, 400, "addAliveSlots must be a number (how many knocked players to recall).");
        }
        addSlots = Math.trunc(n);
        if (addSlots < 1 || addSlots > maxAdd) {
          return sendErr(res, 400, `Recall must revive 1–${maxAdd} player slot(s) (currently ${ap}/4 up).`);
        }
      }
      if (addSlots > charges) {
        return sendErr(
          res,
          400,
          `Need ${addSlots} recall credits but squad only has ${charges} left (one credit per recalled player).`,
        );
      }
      const nextAlive = Math.min(4, ap + addSlots);
      row.alivePlayers = nextAlive;
      row.status = nextAlive === 4 ? "alive" : "knocked";
      row.rondoRecallChargesRemaining = charges - addSlots;
    }

    row.rondoRecallConsumed = row.rondoRecallChargesRemaining <= 0;
    recalcLobbyRow(row, getPositionPoints, auto);
    checkLobbyWinner(match, getPositionPoints, auto);
    broadcastRr();
    sendOk(res, { match: publicMatch(state, match), row });
  });

  app.post("/round-robin/matches/:id/teams/:teamId/rondo-undo-out", (req, res) => {
    const ctx = requireLiveLobbyRow(req, res);
    if (!ctx) return;
    const { match, row } = ctx;
    const auto = typeof getAutoCalculate === "function" ? Boolean(getAutoCalculate()) : true;

    if (!isRondoMapMatch(match)) {
      return sendErr(res, 400, "Undo OUT only when Round Robin match map is Rondo.");
    }

    normalizeLobbyRondoFields(row);
    if (String(row.status || "").toLowerCase() !== "rondo_benched") {
      return sendErr(
        res,
        400,
        "Undo OUT only works while the squad is on recall bench (mistaken wipe). If already eliminated, use Restore.",
      );
    }

    row.status = "alive";
    row.alivePlayers = 4;
    row.rondoAwaitingRecall = false;
    row.eliminationRank = null;
    recalcLobbyRow(row, getPositionPoints, auto);
    checkLobbyWinner(match, getPositionPoints, auto);
    broadcastRr();
    sendOk(res, { match: publicMatch(state, match), row });
  });

  app.post("/round-robin/matches/:id/teams/:teamId/rondo-finalize-elimination", (req, res) => {
    const ctx = requireLiveLobbyRow(req, res);
    if (!ctx) return;
    const { match, row } = ctx;
    const auto = typeof getAutoCalculate === "function" ? Boolean(getAutoCalculate()) : true;

    if (!isRondoMapMatch(match)) {
      return sendErr(res, 400, "Finalize elimination only when match map is Rondo.");
    }
    if (String(row.status || "").toLowerCase() !== "rondo_benched") {
      return sendErr(res, 400, "Squad must be on recall bench to finalize elimination.");
    }

    eliminateLobbyRow(match, row, getPositionPoints, auto);
    broadcastRr();
    sendOk(res, { match: publicMatch(state, match), row });
  });

  app.delete("/round-robin/matches/:id", (req, res) => {
    const match = findMatch(state, req.params.id);
    if (!match) return sendErr(res, 404, "Match not found.");
    if (String(match.status).toLowerCase() === "live") {
      return sendErr(res, 400, "End the LIVE match before deleting it.");
    }
    state.matches = state.matches.filter((m) => String(m.id) !== String(match.id));
    broadcastRr();
    sendOk(res, { message: `Match ${match.id} deleted.` });
  });

  app.post("/round-robin/matches/restart-count", (_req, res) => {
    if (liveMatch(state)) {
      return sendErr(res, 400, "End the LIVE Round Robin match before restarting the match count.");
    }
    const removed = (state.matches || []).length;
    state.matches = [];
    state.nextMatchSeq = 1;
    broadcastRr();
    sendOk(res, {
      message:
        removed > 0
          ? `Match count restarted — removed ${removed} match record${removed === 1 ? "" : "s"}. Next match will be RR-001.`
          : "Match count restarted. Next match will be RR-001.",
    });
  });

  app.post("/round-robin/matches/recount", (_req, res) => {
    if (liveMatch(state)) {
      return sendErr(res, 400, "End the LIVE match before renumbering.");
    }
    const auto = typeof getAutoCalculate === "function" ? Boolean(getAutoCalculate()) : true;
    const sorted = [...(state.matches || [])].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    sorted.forEach((match, index) => {
      match.id = padMatchId(index + 1);
      if (String(match.status).toLowerCase() === "completed") {
        (match.teams || []).forEach((row) => applyScore(row, {}, getPositionPoints, auto));
      }
    });
    state.matches = sorted;
    state.nextMatchSeq = sorted.length + 1;
    broadcastRr();
    sendOk(res, {
      message:
        sorted.length > 0
          ? `Renumbered ${sorted.length} match${sorted.length === 1 ? "" : "es"} (RR-001 … RR-${String(sorted.length).padStart(3, "0")}) and recalculated completed scores.`
          : "No matches to renumber.",
    });
  });

  io.on("connection", (socket) => {
    const payload = publicState();
    socket.emit("roundRobinUpdated", payload);
    socket.emit("roundRobinStandingsUpdated", payload.standings);
    socket.on("requestRoundRobin", () => {
      socket.emit("roundRobinUpdated", publicState());
    });
    socket.on("requestRoundRobinStandings", () => {
      socket.emit("roundRobinStandingsUpdated", getStandings(state));
    });
  });

  return { publicState, persist };
}

module.exports = mountRoundRobin;
