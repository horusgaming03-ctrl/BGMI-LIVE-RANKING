/**
 * Premium enter animations for **`/overlay/themes` (Theme Preview) only**.
 * Not wired to live OBS overlays unless you intentionally import this elsewhere.
 */
export const themePreviewPremiumKeyframes = `
@keyframes tp-slide-ltr {
  from { opacity: 0; transform: translateX(-28px); filter: saturate(1.08); }
  to   { opacity: 1; transform: translateX(0); filter: saturate(1); }
}
@keyframes tp-slide-rtl {
  from { opacity: 0; transform: translateX(28px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes tp-pop-from-top {
  from { opacity: 0; transform: translateY(-22px) scale(0.98); }
  70% { transform: translateY(3px) scale(1); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes tp-pop-from-bottom {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  72% { transform: translateY(-3px) scale(1); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes tp-paper-unfold {
  0%   { opacity: 0; transform: perspective(900px) rotateX(-18deg) scaleY(0.78); transform-origin: top center; }
  55%  { opacity: 1; transform: perspective(900px) rotateX(6deg) scaleY(1.02); }
  80%  { transform: perspective(900px) rotateX(-2deg) scaleY(1); }
  100% { opacity: 1; transform: perspective(900px) rotateX(0) scaleY(1); transform-origin: top center; }
}
@keyframes tp-glitch-reveal {
  0%   { opacity: 0; transform: translate(-2px, 1px) skewX(-2deg); clip-path: inset(0 12% 0 0); }
  22%  { opacity: 0.92; transform: translate(3px, -2px) skewX(1deg); clip-path: inset(0 45% 0 8%); filter: saturate(1.6) contrast(1.05); }
  42%  { transform: translate(-1px, 0); clip-path: inset(0 8% 0 3%); filter: none; }
  100% { opacity: 1; transform: translate(0,0) skewX(0); clip-path: inset(0 0 0 0); }
}
@keyframes tp-fade-scale-smooth {
  from { opacity: 0; transform: scale(0.9); filter: brightness(1.08); }
  to { opacity: 1; transform: scale(1); filter: brightness(1); }
}
@keyframes tp-cyber-sweep {
  0%   { opacity: 0; clip-path: polygon(0 0, 0 0, 0 100%, 0 100%); filter: saturate(1.25) hue-rotate(-8deg); }
  40%  { opacity: 1; clip-path: polygon(0 0, 75% 0, 62% 100%, 0 100%); }
  100% { opacity: 1; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); filter: saturate(1); }
}
@keyframes tp-esports-swipe {
  from { opacity: 0; transform: skewX(-6deg) translateX(-8%); clip-path: inset(0 100% 0 0); }
  55% { opacity: 1; transform: skewX(0deg) translateX(0); clip-path: inset(0 8% 0 0); }
  to { opacity: 1; transform: skewX(0deg) translateX(0); clip-path: inset(0 0 0 0); }
}
@keyframes tp-neon-reveal {
  0%   { opacity: 0; text-shadow: none; filter: drop-shadow(0 0 0 transparent); transform: translateY(4px); }
  40%  { opacity: 0.55; filter: drop-shadow(0 0 12px rgba(34,211,238,0.45)); }
  100% { opacity: 1; filter: drop-shadow(0 0 6px rgba(255,248,232,0.2)); transform: translateY(0); }
}
@keyframes tp-stretch-dynamic {
  0%   { opacity: 0; transform: scaleX(0.82) scaleY(0.95); }
  55%  { opacity: 1; transform: scaleX(1.04) scaleY(1); }
  80%  { transform: scaleX(0.99) scaleY(1); }
  100% { opacity: 1; transform: scaleX(1) scaleY(1); }
}
@keyframes tp-tournament-intro {
  0% { opacity: 0; transform: scale(1.08) rotate(-0.35deg); filter: saturate(2) brightness(1.15); }
  35%{ opacity: 1; transform: scale(0.985) rotate(0.2deg); filter: saturate(1.35) brightness(1.05); }
  100%{ opacity: 1; transform: scale(1) rotate(0); filter: saturate(1) brightness(1); }
}
`;

const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

/** @typedef {{ board: string; header: string; row: (i: number) => string }} AnimTriple */

/** @type {Record<string, { label: string; anim: AnimTriple }>} */
export const THEME_PREVIEW_PREMIUM_PACKS = {
  slideLr: {
    label: "01 · Sweep in (left → right)",
    anim: {
      board: `tp-fade-scale-smooth 0.5s ${ease} both`,
      header: `tp-slide-ltr 0.45s ${ease} 0.04s both`,
      row: (i) => `tp-slide-ltr 0.38s ${ease} ${0.06 + i * 0.055}s both`,
    },
  },
  slideRl: {
    label: "02 · Sweep in (right → left)",
    anim: {
      board: `tp-fade-scale-smooth 0.48s ${ease} both`,
      header: `tp-slide-rtl 0.44s ${ease} 0.03s both`,
      row: (i) => `tp-slide-rtl 0.37s ${ease} ${0.06 + i * 0.053}s both`,
    },
  },
  popTop: {
    label: "03 · Drop from top",
    anim: {
      board: `tp-pop-from-top 0.52s ${ease} both`,
      header: `tp-pop-from-top 0.48s ${ease} 0.08s both`,
      row: (i) => `tp-pop-from-top 0.42s ${ease} ${0.1 + i * 0.05}s both`,
    },
  },
  popBottom: {
    label: "04 · Rise from bottom",
    anim: {
      board: `tp-pop-from-bottom 0.53s ${ease} both`,
      header: `tp-pop-from-bottom 0.46s ${ease} 0.06s both`,
      row: (i) => `tp-pop-from-bottom 0.41s ${ease} ${0.09 + i * 0.05}s both`,
    },
  },
  paper: {
    label: "05 · Panel unfold",
    anim: {
      board: `tp-paper-unfold 0.65s ${ease} both`,
      header: `tp-fade-scale-smooth 0.4s ${ease} 0.18s both`,
      row: (i) => `tp-slide-ltr 0.36s ${ease} ${0.22 + i * 0.045}s both`,
    },
  },
  glitch: {
    label: "06 · Glitch resolve",
    anim: {
      board: `tp-glitch-reveal 0.58s cubic-bezier(0.4, 0, 0.2, 1) both`,
      header: `tp-glitch-reveal 0.45s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both`,
      row: (i) => `tp-glitch-reveal 0.38s cubic-bezier(0.4, 0, 0.2, 1) ${0.08 + i * 0.04}s both`,
    },
  },
  fadeScale: {
    label: "07 · Fade + scale (clean)",
    anim: {
      board: `tp-fade-scale-smooth 0.55s ${ease} both`,
      header: `tp-fade-scale-smooth 0.45s ${ease} 0.06s both`,
      row: (i) => `tp-fade-scale-smooth 0.4s ${ease} ${0.08 + i * 0.05}s both`,
    },
  },
  cyber: {
    label: "08 · Cyber sweep",
    anim: {
      board: `tp-cyber-sweep 0.62s cubic-bezier(0.33, 1, 0.68, 1) both`,
      header: `tp-cyber-sweep 0.48s cubic-bezier(0.33, 1, 0.68, 1) 0.12s both`,
      row: (i) => `tp-cyber-sweep 0.42s cubic-bezier(0.33, 1, 0.68, 1) ${0.1 + i * 0.04}s both`,
    },
  },
  swipe: {
    label: "09 · Broadcast swipe",
    anim: {
      board: `tp-esports-swipe 0.55s ${ease} both`,
      header: `tp-esports-swipe 0.45s ${ease} 0.08s both`,
      row: (i) => `tp-esports-swipe 0.38s ${ease} ${0.08 + i * 0.042}s both`,
    },
  },
  neon: {
    label: "10 · Neon rise",
    anim: {
      board: `tp-neon-reveal 0.6s ${ease} both`,
      header: `tp-neon-reveal 0.5s ${ease} 0.07s both`,
      row: (i) => `tp-neon-reveal 0.44s ${ease} ${0.1 + i * 0.055}s both`,
    },
  },
  stretch: {
    label: "11 · Elastic stretch",
    anim: {
      board: `tp-stretch-dynamic 0.54s cubic-bezier(0.34, 1.56, 0.64, 1) both`,
      header: `tp-stretch-dynamic 0.48s cubic-bezier(0.34, 1.56, 0.64, 1) 0.06s both`,
      row: (i) => `tp-stretch-dynamic 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.08 + i * 0.046}s both`,
    },
  },
  intro: {
    label: "12 · Tournament slam-in",
    anim: {
      board: `tp-tournament-intro 0.5s cubic-bezier(0.2, 0.95, 0.15, 1) both`,
      header: `tp-fade-scale-smooth 0.38s ${ease} 0.12s both`,
      row: (i) => `tp-slide-ltr 0.34s ${ease} ${0.16 + i * 0.048}s both`,
    },
  },
};

const DEFAULT_PACK = "slideLr";

export function resolveThemePreviewPremiumPack(key) {
  const k =
    typeof key === "string" && Object.prototype.hasOwnProperty.call(THEME_PREVIEW_PREMIUM_PACKS, key)
      ? key
      : DEFAULT_PACK;
  return THEME_PREVIEW_PREMIUM_PACKS[k].anim;
}

export function listThemePreviewPremiumPackOptions() {
  return Object.entries(THEME_PREVIEW_PREMIUM_PACKS).map(([value, v]) => ({ value, label: v.label }));
}
