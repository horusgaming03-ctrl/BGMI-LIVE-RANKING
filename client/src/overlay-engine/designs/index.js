/**
 * Layout / frame tokens merged onto themes — each id is a distinct broadcast look.
 */
export function buildDesignCatalog() {
  const list = [];
  const labels = [
    "pro",
    "arena",
    "arena_night",
    "stadium",
    "studio",
    "hud",
    "frameless",
    "chroma",
    "elite",
    "masters",
    "worlds",
    "premier",
    "open",
    "finals",
    "wildcard",
  ];

  let idx = 0;
  for (let wave = 0; wave < 10; wave++) {
    for (const label of labels) {
      const i = idx++;
      list.push({
        id: `dsgn_${label}_wave${wave}_${String(i).padStart(3, "0")}`,
        label: `${label}_w${wave}`,
        rowHeightMul: 0.88 + ((i * 7) % 13) * 0.02,
        boardWidthOffset: -40 + ((i * 11) % 80),
        borderRadiusBoost: (i % 6) * 2,
        glowMul: 0.75 + ((i % 5) * 0.08),
        headerPadMul: 0.9 + ((i % 4) * 0.05),
        topLineThickAdd: (i % 4) - 1,
        aliveSizeMul: 0.85 + ((i % 6) * 0.05),
        compactColumnsBias: i % 3 === 0,
        panelInset: (i % 5) * 2,
        frameStyle: ["default", "raised", "inset", "floating", "rim"][i % 5],
      });
    }
  }

  return list;
}

let _cat = null;
export function getDesignCatalog() {
  if (!_cat) _cat = buildDesignCatalog();
  return _cat;
}

export function getDesignIds() {
  return getDesignCatalog().map((d) => d.id);
}

export function getDesign(id) {
  const c = getDesignCatalog();
  return c.find((d) => d.id === id) || c[0];
}

export function getEngineDesignCount() {
  return getDesignCatalog().length;
}
