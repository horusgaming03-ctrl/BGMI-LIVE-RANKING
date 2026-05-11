import { memo } from "react";
import AliveIndicator from "../../overlay-engine/alive-styles/AliveIndicator";

function ThemedAlive({ count, theme, styleId = "rounded", layout = "grid", customAlivePath = null, customDeadPath = null }) {
  return (
    <AliveIndicator
      count={count}
      theme={theme}
      styleId={styleId}
      layout={layout}
      customAlivePath={customAlivePath}
      customDeadPath={customDeadPath}
    />
  );
}

export default memo(ThemedAlive);
