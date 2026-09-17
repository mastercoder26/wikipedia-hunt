// Daily Dash: one shared puzzle per calendar day.
//
// Everything here is derived from the player's *local* calendar date, so "today"
// always matches the date on their wall. The challenge itself is chosen by a pure
// hash of that date key, which means every player on a given day gets the exact
// same race without any server round trip.

import type { Challenge } from '@/lib/types'
import { CHALLENGES } from './challenges'

/** Day 1 of the Daily Dash: 2026-01-01, local time. */
const EPOCH_YEAR = 2026
const EPOCH_MONTH = 0
const EPOCH_DAY = 1

const MS_PER_DAY = 86_400_000

/** How many copies of each difficulty go into the pool. Medium carries the daily. */
const DIFFICULTY_WEIGHTS = { easy: 1, medium: 3, hard: 1 } as const

/**
 * Curated daily pool: the whole catalog, sorted by id so the pool order never
 * depends on file ordering, and weighted toward medium difficulty.
 */
const DAILY_POOL: Challenge[] = [...CHALLENGES]
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  .flatMap((challenge) =>
    Array.from({ length: DIFFICULTY_WEIGHTS[challenge.difficulty] }, () => challenge),
  )

/** Midnight-local for the calendar day of `date`, expressed as a UTC-normalised timestamp. */
function localMidnightIndex(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** FNV-1a, 32-bit. Small, pure, dependency-free and stable across engines. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    // hash *= 16777619, kept in 32-bit range without overflowing to float.
    hash = Math.imul(hash, 0x01000193)
  }
  // Coerce to an unsigned 32-bit integer.
  return hash >>> 0
}

/** Local calendar date as `YYYY-MM-DD`. */
export function dailyDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Puzzle number counting from the launch epoch. 2026-01-01 is puzzle 1. */
export function dailyNumber(date: Date = new Date()): number {
  const epoch = Date.UTC(EPOCH_YEAR, EPOCH_MONTH, EPOCH_DAY)
  const elapsed = localMidnightIndex(date) - epoch
  return Math.round(elapsed / MS_PER_DAY) + 1
}

/**
 * The challenge for a given local day. Deterministic: the same date key always
 * hashes to the same pool entry, everywhere. The returned challenge keeps the
 * pool entry's start/target but carries a daily-scoped id.
 */
export function dailyChallenge(date: Date = new Date()): Challenge {
  const key = dailyDateKey(date)
  const picked = DAILY_POOL[fnv1a(key) % DAILY_POOL.length]
  return { ...picked, id: `daily-${key}` }
}

/** Milliseconds until the next local midnight. Always within (0, 86400000]. */
export function msUntilNextDaily(now: Date = new Date()): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  return nextMidnight.getTime() - now.getTime()
}
