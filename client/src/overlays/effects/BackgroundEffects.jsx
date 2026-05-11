import { memo, useMemo } from "react";

/**
 * Optional background effect layer rendered behind the overlay board.
 * Renders particles / scanlines / ambient glow based on theme.
 * GPU-accelerated, minimal DOM.
 */
function BackgroundEffects({ theme, enabled }) {
  if (!enabled) return null;

  const particles = useMemo(() => {
    const items = [];
    for (let i = 0; i < 20; i++) {
      items.push({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: 1 + Math.random() * 2,
        delay: Math.random() * 6,
        duration: 4 + Math.random() * 4,
        opacity: 0.15 + Math.random() * 0.25,
      });
    }
    return items;
  }, []);

  return (
    <div style={wrapStyle}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: theme.colors.primary,
            opacity: p.opacity,
            animation: `ov-floatUp ${p.duration}s ease-in-out ${p.delay}s infinite`,
            willChange: "transform",
            pointerEvents: "none",
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${theme.colors.primary}08 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

const wrapStyle = {
  position: "fixed",
  inset: 0,
  overflow: "hidden",
  pointerEvents: "none",
  zIndex: 0,
};

export default memo(BackgroundEffects);
