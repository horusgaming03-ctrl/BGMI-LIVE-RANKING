/** Split overall standings: left = ceil(n/2), right = rest (18→9+9, 20→10+10). */
export function computeColumnSplit(totalTeams, layout = {}) {
  const total = Math.max(0, Number(totalTeams) || 0);
  if (total === 0) return { leftN: 0, rightN: 0, rightStartRank: 1 };

  if (layout.dynamicColumns === false) {
    const leftN = Math.max(1, Math.min(total, Number(layout.leftCount) || Math.ceil(total / 2)));
    const rightN = Math.max(0, total - leftN);
    return { leftN, rightN, rightStartRank: leftN + 1 };
  }

  const leftN = Math.ceil(total / 2);
  const rightN = total - leftN;
  return { leftN, rightN, rightStartRank: leftN + 1 };
}
