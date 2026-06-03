/** Live match / teams from main tournament API (rank #1 = WWCD squad). */

export function matchNumberFromCard(match, index) {
  const raw = String(match?.matchNumber || "").replace(/[^\d]/g, "");
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : index + 1;
}

/** Show WWCD art when this match is already played or just ended. */
export function shouldShowWwcdForCard(match, index, live) {
  const num = matchNumberFromCard(match, index);
  const cur = Number(live?.number) || 1;
  const status = String(live?.status || "live").toLowerCase();
  if (num < cur) return true;
  if (num === cur && status === "ended") return true;
  return false;
}

export function teamInitialsFromName(teamName) {
  const s = String(teamName || "")
    .trim()
    .toUpperCase();
  if (!s) return "";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0].slice(0, 2) + parts[1].slice(0, 2)).slice(0, 4);
  return s.slice(0, 4);
}

/** Winner squad for a finished match slot (history snapshot or live #1). */
export function resolveWwcdTeamForMatch(matchNum, liveState) {
  const history = Array.isArray(liveState?.history) ? liveState.history : [];
  const entry = history.find((m) => Number(m.number) === Number(matchNum));
  if (entry) {
    const teams = Array.isArray(entry.teams) ? entry.teams : [];
    const byRank = teams.find((t) => Number(t.eliminationRank) === 1);
    if (byRank) return byRank;
    if (entry.winner) {
      const named = teams.find(
        (t) => String(t.team || "").toUpperCase() === String(entry.winner).toUpperCase(),
      );
      if (named) return named;
      return { team: entry.winner, logo: null };
    }
    if (teams[0]) return teams[0];
  }

  const liveTeams = Array.isArray(liveState?.teams) ? liveState.teams : [];
  const rank1 = liveTeams.find((t) => Number(t.eliminationRank) === 1);
  if (rank1) return rank1;
  return liveTeams[0] || null;
}

/** Fingerprint of per-card WWCD state — skip DOM refresh when unchanged. */
export function liveCardsSignature(config, live) {
  const count = Math.max(1, Math.min(8, Number(config?.matchCount) || 6));
  const parts = [];
  for (let i = 0; i < count; i++) {
    const m = config?.matches?.[i] || {};
    const num = matchNumberFromCard(m, i);
    const show = shouldShowWwcdForCard(m, i, live);
    const team = show ? resolveWwcdTeamForMatch(num, live) : null;
    parts.push(
      `${num}:${show ? 1 : 0}:${team?.team || ""}:${team?.logo || ""}`,
    );
  }
  return parts.join("|");
}

export async function fetchLiveTournamentState(apiBase) {
  const base = String(apiBase || "").replace(/\/$/, "");
  const out = { number: 1, status: "live", teams: [], history: [] };
  try {
    const [matchRes, histRes] = await Promise.all([
      fetch(`${base}/match/current`, { cache: "no-store" }),
      fetch(`${base}/matches/history`, { cache: "no-store" }),
    ]);
    if (matchRes.ok) {
      const data = await matchRes.json();
      out.number = Number(data.number) || 1;
      out.status = data.status || "live";
      out.map = data.map;
      if (Array.isArray(data.teams)) out.teams = data.teams;
    }
    if (histRes.ok) {
      out.history = await histRes.json();
    }
  } catch (e) {
    console.warn("[schedule-overlay] live state:", e?.message || e);
  }
  return out;
}
