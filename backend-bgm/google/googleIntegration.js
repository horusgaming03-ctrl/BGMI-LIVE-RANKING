/**
 * Google Drive + Google Sheets integration (service account).
 * Set GOOGLE_APPLICATION_CREDENTIALS to a JSON key file and share your
 * Drive folder + target Sheet with the service account email.
 */
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

let _google = null;
function loadGoogle() {
  if (_google) return _google;
  try {
    _google = require("googleapis").google;
  } catch {
    _google = null;
  }
  return _google;
}

function credentialsPathResolved() {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!p || typeof p !== "string") return null;
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  return fs.existsSync(abs) ? abs : null;
}

function getAuthFromEnv() {
  const google = loadGoogle();
  if (!google) return null;
  const keyFile = credentialsPathResolved();
  if (!keyFile) return null;
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  });
  return { google, auth };
}

function getClients() {
  const x = getAuthFromEnv();
  if (!x) return null;
  const { google, auth } = x;
  return {
    drive: google.drive({ version: "v3", auth }),
    sheets: google.sheets({ version: "v4", auth }),
  };
}

function normHeader(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findColIndex(headers, candidates) {
  const list = Array.isArray(headers) ? headers.map(normHeader) : [];
  for (const c of candidates) {
    const n = normHeader(c);
    const i = list.findIndex((h) => h === n || h.includes(n) || n.includes(h));
    if (i !== -1) return i;
  }
  return -1;
}

function extractPlayerColumns(headers, row) {
  const players = [];
  const list = Array.isArray(headers) ? headers : [];
  list.forEach((h, i) => {
    const hn = normHeader(h);
    if (!hn || hn === "timestamp") return;
    if (
      /^(player\s*\d+|p\d+|ign\s*\d+|member\s*\d+|slot\s*\d+)$/.test(hn.replace(/\s/g, "")) ||
      hn.startsWith("player ") ||
      hn.startsWith("ign ") ||
      /\bign\b/.test(hn)
    ) {
      const v = row[i];
      if (v != null && String(v).trim() !== "") players.push(String(v).trim());
    }
  });
  return players.slice(0, 8);
}

function padSquadFour(players, teamName) {
  const arr = Array.isArray(players) ? players.filter(Boolean).map((s) => String(s).trim()) : [];
  const t = String(teamName || "TEAM").toUpperCase();
  for (let i = arr.length; i < 4; i++) arr.push(`${t} · P${i + 1}`);
  return arr.slice(0, 4).map((s) => s.toUpperCase());
}

/**
 * @returns {{ merged: number, rows: number, errors: string[] }}
 */
async function syncRegistrationSheet(clients, spreadsheetId, range, teams, mergeFn) {
  const errors = [];
  if (!clients || !spreadsheetId || !range) return { merged: 0, rows: 0, errors: ["Missing spreadsheet id or range"] };
  const { sheets } = clients;
  let data;
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    data = res.data.values;
  } catch (e) {
    errors.push(e.message || String(e));
    return { merged: 0, rows: 0, errors };
  }
  if (!Array.isArray(data) || data.length < 2) return { merged: 0, rows: 0, errors: ["Sheet has no data rows"] };

  const headers = data[0];
  const idxTeam = findColIndex(headers, ["team name", "team", "squad", "squad name", "clan"]);
  if (idxTeam === -1) errors.push('No team column found — add a column named "Team name" or "Team"');
  const idxTag = findColIndex(headers, ["tag", "clan tag", "team tag"]);
  const idxNo = findColIndex(headers, ["team #", "team number", "#", "slot"]);
  const idxLogo = findColIndex(headers, ["logo", "logo url", "logo link", "image url"]);

  let merged = 0;
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!Array.isArray(row)) continue;
    const teamName = idxTeam >= 0 ? row[idxTeam] : "";
    const name = String(teamName || "")
      .trim()
      .toUpperCase();
    if (!name) continue;

    const extraPlayers = extractPlayerColumns(headers, row);
    const tag = idxTag >= 0 && row[idxTag] ? String(row[idxTag]).trim() : "";
    const num = idxNo >= 0 && row[idxNo] != null ? String(row[idxNo]).trim() : "";
    const logoUrl = idxLogo >= 0 && row[idxLogo] ? String(row[idxLogo]).trim() : "";

    const players = padSquadFour(extraPlayers, name);
    try {
      mergeFn({
        team: name,
        players,
        tag,
        teamNumber: num,
        logoUrl,
      });
      merged++;
    } catch (e) {
      errors.push(`Row ${r + 1}: ${e.message || e}`);
    }
  }
  return { merged, rows: data.length - 1, errors };
}

function tournamentStatsToCsvRows(stats) {
  const lines = [["Rank", "Team", "M", "Kills", "PosPts", "WWCD", "Total"]];
  stats.forEach((s, i) => {
    lines.push([
      i + 1,
      s.team,
      s.matchesPlayed ?? "",
      s.totalKills ?? "",
      s.totalPositionPoints ?? "",
      s.chickenDinners ?? "",
      s.totalPoints ?? "",
    ]);
  });
  return lines.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function buildExportBundle({ teams, matchHistory, currentMatch, tournamentStats }) {
  const stats = Array.isArray(tournamentStats) ? tournamentStats : [];
  const fraggers = [...stats].sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0)).slice(0, 30);
  const mvpCandidates = [...stats].sort(
    (a, b) =>
      (b.totalPoints || 0) - (a.totalPoints || 0) ||
      (b.totalKills || 0) - (a.totalKills || 0)
  );
  const wwcdHistory = (Array.isArray(matchHistory) ? matchHistory : [])
    .filter((m) => m && m.winner)
    .map((m) => ({
      matchNumber: m.number,
      winner: m.winner,
      map: m.map,
      matchLabel: m.matchLabel,
      endedAt: m.endedAt,
    }));

  return {
    reportVersion: 1,
    exportedAt: new Date().toISOString(),
    currentMatch,
    overallStandings: stats,
    teamRankings: stats.map((s, i) => ({ rank: i + 1, ...s })),
    fraggerLeaderboard: fraggers,
    mvpLeaderboard: mvpCandidates.slice(0, 10),
    wwcdDetails: wwcdHistory,
    matchResults: matchHistory,
    teamsSnapshot: teams.map((t) => ({
      id: t.id,
      team: t.team,
      status: t.status,
      finishes: t.finishes,
      points: t.points,
      logo: t.logo,
      players: t.players,
      alivePlayers: t.alivePlayers,
      eliminationRank: t.eliminationRank,
    })),
    playerStatsNote: "Players live under each team as squad roster; fragger board is team kill totals.",
  };
}

async function uploadTextFile(drive, folderId, name, body, mimeType) {
  const media = { mimeType, body: Readable.from([Buffer.from(body, "utf8")]) };
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media,
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });
  return res.data;
}

/** Upload JSON + CSV tournament snapshot to Drive folder */
async function uploadTournamentSnapshot(clients, folderId, bundle, standingsCsvText) {
  const { drive } = clients;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonName = `tournament-snapshot-${stamp}.json`;
  const csvName = `overall-standings-${stamp}.csv`;
  const jsonBody = JSON.stringify(bundle, null, 2);
  const a = await uploadTextFile(drive, folderId, jsonName, jsonBody, "application/json");
  const b = await uploadTextFile(drive, folderId, csvName, standingsCsvText || "", "text/csv");
  return { json: a, csv: b };
}

const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

/**
 * Download new image files from folder; match filename (without ext) to team.team
 */
async function syncFolderImages(drive, folderId, teams, logosDir, importedIds, onTeamLogo) {
  if (!folderId) return { imported: 0, skipped: 0 };
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    pageSize: 100,
    fields: "files(id,name,mimeType,modifiedTime)",
  });
  const files = res.data.files || [];
  let imported = 0;
  let skipped = 0;

  for (const f of files) {
    if (!f.id || importedIds.includes(f.id)) continue;
    const mime = f.mimeType || "";
    if (!mime.startsWith("image/") && !IMAGE_MIME.has(mime)) {
      skipped++;
      continue;
    }
    const stem = path.parse(f.name || "").name.toUpperCase().trim();
    const team = teams.find(
      (t) => t.team === stem || t.team.replace(/\s+/g, "") === stem.replace(/\s+/g, "")
    );
    if (!team) {
      skipped++;
      continue;
    }
    const destRes = await drive.files.get({ fileId: f.id, alt: "media" }, { responseType: "arraybuffer" });
    const buf = Buffer.from(destRes.data);
    const ext = path.extname(f.name || "") || ".png";
    const safe = `.${String(ext).replace(/^\./, "").toLowerCase().replace(/[^a-z0-9]/g, "") || "png"}`;
    const fname = `gdrive-${team.id}-${Date.now()}${safe}`;
    const full = path.join(logosDir, fname);
    fs.writeFileSync(full, buf);
    const rel = `/uploads/logos/${fname}`;
    onTeamLogo(team, rel);
    importedIds.push(f.id);
    imported++;
  }
  return { imported, skipped };
}

module.exports = {
  credentialsPathResolved,
  getClients,
  getAuthFromEnv,
  buildExportBundle,
  tournamentStatsToCsvRows,
  uploadTournamentSnapshot,
  syncRegistrationSheet,
  syncFolderImages,
  loadGoogle,
};
