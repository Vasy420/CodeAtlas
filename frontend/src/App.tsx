import { Navigate, Route, Routes } from "react-router-dom";
import { Starfield } from "./components/Starfield";
import { AppHome } from "./pages/AppHome";
import { Marketing } from "./pages/Marketing";
import { ProjectPage } from "./pages/ProjectPage";

export default function App() {
  return (
    <div className="app-shell">
      <Starfield />
      <div className="grain" />
      <Routes>
        <Route path="/" element={<Marketing />} />
        <Route path="/app" element={<AppHome />} />
        <Route path="/projects/:id" element={<ProjectPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
