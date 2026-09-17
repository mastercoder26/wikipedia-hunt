import type { ReactNode } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Logo } from './Logo'
import { ButtonLink } from './ui'
import { useTheme } from '@/hooks/useTheme'

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2 3.1 3.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a5.8 5.8 0 1 0 7 7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

const NAV = [
  { to: '/play', label: 'Solo' },
  { to: '/live', label: 'Live' },
  { to: '/daily', label: 'Daily' },
  { to: '/stats', label: 'Stats' },
]

/**
 * The nav floats over the page as its own object rather than occupying a band
 * across the top, so the content reads as continuous underneath it.
 */
export function Header() {
  const { resolved, toggle } = useTheme()
  return (
    <div className="sticky top-0 z-40 px-3 sm:px-5 pt-3 sm:pt-4 pointer-events-none">
      <header className="chrome pointer-events-auto mx-auto w-fit max-w-full rounded-full pl-4 pr-1.5 sm:pl-5 h-12 flex items-center gap-1 sm:gap-2">
        <Link to="/" aria-label="WikiDash home" className="shrink-0 mr-1 sm:mr-3">
          <Logo size={20} />
        </Link>

        <nav className="flex items-center gap-0.5 min-w-0">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `press px-2.5 sm:px-3.5 h-8 inline-flex items-center rounded-full text-[13.5px] font-medium whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--paper-2)] text-[var(--ink)]'
                    : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={toggle}
          aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="press shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-full text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--paper-2)]"
        >
          {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        <ButtonLink to="/play" variant="primary" size="sm" className="hidden sm:inline-flex shrink-0 shadow-none">
          Start a race
        </ButtonLink>
      </header>
    </div>
  )
}

export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-full flex flex-col bg-[var(--paper)]">
      <Header />
      <main
        className={`flex-1 w-full mx-auto px-5 sm:px-8 pt-10 sm:pt-16 pb-16 ${
          wide ? 'max-w-[1120px]' : 'max-w-3xl'
        }`}
      >
        {children}
      </main>
      <footer className="mt-10">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-8 py-8 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[13px] text-[var(--ink-3)]">
          <span className="font-medium text-[var(--ink-2)]">WikiDash</span>
          <span>Content from Wikipedia, CC BY-SA 4.0</span>
        </div>
      </footer>
    </div>
  )
}
