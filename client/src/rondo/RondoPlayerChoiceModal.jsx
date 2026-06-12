import { RONDO_RECALL_CHARGE_CAP } from "./recallCharges.js";

const CYAN = "#22d3ee";
const VIOLET = "#a855f7";

function MiniBars({ alive, total = 4 }) {
  const ap = Math.max(0, Math.min(total, Number(alive) || 0));
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 22,
            borderRadius: 3,
            background: i < ap ? "#5cff72" : "#e63946",
            opacity: i < ap ? 1 : 0.85,
          }}
        />
      ))}
    </div>
  );
}

function MiniBolts({ credits, total = RONDO_RECALL_CHARGE_CAP }) {
  const c = Math.max(0, Math.min(total, Number(credits) || 0));
  return (
    <div style={{ display: "flex", gap: 0, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            fontSize: 16,
            lineHeight: 1,
            marginLeft: i > 0 ? -4 : 0,
            opacity: i < c ? 1 : 0.42,
          }}
        >
          ⚡
        </span>
      ))}
    </div>
  );
}

/**
 * Rondo: confirm player elimination (alive down) or squad recall (alive up + credits down).
 */
export default function RondoPlayerChoiceModal({
  team,
  currentAlive,
  targetAlive,
  playersDown,
  credits,
  onEliminate,
  onRecall,
  onClose,
}) {
  const maxRecall = Math.min(playersDown, credits);
  const teamName = String(team?.team || "TEAM");

  return (
    <div className="rpc-backdrop" role="dialog" aria-modal="true" aria-labelledby="rpc-title">
      <div className="rpc-panel">
        <button type="button" className="rpc-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="rpc-chip">RONDO · PLAYER EVENT</div>
        <h2 id="rpc-title" className="rpc-title">
          {teamName}
        </h2>
        <p className="rpc-sub">
          {playersDown} player{playersDown === 1 ? "" : "s"} down — squad still has{" "}
          <strong>{credits}</strong> recall chance{credits === 1 ? "" : "s"}.
        </p>

        <div className="rpc-meters">
          <div className="rpc-meter">
            <span className="rpc-meter__label">RECALL</span>
            <MiniBolts credits={credits} />
            <span className="rpc-meter__hint">Used recalls disappear from overlay</span>
          </div>
          <div className="rpc-meter">
            <span className="rpc-meter__label">ALIVE</span>
            <MiniBars alive={currentAlive} />
            <span className="rpc-meter__hint">{currentAlive}/4 players up now</span>
          </div>
        </div>

        <div className="rpc-actions">
          <button type="button" className="rpc-btn rpc-btn--eliminate" onClick={() => onEliminate()}>
            Eliminate Player{playersDown > 1 ? "s" : ""}
            <span className="rpc-btn__sub">
              Alive → {targetAlive}/4 only
            </span>
          </button>

          <div className="rpc-recall-group" role="group" aria-label="Spend recall credits">
            {Array.from({ length: maxRecall }, (_, i) => {
              const n = i + 1;
              const nextCredits = credits - n;
              const nextAlive = Math.min(4, currentAlive + n);
              return (
                <button
                  key={n}
                  type="button"
                  className="rpc-btn rpc-btn--recall"
                  onClick={() => onRecall(n)}
                >
                  ⚡ Recall +{n}
                  <span className="rpc-btn__sub">
                    Alive → {nextAlive}/4 · {nextCredits} credit{nextCredits === 1 ? "" : "s"} left
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .rpc-backdrop {
          position: fixed;
          inset: 0;
          z-index: 12000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(2, 8, 18, 0.72);
          backdrop-filter: blur(6px);
        }
        .rpc-panel {
          position: relative;
          width: min(480px, 100%);
          border-radius: 20px;
          padding: 22px 22px 20px;
          border: 1px solid rgba(34, 211, 238, 0.35);
          background: linear-gradient(160deg, rgba(8, 22, 36, 0.98), rgba(12, 8, 28, 0.96));
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55), 0 0 40px rgba(34, 211, 238, 0.12);
        }
        .rpc-close {
          position: absolute;
          top: 12px;
          right: 14px;
          border: none;
          background: transparent;
          color: #94a3b8;
          font-size: 26px;
          line-height: 1;
          cursor: pointer;
        }
        .rpc-chip {
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.18em;
          color: ${CYAN};
          margin-bottom: 8px;
        }
        .rpc-title {
          margin: 0 0 6px;
          font-size: 22px;
          font-weight: 900;
          color: #f8fafc;
          letter-spacing: 0.04em;
        }
        .rpc-sub {
          margin: 0 0 18px;
          font-size: 13px;
          line-height: 1.5;
          color: #9eb0c4;
          font-weight: 600;
        }
        .rpc-sub strong {
          color: #e0f7ff;
        }
        .rpc-meters {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 18px;
        }
        .rpc-meter {
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.28);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .rpc-meter__label {
          display: block;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.16em;
          color: #64748b;
          margin-bottom: 8px;
        }
        .rpc-meter__hint {
          display: block;
          margin-top: 8px;
          font-size: 10px;
          color: #64748b;
          font-weight: 600;
        }
        .rpc-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .rpc-recall-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .rpc-btn {
          border: none;
          border-radius: 12px;
          padding: 12px 14px;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.03em;
          cursor: pointer;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .rpc-btn__sub {
          font-size: 10px;
          font-weight: 700;
          opacity: 0.88;
          letter-spacing: 0.02em;
        }
        .rpc-btn--eliminate {
          color: #fff7ed;
          background: linear-gradient(155deg, #ea580c, #c2410c);
          box-shadow: 0 10px 28px rgba(234, 88, 12, 0.28);
        }
        .rpc-btn--recall {
          flex: 1 1 calc(50% - 4px);
          min-width: 140px;
          color: #fff;
          background: linear-gradient(155deg, #0ea5e9, ${VIOLET});
          box-shadow: 0 10px 28px rgba(14, 165, 233, 0.28);
        }
        .rpc-btn:hover {
          filter: brightness(1.06);
        }
      `}</style>
    </div>
  );
}
