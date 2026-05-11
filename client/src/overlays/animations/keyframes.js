/**
 * All reusable CSS keyframe animations for the overlay system.
 * Injected once via <style> to keep things performant.
 */
const keyframes = `
@keyframes ov-slideInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ov-slideInRight {
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ov-slideInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ov-slideInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ov-fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes ov-scaleIn {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes ov-pop {
  0%   { opacity: 0; transform: scale(0.6); }
  70%  { transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ov-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.7; }
}
@keyframes ov-glow {
  0%, 100% { box-shadow: 0 0 10px rgba(255,255,255,.1); }
  50%      { box-shadow: 0 0 25px rgba(255,255,255,.25); }
}
@keyframes ov-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes ov-reveal {
  from { clip-path: inset(0 100% 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}
@keyframes ov-wwcdPop {
  0%   { opacity: 0; transform: scale(0.8); }
  60%  { transform: scale(1.03); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ov-wwcdGlow {
  0%, 100% { box-shadow: 0 0 30px rgba(255,215,0,.2); }
  50%      { box-shadow: 0 0 80px rgba(255,215,0,.5); }
}
@keyframes ov-rankUpdate {
  0%   { background-color: rgba(255,255,255,.08); }
  100% { background-color: transparent; }
}
@keyframes ov-rgbBorder {
  0%   { border-color: #ff0040; }
  17%  { border-color: #ff8000; }
  33%  { border-color: #ffff00; }
  50%  { border-color: #00ff88; }
  67%  { border-color: #00c8ff; }
  83%  { border-color: #8000ff; }
  100% { border-color: #ff0040; }
}
@keyframes ov-rgbTopLine {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
@keyframes ov-floatUp {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}
@keyframes ov-scanline {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
`;

export default keyframes;
