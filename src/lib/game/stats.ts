import type { Category } from '@/lib/types'
import type { GameStorageState, StoredRaceResult } from './storage'

function cloneResult(result: StoredRaceResult): StoredRaceResult {
  return { ...result, path: result.path.map((step) => ({ ...step })) }
}

function completedRaces(state: GameStorageState): StoredRaceResult[] {
  return state.races.filter((race) => !race.surrendered)
}

export function totalRaces(state: GameStorageState): number {
  return state.races.length
}

/** Wins are live results explicitly recorded with `won: true` by the room layer. */
export function wins(state: GameStorageState): number {
  return state.races.filter(
    (race) => race.mode === 'live' && race.won === true && !race.surrendered,
  ).length
}

export function bestTimeMs(state: GameStorageState): number | null {
  const durations = completedRaces(state).map((race) => race.durationMs)
  return durations.length === 0 ? null : Math.min(...durations)
}

export function averageClicks(state: GameStorageState): number {
  const races = completedRaces(state)
  if (races.length === 0) return 0
  return races.reduce((sum, race) => sum + race.clicks, 0) / races.length
}

export function favoriteCategory(state: GameStorageState): Category | null {
  const categoryStats = new Map<Category, { count: number; latest: number }>()
  for (const race of completedRaces(state)) {
    if (race.category === undefined) continue
    const current = categoryStats.get(race.category) ?? { count: 0, latest: 0 }
    categoryStats.set(race.category, {
      count: current.count + 1,
      latest: Math.max(current.latest, race.finishedAt),
    })
  }

  const ranked = [...categoryStats.entries()].sort(
    ([leftCategory, left], [rightCategory, right]) =>
      right.count - left.count ||
      right.latest - left.latest ||
      leftCategory.localeCompare(rightCategory),
  )
  return ranked[0]?.[0] ?? null
}

function localDateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dailyStreak(state: GameStorageState, today: Date = new Date()): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  // A player has until local midnight to finish today's daily, so yesterday may
  // anchor the active streak while today's entry is absent.
  if (state.dailyResults[localDateKey(cursor)] === undefined) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (state.dailyResults[localDateKey(cursor)] !== undefined) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function personalRecords(state: GameStorageState): StoredRaceResult[] {
  return Object.entries(state.personalBests)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, result]) => cloneResult(result))
}

export function recentRoutes(
  state: GameStorageState,
  limit: number = 5,
): StoredRaceResult[] {
  return state.races
    .filter((race) => race.path.length > 0)
    .map(cloneResult)
    .sort((left, right) => right.finishedAt - left.finishedAt)
    .slice(0, Math.max(0, Math.floor(limit)))
}
