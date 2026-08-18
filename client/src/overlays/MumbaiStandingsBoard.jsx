import { useEffect, useMemo, useRef, useState } from "react";
import "./OverallStandingsMumbai.css";
import { computeColumnSplit } from "./standingsColumnSplit.js";

const DEFAULT_CHAR = "/wwcd-status/assets/characters/char-0.png";

const WWCD_ICON = "/schedule-of-the-match/assets/badges/wwcd-chicken.png";

function StandingsRow({ team, rank, leader = false, slideFrom = "left" }) {
  const pos = String(rank).padStart(2, "0");
  const wwcd = team.chickenDinners ?? 0;

  return (
    <div
      className={`ms-row os-row${leader ? " ms-row--leader os-row--leader" : ""}`}
      data-slide-from={slideFrom}
    >
      <div className="ms-pos os-pos">
        <span className="os-cell-text">{pos}</span>
      </div>
      <div className="ms-bar-wrap os-bar-wrap">
        <div className="ms-team-cell os-team-cell">
          <span className="os-cell-text">{team.team}</span>
        </div>
        <div className="ms-stat-cell os-stat-cell ms-wwcd">
          <span className="os-cell-text">
            {wwcd > 0 && <img className="ms-wwcd-icon os-wwcd-icon" src={WWCD_ICON} alt="" />}
            <span>{wwcd > 0 ? `X${wwcd}` : wwcd}</span>
          </span>
        </div>
        <div className="ms-stat-cell os-stat-cell">
          <span className="os-cell-text">{team.totalPositionPoints ?? 0}</span>
        </div>
        <div className="ms-stat-cell os-stat-cell">
          <span className="os-cell-text">{team.totalKills ?? 0}</span>
        </div>
        <div className="ms-stat-cell os-stat-cell">
          <span className="os-cell-text">{team.totalPoints ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

function TableHeader() {
  return (
    <div className="ms-table-head os-table-head">
      <div className="ms-table-head__pos os-table-head__pos">
        <span className="os-cell-text">POS.</span>
      </div>
      <div className="ms-table-head__cells os-table-head__cells">
        <div className="ms-head-team os-head-team">
          <span className="os-cell-text">TEAM NAME</span>
        </div>
        <div><span className="os-cell-text">WWCD</span></div>
        <div><span className="os-cell-text">PLACE</span></div>
        <div><span className="os-cell-text">FINISH</span></div>
        <div><span className="os-cell-text">TOTAL</span></div>
      </div>
    </div>
  );
}

function FeaturedLeader({ team }) {
  if (!team) return null;
  return (
    <div className="ms-featured os-featured">
      <div className="ms-featured-chars os-featured-chars">
        <img src={DEFAULT_CHAR} alt="" />
      </div>
      <div className="ms-featured-info os-featured-info">
        <div className="ms-featured-banner os-featured-banner">
          <div className="ms-featured-team os-featured-team">
            <span className="os-cell-text">{team.team}</span>
          </div>
        </div>
        <div className="ms-featured-points os-featured-points">
          <span className="os-cell-text">TOTAL POINTS - {team.totalPoints ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

export default function MumbaiStandingsBoard({ teams = [] }) {
  const { leftN, rightStartRank } = useMemo(
    () => computeColumnSplit(teams.length),
    [teams.length]
  );
  const leftTeams = useMemo(() => teams.slice(0, leftN), [teams, leftN]);
  const rightTeams = useMemo(() => teams.slice(leftN), [teams, leftN]);
  const leader = teams[0] ?? null;
  const showFeatured = Boolean(leader);
  const pairCount = Math.max(leftTeams.length, rightTeams.length);

  const topLeftRef = useRef(null);
  const rightOffsetRef = useRef(null);
  const bodyRef = useRef(null);
  const introRevealedRef = useRef(false);
  const [scale, setScale] = useState(1);

  const syncRightOffset = () => {
    const topLeft = topLeftRef.current;
    const offset = rightOffsetRef.current;
    if (!topLeft || !offset) return;
    offset.style.height = `${topLeft.offsetHeight}px`;
  };

  useEffect(() => {
    syncRightOffset();
    const topLeft = topLeftRef.current;
    if (!topLeft) return undefined;
    const ro = new ResizeObserver(() => syncRightOffset());
    ro.observe(topLeft);
    return () => ro.disconnect();
  }, [teams, showFeatured]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.dataset.animEnabled = "1";
    body.style.setProperty("--os-slide-duration", "0.4s");
    body.style.setProperty("--os-shutter-duration", "0.28s");

    const sel =
      ".os-row, .os-table-head, .os-featured-chars, .os-featured-banner, .os-featured-points, .os-standings-title";
    const targets = [...body.querySelectorAll(sel)].filter(Boolean);

    if (introRevealedRef.current) {
      targets.forEach((el) => {
        el.classList.remove("anim-pending");
        el.classList.add("anim-play");
      });
      return;
    }

    targets.forEach((el, i) => {
      el.classList.remove("anim-play");
      el.classList.add("anim-pending");
      el.style.setProperty("--stagger-delay", `${0.45 + i * 0.055}s`);
      if (el.classList.contains("os-row")) {
        el.querySelectorAll(".os-pos, .os-team-cell, .os-stat-cell").forEach((cell, ci) => {
          cell.style.setProperty("--cell-delay", `${ci * 0.045}s`);
        });
      }
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        targets.forEach((el) => {
          el.classList.add("anim-play");
          el.classList.remove("anim-pending");
        });
        introRevealedRef.current = true;
      });
    });
  }, [teams.length]);

  useEffect(() => {
    const update = () => {
      syncRightOffset();
      const el = document.getElementById("ms-content-root");
      const w = el?.offsetWidth || 1680;
      const h = el?.offsetHeight || 800;
      const sx = window.innerWidth / w;
      const sy = window.innerHeight / h;
      setScale(Math.min(sx, sy, 1));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [teams]);

  if (!teams.length) {
    return (
      <div className="ms-viewport ms-transparent">
        <div className="ms-empty">No standings data yet — add teams and match results.</div>
      </div>
    );
  }

  return (
    <div className="ms-viewport ms-transparent">
      <div className="ms-scale-wrap" style={{ transform: `scale(${scale})` }}>
        <div className="ms-content" id="ms-content-root">
          <h1 className="ms-standings-title os-standings-title">
            <span className="os-standings-title__text os-cell-text" data-text="STANDINGS">
              STANDINGS
            </span>
          </h1>
          <div className={`ms-body os-body${showFeatured ? "" : " ms-no-featured"}`} ref={bodyRef}>
            <div className="ms-top os-top">
              <div className="ms-top-left os-top-left" ref={topLeftRef}>
                {showFeatured && <FeaturedLeader team={leader} />}
                <TableHeader />
              </div>
              <div className="ms-top-right os-top-right">
                <div className="ms-right-offset os-right-offset" ref={rightOffsetRef} aria-hidden="true" />
              </div>
            </div>
            <div className="ms-pairs os-pairs">
              {Array.from({ length: pairCount }).map((_, i) => {
                const left = leftTeams[i];
                const right = rightTeams[i];
                return (
                  <div key={i} className="ms-pair os-pair">
                    {left ? (
                      <StandingsRow team={left} rank={i + 1} leader={i === 0} slideFrom="left" />
                    ) : (
                      <div />
                    )}
                    {right ? (
                      <StandingsRow team={right} rank={rightStartRank + i} slideFrom="right" />
                    ) : (
                      <div />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
