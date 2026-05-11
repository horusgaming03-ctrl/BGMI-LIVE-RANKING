import { useMemo } from "react";
import { getAnimationPack } from "./packs";

/** Mirrors overlay useAnimation shape for drop-in compatibility */
export default function useEngineAnimation(packId, enabled = true) {
  return useMemo(() => {
    const pack = getAnimationPack(enabled ? packId : "none");
    return {
      board: pack.board,
      header: pack.header,
      row: (i) => (typeof pack.row === "function" ? pack.row(i) : pack.row),
      wwcd: pack.wwcd,
      wwcdOverlay: pack.wwcdOverlay,
    };
  }, [packId, enabled]);
}
