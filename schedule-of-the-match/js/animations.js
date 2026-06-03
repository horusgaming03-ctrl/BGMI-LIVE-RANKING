/** Animation presets for match card reveal — GPU-friendly transforms only */

export const ANIMATION_TYPES = [
  { id: "flip", label: "Flip Card (3D)" },
  { id: "shutter", label: "Shutter Open (alternating)" },
  { id: "slideUp", label: "Slide Up" },
  { id: "slideDown", label: "Slide Down" },
  { id: "fadeScale", label: "Fade + Scale" },
  { id: "staggered", label: "Staggered Reveal" },
  { id: "glassWipe", label: "Glass Wipe Reveal" },
  { id: "energySweep", label: "Energy Sweep Reveal" },
];

const BASE_MS = 700;

export function speedMultiplier(speed) {
  const s = Number(speed);
  if (!Number.isFinite(s) || s <= 0) return 1;
  return Math.max(0.25, Math.min(3, s));
}

export function cardDurationMs(speed) {
  return Math.round(BASE_MS / speedMultiplier(speed));
}

export function staggerDelayMs(index, speed) {
  return Math.round((80 + index * 90) / speedMultiplier(speed));
}

/** Time until all card entrance animations should be finished. */
export function cardIntroTotalMs(anim, cardCount = 6) {
  const speed = speedMultiplier(anim?.speed);
  const duration = Math.round(BASE_MS / speed);
  const n = Math.max(1, Number(cardCount) || 1);
  const maxDelay = Math.round((80 + (n - 1) * 90) / speed);
  return duration + maxDelay + 450;
}

/** Show cards in final state — no entrance animation (live updates / config tweaks). */
export function showCardsInstant(root, anim) {
  const type = anim?.type || "staggered";
  const enabled = anim?.enabled !== false;
  root.dataset.anim = type;
  root.dataset.animEnabled = enabled ? "1" : "0";
  root.style.setProperty("--anim-duration", `${cardDurationMs(anim?.speed)}ms`);
  root.style.setProperty("--anim-speed", String(speedMultiplier(anim?.speed)));

  root.querySelectorAll(".match-card").forEach((card, i) => {
    card.style.setProperty("--card-index", String(i));
    card.style.setProperty("--stagger-delay", `${staggerDelayMs(i, anim?.speed)}ms`);
    card.classList.remove("anim-pending");
    card.classList.add("anim-play");
    card.style.animation = "none";
  });
}

export function applyAnimationClasses(root, anim, replayKey) {
  const type = anim?.type || "staggered";
  const enabled = anim?.enabled !== false;
  root.dataset.anim = type;
  root.dataset.animEnabled = enabled ? "1" : "0";
  root.dataset.replay = String(replayKey ?? 0);
  root.style.setProperty("--anim-duration", `${cardDurationMs(anim?.speed)}ms`);
  root.style.setProperty("--anim-speed", String(speedMultiplier(anim?.speed)));

  const cards = root.querySelectorAll(".match-card");
  cards.forEach((card, i) => {
    card.style.setProperty("--card-index", String(i));
    card.style.setProperty("--stagger-delay", `${staggerDelayMs(i, anim?.speed)}ms`);
    card.classList.remove("anim-pending", "anim-play");
    void card.offsetWidth;
    if (enabled) {
      card.classList.add("anim-pending");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => card.classList.add("anim-play"));
      });
      setTimeout(() => card.classList.add("anim-play"), cardDurationMs(anim?.speed) + 1200);
    } else {
      card.classList.add("anim-play");
    }
  });
}

export function replayAnimation(root, config) {
  config.animation = config.animation || {};
  config.animation.replayKey = (config.animation.replayKey || 0) + 1;
  applyAnimationClasses(root, config.animation, config.animation.replayKey);
  return config;
}
