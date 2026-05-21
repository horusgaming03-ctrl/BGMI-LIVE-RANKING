/** Deep-merge saved color tweaks onto a static theme object (used by /overlay/themed). */
export function mergeThemeOverride(base, patch) {
  if (!base) return base;
  if (!patch || typeof patch !== "object") return base;

  const colors =
    patch.colors && typeof patch.colors === "object" ? { ...base.colors, ...patch.colors } : base.colors;
  const alive =
    patch.alive && typeof patch.alive === "object" ? { ...base.alive, ...patch.alive } : base.alive;
  const row =
    patch.row && typeof patch.row === "object" ? { ...base.row, ...patch.row } : base.row;

  const paletteTouched =
    patch.colors && typeof patch.colors === "object" && Object.keys(patch.colors).length > 0;

  let gradients = base.gradients;
  if (paletteTouched && base.gradients && typeof base.gradients === "object") {
    const c = colors;
    gradients = { ...base.gradients };
    const accent = c.accent;
    const primary = c.primary;
    const secondary = c.secondary;
    if (accent && secondary) {
      gradients.header = `linear-gradient(90deg, ${accent} 0%, ${secondary} 100%)`;
    }
    if (primary && accent) {
      gradients.topLine = `linear-gradient(90deg, ${primary}, ${accent}, ${primary})`;
    }
    if (secondary) {
      gradients.panel = `linear-gradient(180deg, ${secondary} 0%, rgba(15, 15, 24, 0.96) 100%)`;
    }
  }

  return {
    ...base,
    colors,
    alive,
    row,
    gradients,
  };
}
