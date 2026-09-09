export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#101826" />
      <path
        d="M16 16L8.5 10.5M16 16L24 11M16 16L10 23M16 16L22.5 22.5"
        stroke="#7DD3F0"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="8.5" cy="10.5" r="2.1" fill="#7DD3F0" />
      <circle cx="24" cy="11" r="2.1" fill="#7DD3F0" />
      <circle cx="10" cy="23" r="2.1" fill="#E8B86D" />
      <circle cx="22.5" cy="22.5" r="2.1" fill="#7DD3F0" />
      <circle cx="16" cy="16" r="3.2" fill="#E8B86D" />
      <circle cx="16" cy="16" r="1.2" fill="#101826" />
    </svg>
  );
}
