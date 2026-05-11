import { memo } from "react";

/** Future: safe-area / sponsor rails / multi-region shells. Pass-through for now (zero behavioral change). */
function TournamentLayoutShell({ children, variant = "default" }) {
  void variant;
  return children;
}

export default memo(TournamentLayoutShell);
