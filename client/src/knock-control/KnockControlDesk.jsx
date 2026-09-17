import { useCallback, useMemo, useState } from "react";
import { teamLogoUrl } from "../apiOrigin";
import { knockControlStyles as ns } from "./knockControlStyles";

function knockRowAliveCount(team) {
  const st = String(team?.status || "").toLowerCase();
  if (st === "eliminated" || st === "rondo_benched") {
    return Math.max(0, Math.min(4, Number(team.alivePlayers) || 0));
  }
  const n = Number(team.alivePlayers);
  if (st === "alive") return Math.max(1, Math.min(4, Number.isFinite(n) ? n : 4));
  return Math.max(0, Math.min(4, Number.isFinite(n) ? n : 4));
}

export default function KnockControlDesk({
  teams = [],
  scoresEditable = true,
  actions,
  subtitle,
  showFinishBadgesButton = false,
  finishBadgesObsUrl,
  emptyAliveMessage = "No squads still in the match.",
  emptyElimMessage = "No eliminated squads yet — OUT moves a team here (slot # unchanged).",
}) {
  const { knockTeam, setAlive, adjustTeamFinishes, restoreEliminatedTeam } = actions;

  const stableOrderTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      const ida = Number(a.id);
      const idb = Number(b.id);
      if (!Number.isNaN(ida) && !Number.isNaN(idb) && ida !== idb) return ida - idb;
      return String(a.team || "").localeCompare(String(b.team || ""));
    });
  }, [teams]);

  const [knockTeamRowNumbers, setKnockTeamRowNumbers] = useState({});

  const getKnockControlDisplayNumber = useCallback(
    (teamId, legacyIdx) => {
      const v = knockTeamRowNumbers[teamId];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      const idx = stableOrderTeams.findIndex((t) => t.id === teamId);
      if (idx >= 0) return idx + 1;
      return typeof legacyIdx === "number" && Number.isFinite(legacyIdx) ? legacyIdx + 1 : 1;
    },
    [knockTeamRowNumbers, stableOrderTeams],
  );

  const knockAliveTeams = useMemo(
    () => stableOrderTeams.filter((t) => String(t.status || "").toLowerCase() !== "eliminated"),
    [stableOrderTeams],
  );

  const knockEliminatedTeams = useMemo(
    () => stableOrderTeams.filter((t) => String(t.status || "").toLowerCase() === "eliminated"),
    [stableOrderTeams],
  );

  const commitKnockRowNumberFromIndex = useCallback(
    (idx, raw) => {
      const t = typeof raw === "string" ? raw.trim() : String(raw ?? "");
      if (t === "" || t === "-" || t === "+") return;
      const vNum = Number.parseInt(t, 10);
      if (!Number.isFinite(vNum)) return;
      setKnockTeamRowNumbers((prev) => {
        const ids = stableOrderTeams.map((x) => x.id);
        if (idx < 0 || idx >= ids.length) return prev;
        const disp = (i) => {
          const id = ids[i];
          if (id == null) return i + 1;
          const stored = prev[id];
          return typeof stored === "number" && Number.isFinite(stored) ? stored : i + 1;
        };
        let cleaned = Math.trunc(Math.max(1, Math.min(99999, vNum)));
        const minN = idx > 0 ? disp(idx - 1) + 1 : 1;
        cleaned = Math.max(minN, cleaned);
        const next = { ...prev };
        next[ids[idx]] = cleaned;
        for (let j = idx + 1; j < ids.length; j += 1) {
          next[ids[j]] = cleaned + (j - idx);
        }
        return next;
      });
    },
    [stableOrderTeams],
  );

  const renderKnockControlRow = useCallback(
    (team) => {
      const statusLc = String(team.status || "").toLowerCase();
      const alive = knockRowAliveCount(team);
      const isOut = statusLc === "eliminated";
      const canRestoreOut = scoresEditable && isOut;
      const globalIdx = stableOrderTeams.findIndex((t) => t.id === team.id);
      const rowNumVal = getKnockControlDisplayNumber(team.id);
      const minSelectable =
        globalIdx > 0 ? getKnockControlDisplayNumber(stableOrderTeams[globalIdx - 1].id) + 1 : 1;

      return (
        <div key={team.id} style={ns.knockRow}>
          <div style={ns.knockTeamNum}>
            <span style={ns.knockTeamNumLabel}>Team #</span>
            <input
              type="number"
              inputMode="numeric"
              aria-label={`Team number for ${team.team}`}
              title="Slot number stays the same in Alive and Eliminated · rows below auto-adjust in full roster order"
              min={minSelectable}
              max={99999}
              value={rowNumVal}
              onChange={(e) => commitKnockRowNumberFromIndex(globalIdx, e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "4px 4px",
                fontSize: 13,
                fontWeight: 900,
                textAlign: "center",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.14)",
                background: "rgba(0,0,0,.32)",
                color: "#e8eef5",
              }}
            />
          </div>
          <div style={ns.knockTeam}>
            <div
              style={{
                width: 32,
                height: 32,
                fontSize: 11,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                background: "rgba(255,255,255,.06)",
                color: "#fff",
                ...(team.logo
                  ? {
                      backgroundImage: `url(${teamLogoUrl(team.logo)})`,
                      backgroundSize: "cover",
                      color: "transparent",
                    }
                  : {}),
              }}
            >
              {team.logo ? "" : String(team.team || "??").slice(0, 2)}
            </div>
            <span style={{ fontWeight: 800, fontSize: 15 }}>
              {team.team}
              {team.groupName ? (
                <span style={{ marginLeft: 6, fontSize: 11, color: "#8891a1", fontWeight: 700 }}>
                  {team.slotLabel || team.groupName}
                </span>
              ) : null}
            </span>
          </div>
          <div style={ns.aliveBars}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  ...ns.aliveBar,
                  background: i < alive ? "#5CFF72" : statusLc === "knocked" ? "#FF6B45" : "#3a3f48",
                }}
              />
            ))}
            <span style={{ color: "#8CB7BE", fontSize: 12, marginLeft: 6 }}>{alive}/4</span>
          </div>
          <div style={ns.knockFinishPts} aria-label="Finish points (kills)">
            <span style={ns.knockFinishPtsLabel}>Finishes</span>
            <div style={ns.knockFinishPtsCtl}>
              <button
                type="button"
                style={ns.knockFinishArrowBtn}
                title="Raise finish points"
                aria-label="Increase finishes"
                onClick={() => void adjustTeamFinishes(team, 1)}
              >
                ▲
              </button>
              <span style={ns.knockFinishPtsValue}>{Number(team.finishes) || 0}</span>
              <button
                type="button"
                style={ns.knockFinishArrowBtn}
                title="Lower finish points"
                aria-label="Decrease finishes"
                onClick={() => void adjustTeamFinishes(team, -1)}
              >
                ▼
              </button>
            </div>
          </div>
          <div style={ns.knockBtns}>
            <button style={ns.knockBtn} disabled={isOut} onClick={() => setAlive(team.id, 3)} title="1 Knocked">
              1K
            </button>
            <button style={ns.knockBtn} disabled={isOut} onClick={() => setAlive(team.id, 2)} title="2 Knocked">
              2K
            </button>
            <button style={ns.knockBtn} disabled={isOut} onClick={() => setAlive(team.id, 1)} title="3 Knocked">
              3K
            </button>
            <button
              style={{ ...ns.knockBtn, ...ns.knockBtnDanger }}
              disabled={isOut}
              onClick={() => knockTeam(team.id, 4, true)}
              title="Full Eliminated"
            >
              OUT
            </button>
            {canRestoreOut ? (
              <button
                type="button"
                style={{ ...ns.knockBtn, ...ns.knockBtnRestore }}
                title="Undo mistaken OUT — squad returns 4/4 alive"
                onClick={() => void restoreEliminatedTeam(team)}
              >
                Restore
              </button>
            ) : null}
            {isOut && team.eliminationRank ? <span style={ns.rankBadge}>#{team.eliminationRank}</span> : null}
          </div>
        </div>
      );
    },
    [
      adjustTeamFinishes,
      commitKnockRowNumberFromIndex,
      getKnockControlDisplayNumber,
      knockTeam,
      restoreEliminatedTeam,
      scoresEditable,
      setAlive,
      stableOrderTeams,
    ],
  );

  return (
    <>
      {subtitle ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#8891a1", fontWeight: 600, maxWidth: 820, lineHeight: 1.45 }}>
          {subtitle}
        </p>
      ) : null}
      {showFinishBadgesButton && finishBadgesObsUrl ? (
        <button
          type="button"
          style={{ ...ns.matchBtn, marginTop: 8 }}
          onClick={() => window.open(finishBadgesObsUrl, "_blank", "width=520,height=960")}
        >
          Open finish badges overlay
        </button>
      ) : null}
      <div style={{ ...ns.knockSections, marginTop: 12 }}>
        <div style={ns.knockSectionBlock}>
          <div style={ns.knockSectionHeadAlive}>
            <span>Alive</span>
            <span style={ns.knockSectionCount}>{knockAliveTeams.length}</span>
          </div>
          <div style={ns.knockGrid}>
            {knockAliveTeams.length ? (
              knockAliveTeams.map((team) => renderKnockControlRow(team))
            ) : (
              <p style={ns.knockSectionEmpty}>{emptyAliveMessage}</p>
            )}
          </div>
        </div>
        <div style={ns.knockSectionBlock}>
          <div style={ns.knockSectionHeadElim}>
            <span>Eliminated</span>
            <span style={ns.knockSectionCount}>{knockEliminatedTeams.length}</span>
          </div>
          <div style={{ ...ns.knockGrid, ...ns.knockGridElim }}>
            {knockEliminatedTeams.length ? (
              knockEliminatedTeams.map((team) => renderKnockControlRow(team))
            ) : (
              <p style={ns.knockSectionEmpty}>{emptyElimMessage}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
