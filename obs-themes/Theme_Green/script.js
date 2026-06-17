/**
 * Theme_Green — tactical forest production hooks
 */
export default {
  onMount(ctx) {
    document.body.classList.add("theme-green");
  },
  decorateRow(row, team) {
    if (team.eliminated) row.style.opacity = "0.45";
    else row.style.opacity = "1";
  },
  decoratePngFrame(el, slotId) {
    if (slotId === "liveRanking") el.style.mixBlendMode = "screen";
  },
  onElimination(mod) {
    mod.querySelector(".obs-elim-card")?.classList.add("theme-green-elim");
  },
};
