import type { Challenge, PathStep, RaceResult } from '@/lib/types'

function safeMilliseconds(milliseconds: number): number {
  return Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(safeMilliseconds(milliseconds) / 1_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatDurationPrecise(milliseconds: number): string {
  const totalTenths = Math.floor(safeMilliseconds(milliseconds) / 100)
  const minutes = Math.floor(totalTenths / 600)
  const seconds = Math.floor((totalTenths % 600) / 10)
  const tenths = totalTenths % 10
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
}

export function formatClicks(clicks: number): string {
  return `${clicks} ${clicks === 1 ? 'click' : 'clicks'}`
}

export function formatPathArrow(path: readonly PathStep[]): string {
  return path.map((step) => step.title).join(' → ')
}

export function buildShareCard(
  result: RaceResult,
  challenge: Challenge,
  dailyNumber?: number,
): string {
  return [
    // Solo and live runs share the same card minus the puzzle number, so a
    // pasted result always reads the same shape.
    dailyNumber === undefined ? 'WikiDash' : `WikiDash #${dailyNumber}`,
    `${challenge.start.title} → ${challenge.target.title}`,
    `${formatDuration(result.durationMs)} • ${formatClicks(result.clicks)}`,
    `Route: ${formatPathArrow(result.path)}`,
  ].join('\n')
}
