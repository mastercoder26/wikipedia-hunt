import type { ReactNode } from 'react'
import { m, useReducedMotion } from 'motion/react'
import { REDUCED, SPRING, rise, staggered } from '@/lib/motion'

/**
 * Entrance animation for a page section. Reduced motion keeps the fade and
 * drops the travel, which is the point of the setting: a gentler equivalent,
 * not the absence of feedback.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'header'
}) {
  const reduced = useReducedMotion()
  const Component = m[as]
  return (
    <Component
      initial="hidden"
      animate="shown"
      variants={rise}
      transition={reduced ? REDUCED : { ...SPRING.ui, delay }}
      className={className}
    >
      {children}
    </Component>
  )
}

/** Wraps a list so its rows arrive one after another rather than all at once. */
export function RevealStagger({
  children,
  className = '',
  step = 0.045,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  step?: number
  delay?: number
}) {
  const reduced = useReducedMotion()
  return (
    <m.div
      initial="hidden"
      animate="shown"
      variants={reduced ? undefined : staggered(step, delay)}
      className={className}
    >
      {children}
    </m.div>
  )
}

export function RevealItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <m.div variants={rise} transition={reduced ? REDUCED : SPRING.ui} className={className}>
      {children}
    </m.div>
  )
}
