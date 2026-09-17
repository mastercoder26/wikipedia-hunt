import type { Transition } from 'motion/react'

/**
 * Spring presets, in Apple's two designer-facing parameters rather than
 * mass/stiffness/damping. `bounce: 0` is critically damped (no overshoot) and
 * `duration` is the response, not a fixed runtime: a spring has no duration,
 * its settle time emerges from the parameters.
 *
 * Bounce is reserved for motion the user's own gesture set going. Overshoot on
 * a panel that merely appeared reads as decoration; overshoot on something
 * flicked reads as physics.
 */
export const SPRING = {
  /** Default for anything that moves without a gesture behind it. */
  ui: { type: 'spring', bounce: 0, duration: 0.4 },
  /** Snappier, for small elements and in-place value changes. */
  quick: { type: 'spring', bounce: 0, duration: 0.28 },
  /** Momentum interactions: sheets, overlays, anything thrown. */
  momentum: { type: 'spring', bounce: 0.22, duration: 0.42 },
  /** A surface arriving. Paired with blur and scale so it materializes. */
  surface: { type: 'spring', bounce: 0.12, duration: 0.36 },
} satisfies Record<string, Transition>

/** Cross-fade replacement used whenever the user asked for reduced motion. */
export const REDUCED: Transition = { duration: 0.18, ease: 'easeOut' }

/** Entrance: rises into place, never slides sideways. */
export const rise = {
  hidden: { opacity: 0, y: 14 },
  shown: { opacity: 1, y: 0 },
}

/** A surface materializing rather than fading: blur and scale move together. */
export const materialize = {
  hidden: { opacity: 0, scale: 0.97, filter: 'blur(6px)' },
  shown: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  gone: { opacity: 0, scale: 0.98, filter: 'blur(4px)' },
}

/** Staggered container. Children inherit the parent's variant name. */
export function staggered(step = 0.045, delay = 0) {
  return {
    hidden: {},
    shown: { transition: { staggerChildren: step, delayChildren: delay } },
  }
}
