import { Logo } from "./Logo";

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-mark">
        <span className="splash-ring" aria-hidden="true" />
        <Logo size={48} />
      </div>
      <p className="splash-label">{label}</p>
    </div>
  );
}
