import { Link } from "react-router-dom";

export function Brand({ compact = false, to = "/" }: { compact?: boolean; to?: string }) {
  return (
    <Link className="brand" to={to} aria-label="CodeAtlas home">
      <img className="brand-logo" src="/logo.svg" alt="" width={compact ? 32 : 40} height={compact ? 32 : 40} />
      <span className="brand-copy">
        <span className="brand-mark">CodeAtlas</span>
        {!compact && <span className="brand-sub">cartography</span>}
      </span>
    </Link>
  );
}
