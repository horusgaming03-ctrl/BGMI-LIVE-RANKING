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
