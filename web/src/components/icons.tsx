// Inline SVG logo mark + a consistent stroke-icon set (currentColor, 24px grid).
// Kept in one place so the whole app shares one visual language.

export function Logo({ className = "", size = 28 }: { className?: string; size?: number }) {
  // A two-leaf sprout — green coffee, growing origins.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 21v-8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M12 14C7.5 14 4.5 11.2 5 6.5C9.3 6.2 12 9.2 12 13.8Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M12 12.5C15.8 12.5 18.4 10.1 18 6C14.3 5.8 12 8.4 12 12.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

type IconName =
  | "map"
  | "recommend"
  | "calendar"
  | "weather"
  | "notes"
  | "tastings"
  | "watchlist"
  | "search"
  | "suppliers"
  | "manage";

const PATHS: Record<IconName, React.ReactNode> = {
  map: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </>
  ),
  recommend: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" strokeLinejoin="round" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9h17M8 3v3M16 3v3" />
    </>
  ),
  weather: (
    <>
      <path d="M7 16a4 4 0 010-8 5 5 0 019.6 1.5A3.5 3.5 0 0116.5 16z" strokeLinejoin="round" />
      <path d="M8 19.5l-.7 1.5M12 19.5l-.7 1.5M16 19.5l-.7 1.5" strokeLinecap="round" />
    </>
  ),
  notes: (
    <>
      <path d="M6 3.5h8l4 4V20a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" strokeLinejoin="round" />
      <path d="M13.5 3.5V8h4M8.5 12.5h7M8.5 16h7" />
    </>
  ),
  tastings: (
    <>
      <path d="M5 8h11v4a5 5 0 01-5 5H10a5 5 0 01-5-5z" strokeLinejoin="round" />
      <path d="M16 9h1.5a2.5 2.5 0 010 5H16" />
      <path d="M8 3.5c-.6.8-.6 1.7 0 2.5M11.5 3.5c-.6.8-.6 1.7 0 2.5" strokeLinecap="round" />
    </>
  ),
  watchlist: (
    <path
      d="M12 4l2.3 4.7 5.2.8-3.75 3.65.9 5.15L12 15.9l-4.65 2.45.9-5.15L4.5 9.5l5.2-.8z"
      strokeLinejoin="round"
    />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.5-4.5" strokeLinecap="round" />
    </>
  ),
  suppliers: (
    <>
      <path d="M4 9.5l1.6-4h12.8l1.6 4" strokeLinejoin="round" />
      <path d="M4 9.5h16v10a1 1 0 01-1 1H5a1 1 0 01-1-1z" strokeLinejoin="round" />
      <path d="M9.5 20.5V15h5v5.5" />
    </>
  ),
  manage: (
    <path d="M4 20l4-1 9.4-9.4a2 2 0 000-2.8l-.2-.2a2 2 0 00-2.8 0L5 16z" strokeLinejoin="round" />
  ),
};

export function NavIcon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
