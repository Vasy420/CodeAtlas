import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export function Brand({
  to = "/",
  compact = false,
}: {
  to?: string;
  compact?: boolean;
}) {
  return (
    <Link className="brand" to={to} aria-label="CodeAtlas">
      <Logo size={compact ? 28 : 32} />
      <span className="brand-mark">CodeAtlas</span>
    </Link>
  );
}
