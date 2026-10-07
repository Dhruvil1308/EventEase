/** EventEase mark: a stylised QR finder pattern with a check "scan" notch. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="ee-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="#0c0c1e" stroke="url(#ee-logo)" strokeWidth="1.5" />
      <rect x="8" y="8" width="10" height="10" rx="3" fill="none" stroke="url(#ee-logo)" strokeWidth="2.4" />
      <rect x="11.5" y="11.5" width="3" height="3" rx="0.8" fill="#22d3ee" />
      <rect x="22" y="8" width="10" height="10" rx="3" fill="none" stroke="url(#ee-logo)" strokeWidth="2.4" />
      <rect x="25.5" y="11.5" width="3" height="3" rx="0.8" fill="#a78bfa" />
      <rect x="8" y="22" width="10" height="10" rx="3" fill="none" stroke="url(#ee-logo)" strokeWidth="2.4" />
      <rect x="11.5" y="25.5" width="3" height="3" rx="0.8" fill="#f472b6" />
      <path
        d="M22.5 27.5l3.2 3.2 6.3-7"
        fill="none"
        stroke="#34d399"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="font-display text-[1.05rem] font-semibold tracking-tight text-white">
      Event<span className="text-gradient">Ease</span>
    </span>
  );
}
