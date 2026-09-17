import { useCallback } from "react";
import { connectSocket } from "../apiOrigin";

const socket = connectSocket();

async function readApiError(res) {
  try {
    const data = await res.json();
    if (data?.error) return String(data.error);
    if (data?.message) return String(data.message);
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

/**
 * Knock actions for Simple (main teams[]) or Round Robin live lobby.
 * Same 1K / 2K / 3K / OUT / Restore / finish arrows process.
 */
export function useKnockControlActions({
  source = "simple",
  apiBase,
  liveMatchId,
  autoCalculate = true,
  onMessage,
  onRoundRobinPayload,
}) {
  const knockTeam = useCallback(
    async (teamId, knockCount, fullElimination = false) => {
      if (source === "roundRobin") {
        if (!liveMatchId) {
          onMessage?.("Start a Round Robin match first.");
          return;
        }
        const res = await fetch(`${apiBase}/round-robin/matches/${liveMatchId}/teams/${teamId}/knock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ knockCount, fullElimination }),
        });
        if (!res.ok) {
          onMessage?.(await readApiError(res));
          return;
        }
        const data = await res.json();
        onRoundRobinPayload?.(data);
        onMessage?.("Knock updated live.");
        return;
      }

      const res = await fetch(`${apiBase}/teams/${teamId}/knock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knockCount, fullElimination }),
      });
      if (!res.ok) {
        onMessage?.(await readApiError(res));
        return;
      }
      onMessage?.("Knock updated live.");
      socket.emit("requestTeams");
    },
    [source, apiBase, liveMatchId, onMessage, onRoundRobinPayload],
  );

  const setAlive = useCallback(
    async (teamId, alivePlayers) => {
      if (source === "roundRobin") {
        if (!liveMatchId) {
          onMessage?.("Start a Round Robin match first.");
          return;
        }
        const res = await fetch(`${apiBase}/round-robin/matches/${liveMatchId}/teams/${teamId}/alive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alivePlayers }),
        });
        if (!res.ok) {
          onMessage?.(await readApiError(res));
          return;
        }
        const data = await res.json();
        onRoundRobinPayload?.(data);
        onMessage?.("Alive count updated.");
        return;
      }

      const res = await fetch(`${apiBase}/teams/${teamId}/alive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alivePlayers }),
      });
      if (!res.ok) {
        onMessage?.(await readApiError(res));
        return;
      }
      onMessage?.("Alive count updated.");
      socket.emit("requestTeams");
    },
    [source, apiBase, liveMatchId, onMessage, onRoundRobinPayload],
  );

  const adjustTeamFinishes = useCallback(
    async (team, delta) => {
      const nextFinishes = Math.max(0, Number(team.finishes || 0) + delta);
      const pos = Number(team.positionPoints) || 0;

      if (source === "roundRobin") {
        if (!liveMatchId) {
          onMessage?.("Start a Round Robin match first.");
          return;
        }
        const res = await fetch(`${apiBase}/round-robin/matches/${liveMatchId}/teams/${team.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finishes: nextFinishes,
            points: autoCalculate ? nextFinishes + pos : Math.max(0, Number(team.points || 0) + delta),
          }),
        });
        if (!res.ok) {
          onMessage?.(await readApiError(res));
          return;
        }
        const data = await res.json();
        onRoundRobinPayload?.(data);
        onMessage?.("Finish points updated — rankings refreshed.");
        return;
      }

      const payload = {
        team: team.team,
        status: team.status,
        finishes: nextFinishes,
        points: autoCalculate ? nextFinishes + pos : Math.max(0, Number(team.points || 0) + delta),
      };
      const res = await fetch(`${apiBase}/teams/${team.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) onMessage?.("Finish points updated — rankings refreshed.");
      else onMessage?.("Could not update finishes.");
    },
    [source, apiBase, liveMatchId, autoCalculate, onMessage, onRoundRobinPayload],
  );

  const restoreEliminatedTeam = useCallback(
    async (team) => {
      if (
        !window.confirm(
          `${team.team}: restore from OUT?\n\nReturns squad to 4/4 alive and fixes placement ranks for this match.`,
        )
      ) {
        return;
      }

      if (source === "roundRobin") {
        if (!liveMatchId) {
          onMessage?.("Start a Round Robin match first.");
          return;
        }
        const res = await fetch(
          `${apiBase}/round-robin/matches/${liveMatchId}/teams/${team.id}/restore-elimination`,
          { method: "POST", headers: { "Content-Type": "application/json" } },
        );
        if (!res.ok) {
          onMessage?.(await readApiError(res));
          return;
        }
        const data = await res.json();
        onRoundRobinPayload?.(data);
        onMessage?.("Team restored from OUT.");
        return;
      }

      const res = await fetch(`${apiBase}/teams/${team.id}/restore-elimination`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        onMessage?.(await readApiError(res));
        socket.emit("requestTeams");
        return;
      }
      onMessage?.("Team restored from OUT.");
      socket.emit("requestTeams");
    },
    [source, apiBase, liveMatchId, onMessage, onRoundRobinPayload],
  );

  const triggerRondoRecall = useCallback(
    async (teamId, addAliveSlots) => {
      if (source !== "roundRobin") return;
      if (!liveMatchId) {
        onMessage?.("Start a Round Robin match first.");
        return;
      }
      const body =
        addAliveSlots === undefined || addAliveSlots === null
          ? {}
          : { addAliveSlots: Number(addAliveSlots) };
      const res = await fetch(
        `${apiBase}/round-robin/matches/${liveMatchId}/teams/${teamId}/rondo-recall`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      if (!res.ok) {
        onMessage?.(await readApiError(res));
        return;
      }
      const data = await res.json();
      onRoundRobinPayload?.(data);
      onMessage?.("Rondo recall applied.");
    },
    [source, apiBase, liveMatchId, onMessage, onRoundRobinPayload],
  );

  const undoRondoMistakenBench = useCallback(
    async (teamId) => {
      if (source !== "roundRobin") return;
      if (!liveMatchId) {
        onMessage?.("Start a Round Robin match first.");
        return;
      }
      const res = await fetch(
        `${apiBase}/round-robin/matches/${liveMatchId}/teams/${teamId}/rondo-undo-out`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      if (!res.ok) {
        onMessage?.(await readApiError(res));
        return;
      }
      const data = await res.json();
      onRoundRobinPayload?.(data);
      onMessage?.("Undo OUT — squad restored to 4/4.");
    },
    [source, apiBase, liveMatchId, onMessage, onRoundRobinPayload],
  );

  const finalizeBenchedElimination = useCallback(
    async (team) => {
      if (source !== "roundRobin") return;
      if (!liveMatchId) {
        onMessage?.("Start a Round Robin match first.");
        return;
      }
      const res = await fetch(
        `${apiBase}/round-robin/matches/${liveMatchId}/teams/${team.id}/rondo-finalize-elimination`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      if (!res.ok) {
        onMessage?.(await readApiError(res));
        return;
      }
      const data = await res.json();
      onRoundRobinPayload?.(data);
      onMessage?.("Bench finalized — squad eliminated for placement.");
    },
    [source, apiBase, liveMatchId, onMessage, onRoundRobinPayload],
  );

  return {
    knockTeam,
    setAlive,
    adjustTeamFinishes,
    restoreEliminatedTeam,
    triggerRondoRecall,
    undoRondoMistakenBench,
    finalizeBenchedElimination,
  };
}
