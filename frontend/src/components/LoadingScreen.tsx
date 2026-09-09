export function LoadingScreen({
  label = "Charting the atlas…",
  cover = true,
}: {
  label?: string;
  cover?: boolean;
}) {
  return (
    <div className={cover ? "splash" : "splash splash-inline"} role="status" aria-live="polite">
      <div className="splash-mark">
        <span className="splash-ring" aria-hidden="true" />
        <img src="/logo.png" alt="" width={132} height={132} />
      </div>
      <p className="splash-word">CodeAtlas</p>
      <p className="splash-label">{label}</p>
    </div>
  );
}
