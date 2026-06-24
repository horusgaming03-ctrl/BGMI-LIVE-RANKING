/** Minimal elimination banner — entrance / exit animation presets */

export const DEFAULT_MINIMAL_ELIM_ANIMATION = "slideLeft";

export const MINIMAL_ELIM_ANIMATIONS = [
  { id: "slideLeft", label: "Slide from left" },
  { id: "slideUp", label: "Rise from bottom" },
  { id: "popIn", label: "Pop & scale" },
  { id: "fadeZoom", label: "Fade zoom" },
  { id: "combatDrop", label: "Combat Drop Banner" },
];

const VALID_IDS = new Set(MINIMAL_ELIM_ANIMATIONS.map((a) => a.id));

export function normalizeMinimalElimAnimation(id) {
  return VALID_IDS.has(id) ? id : DEFAULT_MINIMAL_ELIM_ANIMATION;
}

export function minimalElimAnimationFromTheme(theme) {
  return normalizeMinimalElimAnimation(theme?.elimination?.animation);
}

/** Theme override wins; GFX custom draft can override for live preview. */
export function minimalElimAnimationResolved(theme, bannerColors) {
  const id =
    bannerColors?.animation ??
    bannerColors?.broadcastStyle?.animation ??
    theme?.elimination?.animation;
  return normalizeMinimalElimAnimation(id);
}

export function minimalElimAnimationClasses(animationId, exiting = false) {
  const id = normalizeMinimalElimAnimation(animationId);
  return exiting ? `lr-min-elim-anim-${id}-exit` : `lr-min-elim-anim-${id}-enter`;
}
