import { useMemo } from "react";
import { stripTeamsFromAlive, wwcdPercentsForStripTeams } from "../wwcdModel";
import WwcdStripTeamCard, { wwcdStripStyleFromColors } from "./WwcdStripTeamCard";
import BroadcastWwcdStripCard from "./BroadcastWwcdStripCard";
import MinimalBroadcastWwcdStripCard from "./components/MinimalBroadcastWwcdStripCard";

/**
 * WWCD 4-squad strip — shown when 1–4 non-eliminated squads remain.
 * Used by `/overlay/wwcd-only` and embedded in `/overlay/themed` final circle.
 */
export default function WwcdFourAliveStrip({ teams, stripColors, position = "center" }) {
  const stripTeams = useMemo(() => {
    const sorted = stripTeamsFromAlive(teams);
    return sorted.length ? sorted : null;
  }, [teams]);

  const stripStyle = useMemo(() => wwcdStripStyleFromColors(stripColors || {}), [stripColors]);
  const StripCard = stripStyle.minimalBroadcastLayout
    ? MinimalBroadcastWwcdStripCard
    : stripStyle.broadcastLayout
      ? BroadcastWwcdStripCard
      : WwcdStripTeamCard;
  const percents = useMemo(() => wwcdPercentsForStripTeams(stripTeams), [stripTeams]);

  if (!stripTeams) return null;

  const cardGap = stripStyle.minimalBroadcastLayout ? 12 : stripStyle.broadcastLayout ? 8 : 14;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        ...(position === "bottom"
          ? { bottom: "7%", transform: "translateX(-50%)" }
          : { top: "50%", transform: "translate(-50%, -50%)" }),
        width: "max-content",
        maxWidth: "min(1680px, 96vw)",
        display: "flex",
        flexDirection: "row",
        gap: cardGap,
        flexWrap: "nowrap",
        alignItems: "stretch",
        justifyContent: "center",
      }}
    >
      {stripTeams.map((team, i) => (
        <StripCard
          key={team.id ?? `${team.team}-${i}`}
          team={team}
          wwcdPct={percents[i] ?? 0}
          logoBoxBg={stripStyle.logoBoxBg}
          barGreen={stripStyle.barGreen}
          barDead={stripStyle.barDead}
          barsBg={stripStyle.barsBg}
          footerBg={stripStyle.footerBg}
          footerText={stripStyle.footerText}
          dividerColor={stripStyle.dividerColor}
          pctTextColor={stripStyle.pctTextColor}
          initialsColor={stripStyle.initialsColor}
          fontFamily={stripStyle.fontFamily}
          cardBoxShadow={stripStyle.cardBoxShadow}
          cardWidth={stripStyle.cardWidth}
          teamTagBg={stripStyle.teamTagBg}
          teamTagText={stripStyle.teamTagText}
          panelBg={stripStyle.panelBg}
          accentLine={stripStyle.accentLine}
          barFilled={stripStyle.barFilled}
        />
      ))}
    </div>
  );
}

/** True when live ranking should swap to the WWCD strip (1–4 squads left). */
export function shouldShowWwcdStripForTeams(teams) {
  return stripTeamsFromAlive(teams).length > 0;
}
