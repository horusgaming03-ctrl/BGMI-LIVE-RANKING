import { Fragment } from "react";
import { getRondoRecallChargesRemaining, RONDO_RECALL_CHARGE_CAP } from "./recallCharges.js";

/**
 * BGMI-grade Rondo-only knock + recall desk (admin).
 * Mirrors server states: combat → bench → staged redeploy; up to four per-player recalls per squad.
 */

const RONDO_CYAN = "#22d3ee";
const RONDO_VIOLET = "#c084fc";
const EDGE = "rgba(34,211,238,.38)";

function RecallGlyph({ animated, uid }) {
  const gid = `rkmRg_${uid}`;
  return (
    <svg width="42" height="42" viewBox="0 0 48 48" aria-hidden className={animated ? "rkm-recall-spin" : ""}>
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={RONDO_CYAN} />
          <stop offset="100%" stopColor={RONDO_VIOLET} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="rgba(8,20,36,.95)" stroke={`url(#${gid})`} strokeWidth="1.5" />
      <path
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        d="M15 28a9 9 0 0 0 14.2 2.1M33 20a9 9 0 0 0-14.2-2.1"
      />
      <path fill={`url(#${gid})`} d="M31 18h6v-6M17 30h-6v6" />
    </svg>
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
 *   setAlive: (id: number, n: number) => void,
 *   adjustTeamFinishes: (team: Team, d: number) => void,
 *   triggerRondoRecall: (id: number, addAliveSlots?: number) => void,
 *   undoRondoMistakenBench: (id: number) => void,
 *   finalizeBenchedElimination: (team: Team) => void,
 *   finishBadgesObsUrl: string,
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
  adjustTeamFinishes,
  triggerRondoRecall,
  undoRondoMistakenBench,
  finalizeBenchedElimination,
  finishBadgesObsUrl,
}) {
  const sorted = teams;

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
          On Rondo each squad has <strong>{RONDO_RECALL_CHARGE_CAP} redeploy credits</strong> (one per seated player).{" "}
          <strong>Recall +N</strong> mid-fight or from bench spends <strong>N credits</strong> for <strong>N</strong> knocked seats. Credits you never use on one player{" "}
          stay for the squad. At <strong>0 credits</strong>, the next bench or full wipe is <strong>final elimination</strong> with placement on broadcast. If <strong>OUT</strong> was a
          mistake and the squad only went to <strong>recall bench</strong>, use <strong>Undo mistaken OUT</strong> on that row (restores 4/4).
        </p>
        <div className="rkm-hero__obs">
          <span className="rkm-hero__obsLabel">OBS strip</span>
          <code className="rkm-hero__code">/overlay/rondo/finish-badges</code>
          <button type="button" className="rkm-hero__open" onClick={() => window.open(finishBadgesObsUrl, "_blank", "width=540,height=980")}>
            Launch overlay
          </button>
        </div>
      </div>

      <div className="rkm-grid">
        {sorted.map((team) => {
          const alive = team.alivePlayers ?? 4;
          const st = String(team.status || "").toLowerCase();
          const isElim = st === "eliminated";
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
          const knockedSlots = partialRecallEligible ? Math.max(0, 4 - Math.max(0, Math.min(4, alive))) : 0;
          const recallAddChoices = partialRecallEligible ? Math.min(knockedSlots, credits) : 0;

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

          return (
            <div key={team.id} className={rowClass.join(" ")} data-phase={phase}>
              <div className="rkm-row__recall">
                {(isBenched && credits > 0) || partialRecallEligible ? (
                  <RecallGlyph animated uid={String(team.id)} />
                ) : (
                  <div className="rkm-row__recall-placeholder" />
                )}
              </div>

              <div className="rkm-row__identity">
                <div style={{ ...styles.teamLogo, ...teamLogoStyle, width: 44, height: 44, fontSize: 13, borderRadius: 12, ...(team.logo ? { backgroundImage: `url(${apiBase}${team.logo})`, backgroundSize: "cover", color: "transparent" } : {}) }}>
                  {team.logo ? "" : String(team.team || "").slice(0, 2)}
                </div>
                <div className="rkm-row__idtext">
                  <span className="rkm-row__name">{team.team}</span>
                  {!isElim ? (
                    <span className={`rkm-pill ${consumed ? "rkm-pill--used" : credits < RONDO_RECALL_CHARGE_CAP ? "rkm-pill--hot" : "rkm-pill--muted"}`}>
                      {consumed ? "NO CREDITS" : `${credits}/${RONDO_RECALL_CHARGE_CAP} CREDITS`}
                    </span>
                  ) : null}
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
                <div className="rkm-bars" aria-label="Players up">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="rkm-bar"
                      data-hot={i < alive ? "1" : "0"}
                      style={{
                        background: i < alive ? "#5CFF72" : isBenched ? "#2d3540" : st === "knocked" ? "#FF6B45" : "#252a32",
                        opacity: isElim ? 0.45 : isBenched ? 0.65 : 1,
                      }}
                    />
                  ))}
                  <span className="rkm-bars__label">
                    {isBenched ? "0" : alive}/4
                  </span>
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
                {isElim ? (
                  team.eliminationRank != null ? (
                    <span style={{ ...ns.rankBadge, fontSize: 14, padding: "8px 14px" }}>#{team.eliminationRank}</span>
                  ) : (
                    <span className="rkm-pill rkm-pill--muted">OUT</span>
                  )
                ) : isBenched ? (
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
                    {partialRecallEligible && recallAddChoices > 0 ? (
                      <div className="rkm-recall-increment" role="group" aria-label="Redeploy knocked players">
                        {Array.from({ length: recallAddChoices }, (_, i) => {
                          const add = i + 1;
                          const nextAlive = alive + add;
                          return (
                            <button
                              key={add}
                              type="button"
                              className="rkm-btn-recall rkm-btn-recall--step"
                              onClick={() => void triggerRondoRecall(team.id, add)}
                              title={`Redeploy ${add} knocked seat(s) — consumes the one-time recall`}
                            >
                              ⚡ Recall +{add} → {nextAlive}/4
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    <div style={{ ...ns.knockBtns, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button type="button" style={ns.knockBtn} onClick={() => setAlive(team.id, 3)}>
                        1K
                      </button>
                      <button type="button" style={ns.knockBtn} onClick={() => setAlive(team.id, 2)}>
                        2K
                      </button>
                      <button type="button" style={ns.knockBtn} onClick={() => setAlive(team.id, 1)}>
                        3K
                      </button>
                      <button type="button" style={{ ...ns.knockBtn, ...ns.knockBtnDanger }} onClick={() => knockTeam(team.id, 4, true)} title="Full wipe — benches first unless recall token already used">
                        OUT
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
          grid-template-columns: 56px minmax(160px, 1.1fr) minmax(200px, 1.4fr) 180px minmax(200px, 1.2fr);
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: linear-gradient(160deg, rgba(10, 28, 42, 0.55), rgba(6, 10, 22, 0.88));
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04);
          transition: border-color 0.35s ease, box-shadow 0.35s ease, transform 0.25s ease;
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
          display: grid;
          place-items: center;
        }
        .rkm-row__recall-placeholder {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 1px dashed rgba(100, 120, 140, 0.35);
          opacity: 0.5;
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

        .rkm-recall-spin {
          animation: rkmRecallSpin 4.5s linear infinite;
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
        @keyframes rkmRecallSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1180px) {
          .rkm-row {
            grid-template-columns: 48px 1fr;
            grid-template-rows: auto auto auto auto;
          }
          .rkm-row__recall {
            grid-row: 1 / span 2;
          }
          .rkm-row__identity {
            grid-column: 2;
          }
          .rkm-row__status {
            grid-column: 1 / -1;
          }
          .rkm-row__meters {
            grid-column: 1 / -1;
            flex-direction: row;
            justify-content: space-between;
            width: 100%;
          }
          .rkm-row__actions {
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
          .rkm-recall-spin {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
