/**
 * A meridian globe whose right edge becomes a race flag. Drawn on a 32x32
 * grid so it holds up as a favicon and as a header mark.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="14" cy="16" r="10.5" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="14" cy="16" rx="4.6" ry="10.5" stroke="currentColor" strokeWidth="1.3" opacity=".6" />
      <path d="M3.9 12.4h20.2M3.9 19.6h20.2" stroke="currentColor" strokeWidth="1.3" opacity=".6" />
      <path d="M22 4.5v23" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M22 5.6c2.6-1.5 5.2 1.5 7.8 0v8.2c-2.6 1.5-5.2-1.5-7.8 0V5.6Z"
        fill="var(--accent)"
      />
      <path d="M24.6 5.1v8.4M27.2 6.6v8.4" stroke="var(--paper)" strokeWidth="1.1" opacity=".55" />
    </svg>
  )
}

export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span
      className="display leading-none text-[var(--ink)] tracking-[-0.03em] font-bold"
      style={{ fontSize: size }}
    >
      WikiDash
    </span>
  )
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-[var(--ink)]">
      <LogoMark size={size} />
      {/* The wordmark is dropped on narrow screens so the nav fits. */}
      <Wordmark size={size * 0.85} />
    </span>
  )
}
