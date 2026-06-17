export default {
  onMount(ctx) {
    document.body.classList.add("theme-premium");
    ctx.root.style.setProperty("--gold", "#d4af37");
  },
  decorateRow(row, team) {
    if (team.rank === 1) row.classList.add("is-gold-leader");
  },
};
