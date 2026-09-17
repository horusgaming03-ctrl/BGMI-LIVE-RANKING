import { useEffect, useRef, useState } from "react";
import socket, { API } from "../socket";
import { normalizeTeamsPayload, teamsPayloadEqual } from "./useSocketTeams";
import { normalizeMatchMeta } from "../../normalizeMatchMeta";

export function overlayPackFromPayload(data) {
  if (!data || typeof data !== "object") {
    return { teams: [], match: null };
  }
  if (Array.isArray(data.teams) && data.match) {
    return { teams: normalizeTeamsPayload(data.teams), match: data.match };
  }
  if (data.overlay && typeof data.overlay === "object") {
    return {
      teams: normalizeTeamsPayload(data.overlay.teams),
      match: data.overlay.match || null,
    };
  }
  const live = data.liveMatch;
  if (live && String(live.status).toLowerCase() === "live") {
    return {
      teams: (live.teams || []).map((row, i) => ({
        id: Number(row.teamId) || i,
        team: row.team,
        logo: row.logo,
        finishes: row.finishes,
        points: row.points,
        positionPoints: row.positionPoints,
        alivePlayers: row.alivePlayers,
        status: row.status,
        displayOrder: i + 1,
        eliminationRank: row.eliminationRank,
        rondoRecallChargesRemaining: row.rondoRecallChargesRemaining,
        rondoRecallConsumed: row.rondoRecallConsumed,
        rondoAwaitingRecall: row.rondoAwaitingRecall,
        rondoKnockAliveOnly: row.rondoKnockAliveOnly,
      })),
      match: {
        number: 1,
        status: "live",
        startedAt: live.startedAt || Date.now(),
        map: live.map || "erangel",
        matchLabel: live.label || "",
      },
    };
  }
  return { teams: [], match: data.overlay?.match || null };
}

/**
 * Round Robin overlay data. Separate from useOverlayTeams / teamsUpdated.
 */
export function useRoundRobinOverlay() {
  const [teams, setTeams] = useState([]);
  const [matchMeta, setMatchMeta] = useState(() => ({
    number: 1,
    status: "ended",
    startedAt: Date.now(),
    map: "erangel",
    matchLabel: "",
  }));
  const fromSocketRef = useRef(false);

  useEffect(() => {
    function apply(data) {
      const pack = overlayPackFromPayload(data);
      fromSocketRef.current = true;
      setTeams((prev) => (teamsPayloadEqual(prev, pack.teams) ? prev : pack.teams));
      const meta = normalizeMatchMeta(pack.match);
      if (meta) setMatchMeta(meta);
    }
    function request() {
      socket.emit("requestRoundRobin");
    }
    socket.on("roundRobinUpdated", apply);
    socket.on("connect", request);
    if (socket.connected) request();
    return () => {
      socket.off("roundRobinUpdated", apply);
      socket.off("connect", request);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry = null;

    async function pull() {
      try {
        const r = await fetch(`${API}/round-robin/overlay`);
        if (cancelled || !r.ok) return;
        const d = await r.json();
        const pack = overlayPackFromPayload(d);
        setTeams((prev) => (teamsPayloadEqual(prev, pack.teams) ? prev : pack.teams));
        const meta = normalizeMatchMeta(pack.match);
        if (meta) setMatchMeta(meta);
        if (fromSocketRef.current && retry != null) {
          window.clearInterval(retry);
          retry = null;
        }
      } catch {
        /* API offline */
      }
    }

    void pull();
    retry = window.setInterval(() => {
      if (fromSocketRef.current) {
        if (retry != null) window.clearInterval(retry);
        return;
      }
      void pull();
    }, 4000);

    return () => {
      cancelled = true;
      if (retry != null) window.clearInterval(retry);
    };
  }, []);

  return { teams, matchMeta };
}
