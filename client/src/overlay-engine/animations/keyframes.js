/** GPU-friendly keyframes for broadcast-engine overlays (scoped names) */
export const engineKeyframeCss = `
@keyframes oe_anim_board_subtle {
  0%, 100% { filter: brightness(1); transform: translateZ(0) scale(1); }
  50% { filter: brightness(1.04); transform: translateZ(0) scale(1.003); }
}
@keyframes oe_anim_board_esports {
  0% { box-shadow: 0 10px 40px rgba(0,0,0,.55); }
  50% { box-shadow: 0 14px 52px rgba(0,0,0,.58); }
  100% { box-shadow: 0 10px 40px rgba(0,0,0,.55); }
}
@keyframes oe_anim_board_broadcast {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.985; }
}
@keyframes oe_anim_header_subtle {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.06); }
}
@keyframes oe_anim_shimmer {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
@keyframes oe_anim_row_fade {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes oe_anim_row_slide {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes oe_anim_wwcd_pop {
  0% { opacity: 0; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes oe_anim_glow_pulse {
  0%, 100% { filter: drop-shadow(0 0 12px rgba(255,255,255,.15)); }
  50% { filter: drop-shadow(0 0 20px rgba(255,255,255,.28)); }
}
@keyframes oe_anim_holo {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.92; }
}
@keyframes oe_anim_neon_border {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}
@keyframes oe_pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
`;
