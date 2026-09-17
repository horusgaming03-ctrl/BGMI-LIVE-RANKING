/** Normalize Round Robin lobby rows into knock-control team shape. */
export function normalizeRoundRobinKnockTeams(liveMatch) {
  if (!liveMatch || !Array.isArray(liveMatch.teams)) return [];
  return liveMatch.teams.map((t) => ({
    id: t.teamId,
    teamId: t.teamId,
    team: t.team || "",
    logo: t.logo || null,
    finishes: Number(t.finishes) || 0,
    points: Number(t.points) || 0,
    positionPoints: Number(t.positionPoints) || 0,
    status: t.status || "alive",
    alivePlayers: Number.isFinite(Number(t.alivePlayers)) ? Number(t.alivePlayers) : 4,
    eliminationRank: t.eliminationRank == null ? null : Number(t.eliminationRank),
    groupName: t.groupName || "",
    slotLabel: t.slotLabel || "",
    rondoRecallChargesRemaining: t.rondoRecallChargesRemaining,
    rondoRecallConsumed: t.rondoRecallConsumed,
    rondoAwaitingRecall: t.rondoAwaitingRecall,
    rondoKnockAliveOnly: t.rondoKnockAliveOnly,
  }));
}
