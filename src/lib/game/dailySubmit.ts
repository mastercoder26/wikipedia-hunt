import type { RaceResult } from '@/lib/types'

/** Daily board posting lands with the API. Until then a finish stays local. */
export async function submitDaily(_result: RaceResult): Promise<'posted' | 'rejected' | 'unavailable'> {
  return 'unavailable'
}
