import { dailyDateKey } from '@/data/daily'
import { getProfile } from './storage'
import type { RaceResult } from '@/lib/types'

/**
 * Posts a finished Daily Dash to the global board. The server revalidates the
 * route against Wikipedia before it counts. A rejection here does not matter
 * to the player: the local record is already saved.
 */
export async function submitDaily(result: RaceResult): Promise<'posted' | 'rejected' | 'unavailable'> {
  if (result.surrendered || result.path.length < 2) return 'rejected'
  try {
    const res = await fetch('/api/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: dailyDateKey(new Date(result.finishedAt)),
        name: getProfile().name,
        durationMs: result.durationMs,
        clicks: result.clicks,
        path: result.path.map((step) => step.title),
      }),
    })
    if (res.status === 503 || res.status === 404) return 'unavailable'
    return res.ok ? 'posted' : 'rejected'
  } catch {
    return 'unavailable'
  }
}
