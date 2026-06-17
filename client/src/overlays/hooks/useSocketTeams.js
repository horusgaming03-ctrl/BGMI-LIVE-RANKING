import { useEffect, useRef, useState } from "react";
import socket, { API } from "../socket";

export function normalizeTeamsPayload(payload) {
  return Array.isArray(payload) ? payload : [];
}

const TEAM_STABLE_KEYS = [
  "id",
  "team",
  "logo",
  "finishes",
  "points",
  "alivePlayers",
  "status",
  "displayOrder",
  "eliminationRank",
];

export function teamsPayloadEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left === right) continue;
    if (!left || !right) return false;

    for (const key of TEAM_STABLE_KEYS) {
      if (String(left[key] ?? "") !== String(right[key] ?? "")) {
        return false;
      }
    }
  }

  return true;
}

function stableJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

export function overlayPackEqual(a, b) {
  return stableJson(a) === stableJson(b);
}

/**
 * Live team list for OBS / browser overlays.
 * Socket.IO is primary; HTTP GET /teams is fallback when socket is slow or blocked (common in OBS).
 */
export function useOverlayTeams() {
  const [teams, setTeams] = useState([]);
  const teamsFromSocketRef = useRef(false);

  useEffect(() => {
    function onTeams(data) {
      teamsFromSocketRef.current = true;
      const next = normalizeTeamsPayload(data);
      setTeams((prev) => (teamsPayloadEqual(prev, next) ? prev : next));
    }
    function requestTeams() {
      socket.emit("requestTeams");
    }
    socket.on("teamsUpdated", onTeams);
    socket.on("connect", requestTeams);
    if (socket.connected) requestTeams();
    return () => {
      socket.off("teamsUpdated", onTeams);
      socket.off("connect", requestTeams);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry = null;

    async function pullTeams() {
      try {
        const r = await fetch(`${API}/teams`);
        if (cancelled || !r.ok) return;
        const d = await r.json();
        if (!Array.isArray(d) || d.length === 0) return;
        setTeams((prev) => (teamsPayloadEqual(prev, d) ? prev : d));
        if (retry != null) {
          window.clearInterval(retry);
          retry = null;
        }
      } catch {
        /* API offline */
      }
    }

    void pullTeams();
    retry = window.setInterval(() => {
      if (teamsFromSocketRef.current) {
        if (retry != null) window.clearInterval(retry);
        return;
      }
      void pullTeams();
    }, 4000);

    return () => {
      cancelled = true;
      if (retry != null) window.clearInterval(retry);
    };
  }, []);

  return teams;
}
