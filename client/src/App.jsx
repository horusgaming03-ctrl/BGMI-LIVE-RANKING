import { Navigate, Route, Routes } from "react-router-dom";
import AdminPanel from "./AdminPanel";
import Overlay from "./Overlay";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/overlay" element={<Overlay />} />
    </Routes>
  );
}