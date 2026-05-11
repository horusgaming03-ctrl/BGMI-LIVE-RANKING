/** Named animation packs — class names consumed by useEngineAnimation */

export const ANIMATION_PACKS = {
  none: { board: "none", header: "none", row: () => "none", wwcd: "none", wwcdOverlay: "none" },
  subtle: {
    board: "oe_anim_board_subtle 14s ease-in-out infinite",
    header: "oe_anim_header_subtle 6s ease-in-out infinite",
    row: (i) => `oe_anim_row_fade 0.5s ease-out ${(i % 8) * 0.04}s both`,
    wwcd: "oe_anim_wwcd_pop 0.8s cubic-bezier(.34,1.56,.64,1) both",
    wwcdOverlay: "oe_anim_glow_pulse 3s ease-in-out infinite",
  },
  esports: {
    board: "oe_anim_board_esports 10s linear infinite",
    header: "oe_anim_shimmer 3s linear infinite",
    row: (i) => `oe_anim_row_slide 0.55s ease-out ${(i % 12) * 0.045}s both`,
    wwcd: "oe_anim_wwcd_pop 0.75s cubic-bezier(.22,1,.36,1) both",
    wwcdOverlay: "oe_anim_holo 4s ease-in-out infinite",
  },
  broadcast: {
    board: "oe_anim_board_broadcast 16s ease-in-out infinite",
    header: "oe_anim_header_subtle 8s ease-in-out infinite",
    row: (i) => `oe_anim_row_fade 0.45s ease-out ${(i % 10) * 0.05}s both`,
    wwcd: "oe_anim_wwcd_pop 0.85s cubic-bezier(.34,1.56,.64,1) both",
    wwcdOverlay: "none",
  },
  neon: {
    board: "oe_anim_neon_border 5s linear infinite",
    header: "oe_anim_shimmer 2.2s linear infinite",
    row: (i) => `oe_anim_row_slide 0.5s ease-out ${(i % 10) * 0.05}s both`,
    wwcd: "oe_anim_glow_pulse 2s ease-in-out infinite",
    wwcdOverlay: "oe_anim_holo 2.5s ease-in-out infinite",
  },
  cinematic: {
    board: "none",
    header: "oe_anim_shimmer 5s linear infinite",
    row: (i) => `oe_anim_row_fade 0.65s ease-out ${(i % 8) * 0.06}s both`,
    wwcd: "oe_anim_wwcd_pop 1s cubic-bezier(.16,1,.3,1) both",
    wwcdOverlay: "oe_anim_glow_pulse 4s ease-in-out infinite",
  },
};

export const ANIMATION_PACK_IDS = Object.keys(ANIMATION_PACKS);

export function getAnimationPack(id) {
  return ANIMATION_PACKS[id] || ANIMATION_PACKS.subtle;
}
