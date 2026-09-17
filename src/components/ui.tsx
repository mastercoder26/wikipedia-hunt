import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  // The primary action is ink, not the accent. The accent is saved for the
  // target and for state, so it keeps meaning something.
  primary: 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)] hover:opacity-90 shadow-[var(--shadow-float)]',
  accent: 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)] hover:opacity-90 shadow-[var(--shadow-float)]',
  secondary: 'bg-[var(--raised)] text-[var(--ink)] border-[var(--rule)] hover:border-[var(--ink)] shadow-[var(--shadow-float)]',
  ghost: 'bg-transparent text-[var(--ink-2)] border-transparent hover:text-[var(--ink)] hover:bg-[var(--paper-2)]',
  danger: 'bg-transparent text-[var(--ink-3)] border-[var(--rule)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[13px] gap-1.5',
  md: 'h-10 px-5 text-[14px] gap-2',
  lg: 'h-12 px-7 text-[15px] gap-2',
}

// Pills. Set in the interface face at a readable size rather than as tracked
// uppercase micro-type, so a button reads as something to press.
const BASE =
  'press inline-flex items-center justify-center rounded-full border font-medium select-none whitespace-nowrap disabled:opacity-35 disabled:pointer-events-none'

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`} {...rest} />
}

export function ButtonLink({
  to,
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
}: {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  )
}

/** A raised surface. Soft radius and a low shadow, never a hard box. */
export function Panel({
  children,
  className = '',
  as: As = 'div',
  bordered = true,
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'li'
  bordered?: boolean
}) {
  return (
    <As
      className={`rounded-[var(--radius)] bg-[var(--raised)] ${
        bordered ? 'border border-[var(--rule-soft)]' : ''
      } shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </As>
  )
}

/** Section marker: a short rule, then a tracked uppercase label. */
export function Eyebrow({
  children,
  index,
  className = '',
}: {
  children: ReactNode
  index?: string
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {index ? (
        <span className="inline-flex items-center rounded-full bg-[var(--accent-wash)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
          {index}
        </span>
      ) : null}
      <span className="eyebrow">{children}</span>
    </span>
  )
}

/**
 * A pill label. `frosted` is for sitting on top of an image, where the
 * backdrop is unknown; the default tint is for a solid surface, where a
 * translucent pill would simply disappear.
 */
export function Tag({
  children,
  tone = 'neutral',
  frosted = false,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'good'
  frosted?: boolean
}) {
  const tones = {
    neutral: 'text-[var(--ink-2)] bg-[var(--paper-2)]',
    accent: 'text-[var(--accent)] bg-[var(--accent-wash)]',
    good: 'text-[var(--good)] bg-[var(--accent-wash)]',
  }
  const frostTones = {
    neutral: 'text-[var(--ink)]',
    accent: 'text-[var(--accent)]',
    good: 'text-[var(--good)]',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium leading-none ${
        frosted ? `frost ${frostTones[tone]}` : tones[tone]
      }`}
    >
      {children}
    </span>
  )
}

/**
 * The stat treatment from the reference: a serif figure sitting directly on a
 * hairline rule, with a tracked uppercase label underneath. No box.
 */
export function Stat({
  value,
  label,
  hint,
  accent = false,
  size = 'md',
}: {
  value: ReactNode
  label: string
  hint?: string
  accent?: boolean
  size?: 'md' | 'lg'
}) {
  return (
    <div>
      <div
        className={`display display-lg tnum ${size === 'lg' ? 'text-[46px]' : 'text-[34px]'} ${
          // An unset value should read as absent, not as an accent.
          value === '—' ? 'text-[var(--ink-3)] opacity-40' : accent ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-[13px] text-[var(--ink-3)]">{label}</div>
      {hint ? <div className="mt-0.5 text-[12px] text-[var(--ink-3)] opacity-70">{hint}</div> : null}
    </div>
  )
}

export function SectionHeader({
  children,
  index,
  action,
  className = '',
}: {
  children: ReactNode
  index?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-end justify-between gap-4 mb-6 ${className}`}>
      <div>
        {index ? <Eyebrow index={index}>{children}</Eyebrow> : <span className="eyebrow">{children}</span>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="py-16 max-w-md">
      <h2 className="display display-lg text-[38px] text-[var(--ink)]">{title}</h2>
      <p className="mt-4 text-[15px] text-[var(--ink-2)] leading-relaxed">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}

/** A full-width hairline. */
export function Rule({ strong = false, className = '' }: { strong?: boolean; className?: string }) {
  return <hr className={`border-0 h-px ${strong ? 'bg-[var(--ink)]' : 'bg-[var(--rule)]'} ${className}`} />
}
