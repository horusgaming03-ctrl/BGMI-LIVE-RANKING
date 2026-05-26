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
import ZonePredictionOverlay from "./overlays/ZonePredictionOverlay";
import LiveAnnouncementOverlay from "./overlays/LiveAnnouncementOverlay";
import FinishBadgesOverlay from "./overlays/FinishBadgesOverlay";
import ObsSharedTripleSlotOverlay from "./overlays/ObsSharedTripleSlotOverlay";
import ObsBgmiLayeredRankingOverlay from "./overlays/ObsBgmiLayeredRankingOverlay";
import SideBannerOverlay from "./overlays/SideBannerOverlay";
import RondoRecallPopupOverlay from "./overlays/RondoRecallPopupOverlay";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/overlay" element={<Overlay />} />
      <Route path="/overlay/overall" element={<OverlayOverall />} />
      <Route path="/register" element={<TeamRegister />} />
      <Route path="/overlay/themed" element={<ThemedOverlay />} />
      {/* Same data + theme + alive as /overlay/themed; FIN column only, sorted by finishes (TOTAL hidden). */}
      <Route path="/overlay/finish-points-ranking" element={<ThemedOverlay />} />
      <Route path="/overlay/themed/overall" element={<ThemedOverlayOverall />} />
      <Route path="/overlay/themes" element={<ThemePreview />} />
      <Route path="/overlay/elimination" element={<EliminationOverlay />} />
      <Route path="/overlay/wwcd" element={<WWCDOverlay />} />
      {/* Final-squad WWCD strip only (transparent OBS source). Aliases share the same overlay. */}
      <Route path="/overlay/wwcd-only" element={<WwcFourAliveStripOverlay />} />
      <Route path="/overlay/wwcd-4-teams" element={<WwcFourAliveStripOverlay />} />
      <Route path="/overlay/wwcd-four" element={<WwcFourAliveStripOverlay />} />
      <Route path="/overlay/zone-prediction" element={<ZonePredictionOverlay />} />
      <Route path="/overlay/announcements" element={<LiveAnnouncementOverlay />} />
      <Route path="/overlay/finish-badges" element={<FinishBadgesOverlay />} />
      <Route path="/overlay/rondo/finish-badges" element={<FinishBadgesOverlay />} />
      <Route path="/overlay/rondo/recall-popup" element={<RondoRecallPopupOverlay />} />
      <Route path="/overlay/broadcast-engine" element={<BroadcastEngineOverlay />} />
      <Route path="/overlay/engine-catalog" element={<EngineCatalog />} />
      {/* One PNG on disk → three OBS browser-source URLs read the same asset (no processing). */}
      <Route path="/overlay/obs-slot/:slotId" element={<ObsSharedTripleSlotOverlay />} />
      <Route path="/overlay/bgmi-layered-ranking" element={<ObsBgmiLayeredRankingOverlay />} />
      {/* Split OBS sources — same layout numbers as combined route; add each as its own browser source. */}
      <Route path="/overlay/bgmi-layered-rows" element={<ObsBgmiLayeredRankingOverlay />} />
      <Route path="/overlay/bgmi-layer-plate/:plateId" element={<ObsBgmiLayeredRankingOverlay />} />
      <Route path="/overlay/side-banner" element={<SideBannerOverlay />} />
    </Routes>
  );
}
