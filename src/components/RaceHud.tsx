import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { formatDuration } from '@/lib/game/format'
import { REDUCED, SPRING } from '@/lib/motion'
import type { PathStep } from '@/lib/types'

/** Big, mono and tabular. The timer is the loudest number on the screen. */
export function RaceTimer({ ms, large = false }: { ms: number; large?: boolean }) {
  return (
    <span
      className={`tnum font-mono tracking-[-0.02em] text-[var(--ink)] leading-none ${
        large ? 'text-[40px]' : 'text-[21px] sm:text-[25px]'
      }`}
    >
      {formatDuration(ms)}
    </span>
  )
}

export function ClickCounter({ clicks, limit }: { clicks: number; limit?: number }) {
  const spent = limit !== undefined && clicks >= limit
  const reduced = useReducedMotion()
  return (
    <span
      className={`tnum font-mono tracking-[-0.02em] leading-none text-[21px] sm:text-[25px] ${
        spent ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
      }`}
    >
      {/* The count is the only number that changes discretely, so it gets a
          small landing of its own rather than blinking to the next value. */}
      <span className="relative inline-block align-baseline">
        {/* Reserves the width so the counter cannot shift the header as it
            grows. Hidden from assistive tech: the animated span below is the
            one that carries the value. */}
        <span className="invisible" aria-hidden="true">
          {clicks}
        </span>
        <AnimatePresence initial={false}>
          <m.span
            key={clicks}
            className="absolute inset-0 text-right"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 7 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -7 }}
            transition={reduced ? REDUCED : SPRING.quick}
          >
            {clicks}
          </m.span>
        </AnimatePresence>
      </span>
      {limit !== undefined ? <span className="text-[var(--ink-3)] text-[15px]">/{limit}</span> : null}
    </span>
  )
}

/** Beagle → Dog → United States → NASA → Apollo 11 */
export function ProgressTrail({ path, compact = false }: { path: PathStep[]; compact?: boolean }) {
  if (path.length === 0) return null
  const shown = compact && path.length > 3 ? path.slice(-3) : path
  const truncated = shown.length < path.length

  return (
    <div className="flex items-center gap-1.5 flex-wrap text-[12px] text-[var(--ink-3)] min-w-0">
      {truncated ? <span className="shrink-0">+{path.length - shown.length}</span> : null}
      {shown.map((step, i) => (
        <span key={`${step.key}-${i}`} className="flex items-center gap-1.5 min-w-0">
          {i > 0 || truncated ? (
            <span aria-hidden="true" className="text-[var(--rule)]">
              →
            </span>
          ) : null}
          <span
            className={`truncate max-w-[13rem] ${i === shown.length - 1 ? 'text-[var(--ink)]' : ''} ${
              step.viaBack ? 'italic' : ''
            }`}
            title={step.viaBack ? `${step.title} (via back)` : step.title}
          >
            {step.title}
          </span>
        </span>
      ))}
    </div>
  )
}
