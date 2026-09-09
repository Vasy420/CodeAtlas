import { Link } from "react-router-dom";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" to="/" aria-label="CodeAtlas home">
      <img className="brand-logo" src="/logo.png" alt="" width={compact ? 36 : 44} height={compact ? 36 : 44} />
      <span className="brand-copy">
        <span className="brand-mark">CodeAtlas</span>
        {!compact && <span className="brand-sub">cartography</span>}
      </span>
    </Link>
  );
}
