import { Navigate, Route, Routes } from "react-router-dom";
import { Starfield } from "./components/Starfield";
import { Home } from "./pages/Home";
import { ProjectPage } from "./pages/ProjectPage";

export default function App() {
  return (
    <div className="app-shell">
      <Starfield />
      <div className="grain" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects/:id" element={<ProjectPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
