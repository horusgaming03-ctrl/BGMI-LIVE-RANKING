import { Fragment, useCallback, useMemo, useState } from "react";
import { getRondoRecallChargesRemaining, RONDO_RECALL_CHARGE_CAP } from "./recallCharges.js";
import RondoPlayerChoiceModal from "./RondoPlayerChoiceModal.jsx";
import AliveIndicator from "../overlay-engine/alive-styles/AliveIndicator.jsx";

/** Admin recall bolts — white on dark row (faded slots when used). */
const RKM_RECALL_THEME = {
  alive: { size: 8, color: "#f8fafc", deadColor: "#64748b", gap: 2 },
};

/**
 * BGMI-grade Rondo-only knock + recall desk (admin).
 * Mirrors server states: combat → bench → staged redeploy; up to four per-player recalls per squad.
 */

const RONDO_CYAN = "#22d3ee";
const RONDO_VIOLET = "#c084fc";
const EDGE = "rgba(34,211,238,.38)";

function RkmRecallBolts({ credits, compact = false }) {
  const c = Math.max(0, Math.min(RONDO_RECALL_CHARGE_CAP, Number(credits) || 0));
  return (
    <div className={`rkm-recall-bolts${compact ? " rkm-recall-bolts--compact" : ""}`} aria-label={`${c} of ${RONDO_RECALL_CHARGE_CAP} recalls left`}>
      <AliveIndicator count={c} theme={RKM_RECALL_THEME} styleId="bolt" layout="line" tightCluster />
    </div>
  );
}

/** @typedef {{ id: number, team: string, logo?: string|null, status?: string, alivePlayers?: number, finishes?: number, eliminationRank?: number|null, rondoRecallConsumed?: boolean, rondoRecallChargesRemaining?: number, rondoAwaitingRecall?: boolean }} Team */

function rondoPhaseKey(team) {
  const st = String(team.status || "").toLowerCase();
  const charges = getRondoRecallChargesRemaining(team);
  const noCharges = charges <= 0;
  const ap = Math.max(0, Math.min(4, Number(team.alivePlayers ?? 4) || 0));
  if (st === "eliminated" && noCharges) return "final";
  if (st === "eliminated") return "eliminated_plain";
  if (st === "rondo_benched") return charges > 0 ? "recall_available" : "eliminated_plain";
  if (
    charges > 0 &&
    st !== "eliminated" &&
    ap >= 1 &&
    ap <= 3 &&
    (st === "alive" || st === "knocked")
  )
    return "partial_recall_available";
  if ((st === "alive" || st === "knocked") && ap === 4 && noCharges) return "recall_exhausted";
  if (st === "knocked" && noCharges) return "knocked_no_recall";
  if (st === "knocked") return "knocked";
  return "alive";
}

function phaseLabels(phase) {
  switch (phase) {
    case "alive":
      return {
        headline: "ALIVE",
        sub: `Squad has ${RONDO_RECALL_CHARGE_CAP} per-player redeploy credits. First wipe with credits left sends you to recall bench.`,
      };
    case "knocked":
      return { headline: "KNOCKED", sub: "Damage state — finish knock ladder or force full wipe to bench (when credits remain)." };
    case "recall_available":
      return {
        headline: "RECALL AVAILABLE",
        sub: `Bench deploy — spend 1 credit per recalled player (${RONDO_RECALL_CHARGE_CAP} max per squad each match).`,
      };
    case "partial_recall_available":
      return {
        headline: "RECALL READY (PARTIAL DOWN)",
        sub: `Each ⚡ Recall +N spends N credits (${RONDO_RECALL_CHARGE_CAP} total). Teammates who have not needed recall still keep their credits.`,
      };
    case "knocked_no_recall":
      return {
        headline: "KNOCKED · NO CREDITS",
        sub: "All squad recall credits spent — clears or wipes will eliminate (no redeploy unless rules override).",
      };
    case "recall_exhausted":
      return {
        headline: "FULL SQUAD · NO CREDITS LEFT",
        sub: "Every per-player redeploy has been spent. Next bench or full wipe eliminates for placement.",
      };
    case "final":
      return { headline: "FINAL ELIMINATION", sub: "Recall spent or rules final — placement locked for broadcast." };
    case "eliminated_plain":
      return { headline: "ELIMINATED", sub: "Out of match (non-recall path or data edge)." };
    default:
      return { headline: "—", sub: "" };
  }
}

function PhaseRail({ phase }) {
  const steps = [{ label: "Combat" }, { label: "Recall gate" }, { label: "Recalled" }, { label: "Final" }];

  let activeIdx = 0;
  if (phase === "alive") activeIdx = 0;
  else if (phase === "partial_recall_available" || phase === "recall_available") activeIdx = 1;
  else if (phase === "recall_exhausted") activeIdx = 2;
  else if (phase === "knocked" || phase === "knocked_no_recall") activeIdx = 0;
  else activeIdx = 3;

  return (
    <div className="rkm-rail" aria-hidden>
      {steps.map((s, i) => (
        <Fragment key={s.label}>
          {i > 0 ? <div className={`rkm-rail__line ${i <= activeIdx ? "rkm-rail__line--on" : ""}`} /> : null}
          <div
            className={`rkm-rail__step ${i <= activeIdx ? "rkm-rail__step--on" : ""} ${i === activeIdx ? "rkm-rail__step--current" : ""}`}
          >
            <div className="rkm-rail__dot" />
            <span>{s.label}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   teams: Team[],
 *   apiBase: string,
 *   teamLogoStyle: object,
 *   styles: { teamLogo: object },
 *   ns: Record<string, object>,
 *   knockTeam: (id: number, knockCount: number, full?: boolean) => void,
 *   setAlive: (id: number, n: number) => void | Promise<void>,
 *   spendRondoRecall: (id: number, count?: number) => void | Promise<unknown>,
 *   adjustTeamFinishes: (team: Team, d: number) => void,
 *   triggerRondoRecall: (id: number, addAliveSlots?: number) => void,
 *   undoRondoMistakenBench: (id: number) => void,
 *   finalizeBenchedElimination: (team: Team) => void,
 *   finishBadgesObsUrl: string,
 *   getKnockControlDisplayNumber?: (teamId: number, idx: number) => number,
 *   commitKnockRowNumberFromIndex?: (idx: number, raw: unknown) => void,
 *   restoreEliminatedTeam?: (team: Team) => void | Promise<void>,
 *   matchScoresEditable?: boolean,
 * }} props
 */
export default function RondoKnockMatrix({
  teams,
  apiBase,
  teamLogoStyle,
  styles,
  ns,
  knockTeam,
  setAlive,
  spendRondoRecall,
  adjustTeamFinishes,
  triggerRondoRecall,
  undoRondoMistakenBench,
  finalizeBenchedElimination,
  finishBadgesObsUrl,
  getKnockControlDisplayNumber,
  commitKnockRowNumberFromIndex,
  restoreEliminatedTeam,
  matchScoresEditable = true,
}) {
  const sorted = teams;
  const showTeamNumbers =
    typeof getKnockControlDisplayNumber === "function" && typeof commitKnockRowNumberFromIndex === "function";

  const aliveTeams = useMemo(
    () => sorted.filter((t) => String(t.status || "").toLowerCase() !== "eliminated"),
    [sorted],
  );
  const eliminatedTeams = useMemo(
    () => sorted.filter((t) => String(t.status || "").toLowerCase() === "eliminated"),
    [sorted],
  );

  const rowAliveCount = useCallback((team) => {
    const st = String(team?.status || "").toLowerCase();
    if (st === "eliminated" || st === "rondo_benched") {
      return Math.max(0, Math.min(4, Number(team.alivePlayers) || 0));
    }
    const n = Number(team.alivePlayers);
    if (st === "alive") return Math.max(1, Math.min(4, Number.isFinite(n) ? n : 4));
    return Math.max(0, Math.min(4, Number.isFinite(n) ? n : 4));
  }, []);

  const [choiceModal, setChoiceModal] = useState(null);

  const requestAliveChange = useCallback(
    (team, targetAlive) => {
      const current = Math.max(0, Math.min(4, Number(team.alivePlayers ?? 4)));
      const target = Math.max(0, Math.min(4, Number(targetAlive)));
      const down = current - target;
      if (down <= 0) {
        void setAlive(team.id, target);
        return;
      }
      const credits = getRondoRecallChargesRemaining(team);
      if (credits <= 0) {
        void setAlive(team.id, target);
        return;
      }
      setChoiceModal({
        team,
        currentAlive: current,
        targetAlive: target,
        playersDown: down,
        credits,
      });
    },
    [setAlive],
  );

  const closeChoiceModal = useCallback(() => setChoiceModal(null), []);

  const handleModalEliminate = useCallback(() => {
    if (!choiceModal) return;
    const { team, targetAlive } = choiceModal;
    closeChoiceModal();
    void setAlive(team.id, targetAlive);
  }, [choiceModal, closeChoiceModal, setAlive]);

  const handleModalRecall = useCallback(
    (count) => {
      if (!choiceModal) return;
      const { team } = choiceModal;
      closeChoiceModal();
      void spendRondoRecall(team.id, count);
    },
    [choiceModal, closeChoiceModal, spendRondoRecall],
  );

  const renderTeamNumberCell = useCallback(
    (team, globalIdx, minSelectable, rowNumVal) =>
      showTeamNumbers ? (
        <div className="rkm-row__teamnum" style={ns.knockTeamNum}>
          <span style={ns.knockTeamNumLabel}>Team #</span>
          <input
            type="number"
            inputMode="numeric"
            aria-label={`Team number for ${team.team}`}
            title="Teams below adjust automatically · must stay above row above · no duplicates"
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
      ) : null,
    [showTeamNumbers, ns.knockTeamNum, ns.knockTeamNumLabel, commitKnockRowNumberFromIndex],
  );

  const renderEliminatedRow = useCallback(
    (team) => {
      const globalIdx = sorted.findIndex((t) => t.id === team.id);
      const alive = rowAliveCount(team);
      const rowNumVal = showTeamNumbers ? getKnockControlDisplayNumber(team.id, globalIdx) : 0;
      const minSelectable =
        showTeamNumbers && globalIdx > 0 ? getKnockControlDisplayNumber(sorted[globalIdx - 1].id) + 1 : 1;
      const canRestore = matchScoresEditable && typeof restoreEliminatedTeam === "function";

      return (
        <div key={team.id} style={{ ...ns.knockRow, ...ns.knockGridElim }}>
          {renderTeamNumberCell(team, globalIdx, minSelectable, rowNumVal)}
          <div style={ns.knockTeam}>
            <div
              style={{
                ...styles.teamLogo,
                width: 32,
                height: 32,
                fontSize: 11,
                borderRadius: 8,
                ...(team.logo ? { backgroundImage: `url(${apiBase}${team.logo})`, backgroundSize: "cover", color: "transparent" } : {}),
              }}
            >
              {team.logo ? "" : String(team.team || "").slice(0, 2)}
            </div>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{team.team}</span>
          </div>
          <div style={ns.aliveBars}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ ...ns.aliveBar, background: i < alive ? "#5CFF72" : "#3a3f48", opacity: 0.55 }} />
            ))}
            <span style={{ color: "#8CB7BE", fontSize: 12, marginLeft: 6 }}>{alive}/4</span>
          </div>
          <div style={ns.knockFinishPts} aria-label="Finishes">
            <span style={ns.knockFinishPtsLabel}>Finishes</span>
            <div style={ns.knockFinishPtsCtl}>
              <button type="button" style={ns.knockFinishArrowBtn} onClick={() => void adjustTeamFinishes(team, 1)} aria-label="Increase finishes">
                ▲
              </button>
              <span style={ns.knockFinishPtsValue}>{Number(team.finishes) || 0}</span>
              <button type="button" style={ns.knockFinishArrowBtn} onClick={() => void adjustTeamFinishes(team, -1)} aria-label="Decrease finishes">
                ▼
              </button>
            </div>
          </div>
          <div style={ns.knockBtns}>
            {canRestore ? (
              <button
                type="button"
                style={{ ...ns.knockBtn, ...ns.knockBtnRestore }}
                title="Restore — 4/4 alive, alive bars only (no recall strip)"
                onClick={() => void restoreEliminatedTeam(team)}
              >
                Restore
              </button>
            ) : null}
            {team.eliminationRank != null ? <span style={ns.rankBadge}>#{team.eliminationRank}</span> : null}
          </div>
        </div>
      );
    },
    [
      sorted,
      rowAliveCount,
      showTeamNumbers,
      getKnockControlDisplayNumber,
      matchScoresEditable,
      restoreEliminatedTeam,
      renderTeamNumberCell,
      ns,
      styles.teamLogo,
      apiBase,
      adjustTeamFinishes,
    ],
  );

  const renderSimpleAliveRow = useCallback(
    (team, idx) => {
      const globalIdx = sorted.findIndex((t) => t.id === team.id);
      const alive = rowAliveCount(team);
      const statusLc = String(team.status || "").toLowerCase();
      const rowNumVal = showTeamNumbers ? getKnockControlDisplayNumber(team.id, globalIdx) : 0;
      const minSelectable =
        showTeamNumbers && globalIdx > 0 ? getKnockControlDisplayNumber(sorted[globalIdx - 1].id) + 1 : 1;

      return (
        <div key={team.id} style={{ ...ns.knockRow, opacity: 0.98 }}>
          {renderTeamNumberCell(team, globalIdx, minSelectable, rowNumVal)}
          <div style={ns.knockTeam}>
            <div
              style={{
                ...styles.teamLogo,
                width: 32,
                height: 32,
                fontSize: 11,
                borderRadius: 8,
                ...(team.logo ? { backgroundImage: `url(${apiBase}${team.logo})`, backgroundSize: "cover", color: "transparent" } : {}),
              }}
            >
              {team.logo ? "" : String(team.team || "").slice(0, 2)}
            </div>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{team.team}</span>
            <span className="rkm-pill rkm-pill--muted" style={{ marginLeft: 8 }}>
              RESTORED · ALIVE ONLY
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
          <div style={ns.knockFinishPts} aria-label="Finishes">
            <span style={ns.knockFinishPtsLabel}>Finishes</span>
            <div style={ns.knockFinishPtsCtl}>
              <button type="button" style={ns.knockFinishArrowBtn} onClick={() => void adjustTeamFinishes(team, 1)} aria-label="Increase finishes">
                ▲
              </button>
              <span style={ns.knockFinishPtsValue}>{Number(team.finishes) || 0}</span>
              <button type="button" style={ns.knockFinishArrowBtn} onClick={() => void adjustTeamFinishes(team, -1)} aria-label="Decrease finishes">
                ▼
              </button>
            </div>
          </div>
          <div style={ns.knockBtns}>
            <button type="button" style={ns.knockBtn} onClick={() => void setAlive(team.id, 3)} title="1 Knocked">
              1K
            </button>
            <button type="button" style={ns.knockBtn} onClick={() => void setAlive(team.id, 2)} title="2 Knocked">
              2K
            </button>
            <button type="button" style={ns.knockBtn} onClick={() => void setAlive(team.id, 1)} title="3 Knocked">
              3K
            </button>
            <button type="button" style={{ ...ns.knockBtn, ...ns.knockBtnDanger }} onClick={() => void knockTeam(team.id, 4, true)} title="Full Eliminated">
              OUT
            </button>
          </div>
        </div>
      );
    },
    [
      sorted,
      rowAliveCount,
      showTeamNumbers,
      getKnockControlDisplayNumber,
      renderTeamNumberCell,
      ns,
      styles.teamLogo,
      apiBase,
      adjustTeamFinishes,
      setAlive,
      knockTeam,
    ],
  );

  const renderFullRondoRow = useCallback(
    (team) => {
          const alive = team.alivePlayers ?? 4;
          const st = String(team.status || "").toLowerCase();
          const isBenched = st === "rondo_benched";
          const credits = getRondoRecallChargesRemaining(team);
          const consumed = credits <= 0;
          const phase = rondoPhaseKey(team);
          const { headline, sub } = phaseLabels(phase);

          const rowClass = ["rkm-row"];
          if (isBenched) rowClass.push("rkm-row--bench");
          if (phase === "partial_recall_available") rowClass.push("rkm-row--partial");
          if (phase === "final") rowClass.push("rkm-row--final");
          if (phase === "recall_exhausted") rowClass.push("rkm-row--recalled");

          const partialRecallEligible = phase === "partial_recall_available";

          const headColor =
            phase === "recall_available" || phase === "partial_recall_available"
              ? RONDO_CYAN
              : phase === "knocked" || phase === "knocked_no_recall"
                ? "#FF9A6B"
                : phase === "recall_exhausted"
                  ? "#e9d5ff"
                  : phase === "final"
                    ? "#fecaca"
                    : phase === "eliminated_plain"
                      ? "#94a3b8"
                      : "#5cff72";

          const globalIdx = sorted.findIndex((t) => t.id === team.id);
          const rowNumVal = showTeamNumbers ? getKnockControlDisplayNumber(team.id, globalIdx) : 0;
          const minSelectable =
            showTeamNumbers && globalIdx > 0 ? getKnockControlDisplayNumber(sorted[globalIdx - 1].id) + 1 : 1;

          return (
            <div key={team.id} className={`${rowClass.join(" ")}${showTeamNumbers ? " rkm-row--numbers" : ""}`} data-phase={phase}>
              {renderTeamNumberCell(team, globalIdx, minSelectable, rowNumVal)}
              <div className="rkm-row__recall">
                <span className="rkm-recall-side__label">RECALL</span>
                <RkmRecallBolts credits={credits} compact />
              </div>

              <div className="rkm-row__identity">
                <div style={{ ...styles.teamLogo, ...teamLogoStyle, width: 44, height: 44, fontSize: 13, borderRadius: 12, ...(team.logo ? { backgroundImage: `url(${apiBase}${team.logo})`, backgroundSize: "cover", color: "transparent" } : {}) }}>
                  {team.logo ? "" : String(team.team || "").slice(0, 2)}
                </div>
                <div className="rkm-row__idtext">
                  <span className="rkm-row__name">{team.team}</span>
                  <span className={`rkm-pill ${consumed ? "rkm-pill--used" : credits < RONDO_RECALL_CHARGE_CAP ? "rkm-pill--hot" : "rkm-pill--muted"}`}>
                    {consumed ? "NO CREDITS" : `${credits}/${RONDO_RECALL_CHARGE_CAP} CREDITS`}
                  </span>
                  {phase === "recall_available" ? <span className="rkm-pill rkm-pill--hot">BENCH · RECALL GATE</span> : null}
                  {partialRecallEligible ? <span className="rkm-pill rkm-pill--hot">{`${4 - alive} DOWN · SQUAD RECALL`}</span> : null}
                  {phase === "final" ? <span className="rkm-pill rkm-pill--final">NO SECOND RECALL</span> : null}
                </div>
              </div>

              <div className="rkm-row__status">
                <div className="rkm-row__headline" style={{ color: headColor }}>
                  {headline}
                </div>
                <div className="rkm-row__sub">{sub}</div>
                <PhaseRail phase={phase} />
              </div>

              <div className="rkm-row__meters">
                <div className="rkm-overlay-meters" aria-label="Recall and alive — same as OBS overlay">
                  <div className="rkm-overlay-meter">
                    <span className="rkm-overlay-meter__label">RECALL</span>
                    <RkmRecallBolts credits={credits} />
                  </div>
                  <div className="rkm-overlay-meter">
                    <span className="rkm-overlay-meter__label">ALIVE</span>
                    <div className="rkm-bars" aria-label="Players up">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="rkm-bar"
                          data-hot={i < alive ? "1" : "0"}
                          style={{
                            background: i < alive ? "#5CFF72" : isBenched ? "#2d3540" : st === "knocked" ? "#FF6B45" : "#252a32",
                            opacity: isBenched ? 0.65 : 1,
                          }}
                        />
                      ))}
                      <span className="rkm-bars__label">
                        {isBenched ? "0" : alive}/4
                      </span>
                    </div>
                  </div>
                </div>
                <div style={ns.knockFinishPts} aria-label="Finishes">
                  <span style={ns.knockFinishPtsLabel}>Finishes</span>
                  <div style={ns.knockFinishPtsCtl}>
                    <button type="button" style={ns.knockFinishArrowBtn} onClick={() => void adjustTeamFinishes(team, 1)} aria-label="Plus finish">
                      ▲
                    </button>
                    <span style={ns.knockFinishPtsValue}>{Number(team.finishes) || 0}</span>
                    <button type="button" style={ns.knockFinishArrowBtn} onClick={() => void adjustTeamFinishes(team, -1)} aria-label="Minus finish">
                      ▼
                    </button>
                  </div>
                </div>
              </div>

              <div className="rkm-row__actions">
                {isBenched ? (
                  <div className="rkm-actions-stack">
                    <button type="button" className="rkm-btn-recall" onClick={() => void triggerRondoRecall(team.id)}>
                      ⚡ Bench redeploy · up to {Math.min(4, credits)}/4 ({Math.min(4, credits)} credit{Math.min(4, credits) === 1 ? "" : "s"})
                    </button>
                    <button
                      type="button"
                      className="rkm-btn-undo"
                      onClick={() => {
                        if (
                          window.confirm(
                            `${team.team}: undo mistaken OUT?\nReturns squad from recall bench to 4/4 alive. Recall credits unchanged.`,
                          )
                        ) {
                          void undoRondoMistakenBench(team.id);
                        }
                      }}
                    >
                      ↩ Undo mistaken OUT
                    </button>
                    <button
                      type="button"
                      className="rkm-btn-skip"
                      onClick={() => {
                        if (window.confirm(`${team.team}: force FINAL elimination from bench (skip recall)?`)) {
                          void finalizeBenchedElimination(team);
                        }
                      }}
                    >
                      Rules override · final OUT
                    </button>
                  </div>
                ) : (
                  <div className="rkm-combat-actions">
                    <div style={{ ...ns.knockBtns, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button type="button" style={ns.knockBtn} onClick={() => requestAliveChange(team, 3)} title="1 player down — recall popup if credits remain">
                        1K
                      </button>
                      <button type="button" style={ns.knockBtn} onClick={() => requestAliveChange(team, 2)} title="2 players down — recall popup if credits remain">
                        2K
                      </button>
                      <button type="button" style={ns.knockBtn} onClick={() => requestAliveChange(team, 1)} title="3 players down — recall popup if credits remain">
                        3K
                      </button>
                      <button
                        type="button"
                        style={{ ...ns.knockBtn, ...ns.knockBtnDanger }}
                        onClick={() => {
                          if (credits > 0 && alive > 0) requestAliveChange(team, 0);
                          else void knockTeam(team.id, 4, true);
                        }}
                        title="Full squad down — recall popup if credits remain"
                      >
                        OUT
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
    },
    [
      sorted,
      knockTeam,
      adjustTeamFinishes,
      triggerRondoRecall,
      undoRondoMistakenBench,
      finalizeBenchedElimination,
      showTeamNumbers,
      getKnockControlDisplayNumber,
      renderTeamNumberCell,
      requestAliveChange,
      ns,
      styles,
      apiBase,
      teamLogoStyle,
    ],
  );

  return (
    <div className="rkm-root">
      <div className="rkm-hero">
        <div className="rkm-hero__glow" />
        <div className="rkm-hero__row">
          <div className="rkm-hero__live">● PRODUCTION</div>
          <div className="rkm-hero__map">MAP LOCK · RONDO</div>
          <div className="rkm-hero__chip">RECALL RULESET</div>
        </div>
        <p className="rkm-hero__rule">
          Same <strong>Alive</strong> / <strong>Eliminated</strong> layout as Erangel &amp; Miramar. Recall rules apply in <strong>Alive</strong> only.{" "}
          <strong>Restore</strong> on eliminated squads returns 4/4 with <strong>alive bars only</strong> (no recall strip). Bench squads use recall redeploy below.
        </p>
        <div className="rkm-hero__obs">
          <span className="rkm-hero__obsLabel">OBS strip</span>
          <code className="rkm-hero__code">/overlay/rondo/finish-badges</code>
          <button type="button" className="rkm-hero__open" onClick={() => window.open(finishBadgesObsUrl, "_blank", "width=540,height=980")}>
            Launch overlay
          </button>
        </div>
      </div>

      <div style={ns.knockSections}>
        <div style={ns.knockSectionBlock}>
          <div style={ns.knockSectionHeadAlive}>
            <span>Alive</span>
            <span style={ns.knockSectionCount}>{aliveTeams.length}</span>
          </div>
          <div style={ns.knockGrid}>
            {aliveTeams.length ? (
              aliveTeams.map((team, idx) =>
                team.rondoKnockAliveOnly === true ? renderSimpleAliveRow(team, idx) : renderFullRondoRow(team),
              )
            ) : (
              <p style={ns.knockSectionEmpty}>No squads still in the match.</p>
            )}
          </div>
        </div>
        <div style={ns.knockSectionBlock}>
          <div style={ns.knockSectionHeadElim}>
            <span>Eliminated</span>
            <span style={ns.knockSectionCount}>{eliminatedTeams.length}</span>
          </div>
          <div style={{ ...ns.knockGrid, ...ns.knockGridElim }}>
            {eliminatedTeams.length ? (
              eliminatedTeams.map((team) => renderEliminatedRow(team))
            ) : (
              <p style={ns.knockSectionEmpty}>No eliminated squads yet — final OUT moves a team here (slot # unchanged).</p>
            )}
          </div>
        </div>
      </div>

      {choiceModal ? (
        <RondoPlayerChoiceModal
          team={choiceModal.team}
          currentAlive={choiceModal.currentAlive}
          targetAlive={choiceModal.targetAlive}
          playersDown={choiceModal.playersDown}
          credits={choiceModal.credits}
          onEliminate={handleModalEliminate}
          onRecall={handleModalRecall}
          onClose={closeChoiceModal}
        />
      ) : null}

      <style>{`
        .rkm-root {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .rkm-hero {
          position: relative;
          border-radius: 20px;
          padding: 18px 20px 16px;
          border: 1px solid ${EDGE};
          background: linear-gradient(135deg, rgba(8, 22, 36, 0.95), rgba(16, 8, 32, 0.92));
          overflow: hidden;
        }
        .rkm-hero__glow {
          position: absolute;
          inset: -40% -20% auto -20%;
          height: 120%;
          background: radial-gradient(ellipse at 50% 0%, rgba(34, 211, 238, 0.15), transparent 55%),
            radial-gradient(ellipse at 80% 20%, rgba(192, 132, 252, 0.12), transparent 50%);
          pointer-events: none;
        }
        .rkm-hero__row {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .rkm-hero__live {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.2em;
          color: #5cff72;
          text-shadow: 0 0 14px rgba(92, 255, 114, 0.45);
        }
        .rkm-hero__map {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.18em;
          color: #e0f7ff;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(34, 211, 238, 0.35);
          background: rgba(34, 211, 238, 0.08);
        }
        .rkm-hero__chip {
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.14em;
          color: ${RONDO_VIOLET};
          opacity: 0.95;
        }
        .rkm-hero__rule {
          position: relative;
          margin: 0 0 12px;
          font-size: 12px;
          line-height: 1.55;
          color: #9eb0c4;
          font-weight: 600;
          max-width: 920px;
        }
        .rkm-hero__rule strong {
          color: #e8f4ff;
          font-weight: 800;
        }
        .rkm-hero__obs {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }
        .rkm-hero__obsLabel {
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.16em;
          color: #6b8490;
        }
        .rkm-hero__code {
          font-size: 11px;
          color: #7eebfb;
          background: rgba(0, 0, 0, 0.35);
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid rgba(34, 211, 238, 0.22);
        }
        .rkm-hero__open {
          margin-left: auto;
          cursor: pointer;
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.06em;
          color: #041c24;
          background: linear-gradient(160deg, ${RONDO_CYAN}, #8b5cf6);
          box-shadow: 0 10px 28px rgba(34, 211, 238, 0.25);
        }
        .rkm-hero__open:hover {
          filter: brightness(1.08);
        }

        .rkm-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .rkm-row {
          display: grid;
          grid-template-columns: 72px minmax(160px, 1.1fr) minmax(200px, 1.4fr) 248px minmax(200px, 1.2fr);
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: linear-gradient(160deg, rgba(10, 28, 42, 0.55), rgba(6, 10, 22, 0.88));
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04);
          transition: border-color 0.35s ease, box-shadow 0.35s ease, transform 0.25s ease;
        }
        .rkm-row--numbers {
          grid-template-columns: 52px 72px minmax(160px, 1.1fr) minmax(200px, 1.4fr) 248px minmax(200px, 1.2fr);
        }
        .rkm-row:hover {
          border-color: rgba(34, 211, 238, 0.18);
        }
        .rkm-row--bench {
          border-color: rgba(34, 211, 238, 0.42);
          animation: rkmBenchPulse 2.4s ease-in-out infinite;
        }
        .rkm-row--partial {
          border-color: rgba(34, 211, 238, 0.3);
          animation: rkmPartialPulse 2.8s ease-in-out infinite;
        }
        .rkm-row--recalled {
          border-color: rgba(192, 132, 252, 0.35);
          box-shadow: 0 12px 40px rgba(139, 92, 246, 0.12), inset 0 0 0 1px rgba(192, 132, 252, 0.08);
        }
        .rkm-row--final {
          opacity: 0.72;
          filter: saturate(0.88);
        }

        .rkm-row__recall {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .rkm-recall-side__label {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.14em;
          color: #64748b;
        }
        .rkm-recall-bolts {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 56px;
          padding: 2px 0;
        }
        .rkm-recall-bolts--compact {
          min-width: 48px;
        }
        .rkm-recall-bolts > div {
          margin-left: 0 !important;
          margin-right: 0 !important;
          justify-self: center;
        }
        .rkm-overlay-meters {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 14px;
          width: 100%;
        }
        .rkm-overlay-meter {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }
        .rkm-overlay-meter__label {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.16em;
          color: #94a3b8;
        }
        .rkm-overlay-meter .rkm-recall-bolts {
          width: 100%;
          min-height: 28px;
        }

        .rkm-row__identity {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .rkm-row__idtext {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .rkm-row__name {
          font-weight: 900;
          font-size: 16px;
          color: #f8fafc;
          letter-spacing: 0.02em;
        }

        .rkm-pill {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.14em;
          padding: 3px 8px;
          border-radius: 6px;
          width: fit-content;
          text-transform: uppercase;
        }
        .rkm-pill--used {
          color: ${RONDO_VIOLET};
          border: 1px solid rgba(192, 132, 252, 0.45);
          background: rgba(192, 132, 252, 0.08);
        }
        .rkm-pill--hot {
          color: #042f2e;
          background: linear-gradient(90deg, ${RONDO_CYAN}, #a5f3fc);
          border: none;
          animation: rkmHotPulse 1.6s ease-in-out infinite;
        }
        .rkm-pill--final {
          color: #fecaca;
          border: 1px solid rgba(248, 113, 113, 0.45);
          background: rgba(127, 29, 29, 0.2);
        }
        .rkm-pill--muted {
          color: #94a3b8;
          border: 1px solid rgba(148, 163, 184, 0.3);
        }

        .rkm-row__status {
          min-width: 0;
        }
        .rkm-row__headline {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #5cff72;
          text-shadow: 0 0 20px rgba(92, 255, 114, 0.15);
        }
        .rkm-row__sub {
          margin-top: 6px;
          font-size: 11px;
          line-height: 1.45;
          color: #6b8490;
          font-weight: 600;
        }

        .rkm-rail {
          display: flex;
          align-items: center;
          margin-top: 10px;
          flex-wrap: wrap;
          gap: 0;
        }
        .rkm-rail__line {
          width: 20px;
          height: 3px;
          border-radius: 2px;
          background: #2a3340;
          margin: 0 2px;
          flex-shrink: 0;
        }
        .rkm-rail__line--on {
          background: linear-gradient(90deg, rgba(34, 211, 238, 0.75), rgba(192, 132, 252, 0.65));
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.25);
        }
        .rkm-rail__step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          min-width: 56px;
        }
        .rkm-rail__step span {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
          text-align: center;
          line-height: 1.15;
        }
        .rkm-rail__step--on span {
          color: #b8c8d9;
        }
        .rkm-rail__step--current span {
          color: #f1f5f9;
        }
        .rkm-rail__dot {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #2a3340;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .rkm-rail__step--on .rkm-rail__dot {
          background: linear-gradient(135deg, ${RONDO_CYAN}, ${RONDO_VIOLET});
          border-color: rgba(255, 255, 255, 0.22);
          box-shadow: 0 0 12px rgba(34, 211, 238, 0.35);
        }
        .rkm-rail__step--current .rkm-rail__dot {
          transform: scale(1.18);
        }

        .rkm-row__meters {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .rkm-bars {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .rkm-bar {
          width: 9px;
          height: 30px;
          border-radius: 3px;
          transition: background 0.3s ease, opacity 0.3s ease;
        }
        .rkm-bars__label {
          margin-left: 8px;
          font-size: 12px;
          font-weight: 800;
          color: #8cb7be;
          font-variant-numeric: tabular-nums;
        }

        .rkm-row__actions {
          display: flex;
          justify-content: flex-end;
          min-width: 0;
        }
        .rkm-combat-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          width: 100%;
        }
        .rkm-actions-stack {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: stretch;
          width: 100%;
          max-width: 260px;
        }
        .rkm-btn-recall {
          border: none;
          border-radius: 12px;
          padding: 12px 14px;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.04em;
          cursor: pointer;
          color: #fff;
          background: linear-gradient(155deg, #0ea5e9, #7c3aed);
          box-shadow: 0 12px 32px rgba(14, 165, 233, 0.35);
        }
        .rkm-btn-recall:hover {
          filter: brightness(1.06);
        }
        .rkm-btn-recall--combat {
          width: 100%;
          max-width: 280px;
          padding: 10px 12px;
          font-size: 11px;
        }
        .rkm-recall-increment {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
          width: 100%;
        }
        .rkm-btn-recall--step {
          padding: 10px 12px;
          font-size: 10px;
          letter-spacing: 0.03em;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(14, 165, 233, 0.28);
          flex: 0 1 auto;
        }
        .rkm-btn-undo {
          border-radius: 10px;
          padding: 8px 10px;
          font-weight: 800;
          font-size: 10px;
          cursor: pointer;
          color: #fef3c7;
          background: rgba(245, 158, 11, 0.14);
          border: 1px solid rgba(251, 191, 36, 0.5);
        }
        .rkm-btn-undo:hover {
          filter: brightness(1.08);
        }
        .rkm-btn-skip {
          border-radius: 10px;
          padding: 8px 10px;
          font-weight: 800;
          font-size: 10px;
          cursor: pointer;
          color: #fecdd3;
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.4);
        }

        @keyframes rkmBenchPulse {
          0%,
          100% {
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35), 0 0 0 rgba(34, 211, 238, 0);
          }
          50% {
            box-shadow: 0 16px 52px rgba(0, 0, 0, 0.38), 0 0 28px rgba(34, 211, 238, 0.22);
          }
        }
        @keyframes rkmPartialPulse {
          0%,
          100% {
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.32), 0 0 0 rgba(34, 211, 238, 0);
          }
          50% {
            box-shadow: 0 14px 44px rgba(0, 0, 0, 0.34), 0 0 20px rgba(34, 211, 238, 0.16);
          }
        }
        @keyframes rkmHotPulse {
          0%,
          100% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.12);
          }
        }
        @media (max-width: 1180px) {
          .rkm-row:not(.rkm-row--numbers) {
            grid-template-columns: 48px 1fr;
            grid-template-rows: auto auto auto auto;
          }
          .rkm-row:not(.rkm-row--numbers) .rkm-row__recall {
            grid-row: 1 / span 2;
          }
          .rkm-row:not(.rkm-row--numbers) .rkm-row__identity {
            grid-column: 2;
          }
          .rkm-row:not(.rkm-row--numbers) .rkm-row__status {
            grid-column: 1 / -1;
          }
          .rkm-row:not(.rkm-row--numbers) .rkm-row__meters {
            grid-column: 1 / -1;
            flex-direction: row;
            justify-content: space-between;
            width: 100%;
          }
          .rkm-row:not(.rkm-row--numbers) .rkm-row__actions {
            grid-column: 1 / -1;
            justify-content: stretch;
          }

          .rkm-row--numbers {
            grid-template-columns: 44px 48px 1fr;
            grid-template-rows: auto auto auto auto;
          }
          .rkm-row--numbers .rkm-row__teamnum {
            grid-column: 1;
            grid-row: 1;
            align-self: start;
          }
          .rkm-row--numbers .rkm-row__recall {
            grid-column: 2;
            grid-row: 1 / span 2;
          }
          .rkm-row--numbers .rkm-row__identity {
            grid-column: 3;
            grid-row: 1;
          }
          .rkm-row--numbers .rkm-row__status {
            grid-column: 1 / -1;
          }
          .rkm-row--numbers .rkm-row__meters {
            grid-column: 1 / -1;
            flex-direction: row;
            justify-content: space-between;
            width: 100%;
          }
          .rkm-row--numbers .rkm-row__actions {
            grid-column: 1 / -1;
            justify-content: stretch;
          }

          .rkm-actions-stack {
            max-width: none;
          }
          .rkm-recall-increment {
            justify-content: stretch;
          }
          .rkm-btn-recall--step {
            flex: 1 1 42%;
            min-width: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rkm-row--bench,
          .rkm-row--partial,
          .rkm-pill--hot,
        }
      `}</style>
    </div>
  );
}
