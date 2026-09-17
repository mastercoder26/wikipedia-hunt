import { useEffect, useState } from 'react'

/** Ticks 10x a second off a fixed start timestamp, so it never drifts. */
export function useElapsed(startedAt: number | null, frozenAt: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt || frozenAt) return
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [startedAt, frozenAt])
  if (!startedAt) return 0
  return Math.max(0, (frozenAt ?? now) - startedAt)
}
