import { memo } from "react";

function ThemedTopLine({ theme }) {
  const isRgb = theme.topLine?.animated;

  return (
    <div
      style={{
        height: theme.topLine?.height || 3,
        background: theme.gradients.topLine,
        backgroundSize: isRgb ? "200% 100%" : undefined,
        animation: isRgb ? "ov-rgbTopLine 3s linear infinite" : undefined,
        willChange: isRgb ? "background-position" : undefined,
      }}
    />
  );
}

export default memo(ThemedTopLine);
