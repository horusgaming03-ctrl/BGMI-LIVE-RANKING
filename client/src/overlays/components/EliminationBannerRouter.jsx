import BroadcastEliminationBanner from "./BroadcastEliminationBanner";
import MinimalBroadcastEliminationBanner from "./MinimalBroadcastEliminationBanner";
import CyberpunkEliminationBanner from "./CyberpunkEliminationBanner";
import NeonEliminationBanner from "./NeonEliminationBanner";
import {
  resolveEliminationBannerLayout,
  eliminationBannerStyleFromTheme,
} from "../eliminationBannerRegistry";
import {
  minimalElimAnimationClasses,
  minimalElimAnimationResolved,
} from "../minimalElimAnimations";

const SAMPLE_BANNER = { team: "SAMPLE TEAM", rank: 11, finishes: 1, logo: null };

/**
 * Renders the elimination banner for the active theme's selected layout.
 */
export default function EliminationBannerRouter({
  banner,
  theme,
  gfxColors = null,
  animClass = "elim-enter",
  exiting = false,
  scale = 1,
  origin = "bottom left",
  previewKey = "",
}) {
  if (!theme) return null;

  const layout = resolveEliminationBannerLayout(theme);
  const data = banner || SAMPLE_BANNER;
  const styles = eliminationBannerStyleFromTheme(theme);
  const enterAnim = exiting ? "elim-exit" : animClass;

  if (layout === "neonPanel") {
    return (
      <NeonEliminationBanner
        key={`neon-${previewKey}`}
        banner={data}
        theme={theme}
        style={gfxColors?.neonStyle ?? styles.neonStyle}
        animClass={enterAnim}
        scale={scale}
        origin={origin}
      />
    );
  }

  if (layout === "stacked") {
    return (
      <CyberpunkEliminationBanner
        key={`stacked-${previewKey}`}
        banner={data}
        theme={theme}
        style={gfxColors?.cyberpunkStyle ?? styles.cyberpunkStyle}
        animClass={enterAnim}
        scale={scale}
        origin={origin}
      />
    );
  }

  if (layout === "minimalBroadcast") {
    const anim = minimalElimAnimationClasses(
      minimalElimAnimationResolved(theme, gfxColors),
      exiting,
    );
    return (
      <MinimalBroadcastEliminationBanner
        key={`minimal-${previewKey}-${minimalElimAnimationResolved(theme, gfxColors)}`}
        banner={data}
        theme={theme}
        style={gfxColors?.broadcastStyle ?? styles.broadcastStyle}
        animClass={anim}
        scale={scale}
        origin={origin}
      />
    );
  }

  if (layout === "broadcast") {
    return (
      <BroadcastEliminationBanner
        key={`broadcast-${previewKey}`}
        banner={data}
        theme={theme}
        style={gfxColors?.broadcastStyle ?? styles.broadcastStyle}
        animClass={enterAnim}
        scale={scale}
        origin={origin}
      />
    );
  }

  return null;
}
