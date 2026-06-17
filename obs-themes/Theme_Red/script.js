export default {
  onMount() {
    document.body.classList.add("theme-red");
  },
  decorateRow(row, team) {
    row.style.boxShadow = team.rank <= 3 ? "0 0 1.2em rgba(255,30,60,0.35)" : "none";
  },
  decoratePngFrame(el, slotId) {
    if (slotId === "eliminator") el.classList.add("obs-anim-glow");
  },
};
