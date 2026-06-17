/**
 * Live tournament data bridge — Socket.IO + REST fallback for OBS browser sources.
 */

function isLoopbackHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

export function resolveApiOrigin() {
  const qs = new URLSearchParams(window.location.search);
  const forced = qs.get("api");
  if (forced && /^https?:\/\//i.test(forced)) return forced.replace(/\/$/, "");

  const port = String(window.location.port || "");
  const vitePorts = new Set(["5173", "5174", "4173", "4174"]);
  if (vitePorts.has(port)) {
    const host = window.location.hostname;
    if (!isLoopbackHost(host)) return `http://${host}:3001`;
    return "http://127.0.0.1:3001";
  }
  return window.location.origin.replace(/\/$/, "");
}

export function resolveUploadUrl(path) {
  if (!path || typeof path !== "string") return null;
  const s = path.trim();
  if (!s || s.includes("..")) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/")) return `${resolveApiOrigin()}${s}`;
  return null;
}

function aliveCount(team) {
  const status = String(team?.status || "alive").toLowerCase();
  if (status === "eliminated") return 0;
  if (status === "rondo_benched") {
    const ap = Number(team?.alivePlayers);
    return Number.isFinite(ap) ? Math.max(0, Math.min(4, Math.floor(ap))) : 0;
  }
  const ap = Number(team?.alivePlayers);
  if (Number.isFinite(ap) && ap >= 0) return Math.max(0, Math.min(4, Math.floor(ap)));
  return status === "alive" ? 4 : 0;
}

export function normalizeTeam(raw, rankIndex) {
  const status = String(raw?.status || "alive").toLowerCase();
  const finishes = Number(raw?.finishes) || 0;
  const placementPoints = Number(raw?.positionPoints) || 0;
  const totalPoints = Number(raw?.points) || finishes + placementPoints;
  return {
    id: raw?.id ?? `@${raw?.team || "unnamed"}`,
    teamName: String(raw?.team || "(unnamed)").trim() || "(unnamed)",
    rank: rankIndex,
    totalPoints,
    finishPoints: finishes,
    placementPoints,
    alivePlayers: aliveCount(raw),
    eliminated: status === "eliminated",
    eliminationRank: raw?.eliminationRank ?? null,
    eliminatorName: raw?.eliminatorName || raw?.lastEliminator || null,
    status,
    teamLogo: resolveUploadUrl(raw?.logo),
    players: Array.isArray(raw?.players) ? raw.players : [],
    recallStatus: {
      charges: Number(raw?.rondoRecallChargesRemaining) || 0,
      consumed: Boolean(raw?.rondoRecallConsumed),
      awaiting: Boolean(raw?.rondoAwaitingRecall),
      benched: status === "rondo_benched",
    },
    raw,
  };
}

/** OBS stream ranking: points DESC → alive DESC → id ASC */
export function streamRankingOrder(teams) {
  const arr = Array.isArray(teams) ? [...teams] : [];
  return arr.sort((a, b) => {
    const pa = Number(a?.points) || 0;
    const pb = Number(b?.points) || 0;
    if (pb !== pa) return pb - pa;
    const va = aliveCount(a);
    const vb = aliveCount(b);
    if (vb !== va) return vb - va;
    return (Number(a?.id) || 0) - (Number(b?.id) || 0);
  });
}

export function topFourAlive(teams) {
  return streamRankingOrder(teams)
    .filter((t) => {
      const s = String(t?.status || "alive").toLowerCase();
      return s === "alive" || s === "rondo_benched";
    })
    .slice(0, 4)
    .map((t, i) => normalizeTeam(t, i + 1));
}

export function createDataBridge(callbacks = {}) {
  const api = resolveApiOrigin();
  let teams = [];
  let match = { number: 1, status: "live", map: "", matchLabel: "" };
  let tournament = [];
  let settings = {};
  let eliminationQueue = [];
  let overlayCommands = [];

  const emit = (name, payload) => {
    if (typeof callbacks[name] === "function") callbacks[name](payload);
  };

  const applyTeams = (list) => {
    const ordered = streamRankingOrder(list);
    teams = ordered.map((t, i) => normalizeTeam(t, i + 1));
    emit("teams", teams);
  };

  const socket = window.io(api, { transports: ["polling", "websocket"] });

  socket.on("teamsUpdated", applyTeams);
  socket.on("matchUpdated", (m) => {
    match = { ...match, ...m };
    if (Array.isArray(m?.teams)) applyTeams(m.teams);
    emit("match", match);
  });
  socket.on("tournamentUpdated", (stats) => {
    tournament = Array.isArray(stats) ? stats : [];
    emit("tournament", tournament);
  });
  socket.on("settingsUpdated", (s) => {
    settings = s || {};
    emit("settings", settings);
  });
  socket.on("teamEliminated", (payload) => {
    eliminationQueue.push(payload);
    emit("elimination", payload);
  });
  socket.on("chickenDinner", (payload) => emit("winner", payload));
  socket.on("overlayCommand", (cmd) => {
    overlayCommands.push(cmd);
    emit("command", cmd);
  });
  socket.on("rondoBench", (payload) => emit("recall", payload));

  fetch(`${api}/teams`)
    .then((r) => r.json())
    .then((list) => applyTeams(list))
    .catch(() => {});

  fetch(`${api}/match/current`)
    .then((r) => r.json())
    .then((m) => {
      match = { ...match, ...m };
      emit("match", match);
    })
    .catch(() => {});

  return {
    apiOrigin: api,
    getTeams: () => teams,
    getMatch: () => match,
    getTournament: () => tournament,
    getSettings: () => settings,
    popElimination: () => eliminationQueue.shift() || null,
    disconnect: () => socket.disconnect(),
  };
}
