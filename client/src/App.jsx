import { Navigate, Route, Routes } from "react-router-dom";
import AdminPanel from "./AdminPanel";
import Overlay from "./Overlay";
import OverlayOverall from "./OverlayOverall";
import TeamRegister from "./TeamRegister";
import ThemedOverlay from "./overlays/ThemedOverlay";
import ThemedOverlayOverall from "./overlays/ThemedOverlayOverall";
import ThemePreview from "./overlays/ThemePreview";
import EliminationOverlay from "./EliminationOverlay";
import WWCDOverlay from "./overlays/WWCDOverlay";
import WwcFourAliveStripOverlay from "./overlays/WwcFourAliveStripOverlay";
import BroadcastEngineOverlay from "./overlay-engine/BroadcastEngineOverlay";
import EngineCatalog from "./overlay-engine/EngineCatalog";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/overlay" element={<Overlay />} />
      <Route path="/overlay/overall" element={<OverlayOverall />} />
      <Route path="/register" element={<TeamRegister />} />
      <Route path="/overlay/themed" element={<ThemedOverlay />} />
      <Route path="/overlay/themed/overall" element={<ThemedOverlayOverall />} />
      <Route path="/overlay/themes" element={<ThemePreview />} />
      <Route path="/overlay/elimination" element={<EliminationOverlay />} />
      <Route path="/overlay/wwcd" element={<WWCDOverlay />} />
      <Route path="/overlay/wwcd-four" element={<WwcFourAliveStripOverlay />} />
      <Route path="/overlay/broadcast-engine" element={<BroadcastEngineOverlay />} />
      <Route path="/overlay/engine-catalog" element={<EngineCatalog />} />
    </Routes>
  );
}
