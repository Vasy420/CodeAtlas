import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Starfield } from "./components/Starfield";
import { LoadingScreen } from "./components/LoadingScreen";
import { AppHome } from "./pages/AppHome";
import { Home } from "./pages/Home";
import { ProjectPage } from "./pages/ProjectPage";

export default function App() {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduce ? 200 : 1600;
    const id = window.setTimeout(() => setBooting(false), ms);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="app-shell">
      <Starfield />
      <div className="grain" />
      {booting && <LoadingScreen label="Aligning the catalog…" />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app" element={<AppHome />} />
        <Route path="/projects/:id" element={<ProjectPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
