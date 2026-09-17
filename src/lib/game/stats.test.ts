import { describe, expect, it } from 'vitest'

import type { RaceResult } from '@/lib/types'
import type { GameStorageState, StoredRaceResult } from './storage'

import {
  averageClicks,
  bestTimeMs,
  dailyStreak,
  favoriteCategory,
  personalRecords,
  recentRoutes,
  totalRaces,
  wins,
} from './stats'

function race(overrides: Partial<StoredRaceResult> = {}): StoredRaceResult {
  return {
    challengeId: 'challenge',
    mode: 'solo',
    durationMs: 10_000,
    clicks: 4,
    path: [{ title: 'A', key: 'A', at: 0, viaBack: false }],
    finishedAt: 1,
    surrendered: false,
    ...overrides,
  }
}

function state(overrides: Partial<GameStorageState> = {}): GameStorageState {
  return {
    version: 1,
    profile: { name: '', color: '#000000' },
    races: [],
    dailyResults: {},
    dailyTimeResults: {},
    personalBests: {},
    ...overrides,
  }
}

describe('stats derivations', () => {
  it('counts a streak through yesterday when today is not completed', () => {
    const today = new Date(2026, 8, 17, 12)
    const daily = state({
      dailyResults: {
        '2026-09-16': race(),
        '2026-09-15': race(),
        '2026-09-14': race(),
      },
    })

    expect(dailyStreak(daily, today)).toBe(3)
  })

  it('stops a daily streak at the first real calendar gap', () => {
    const today = new Date(2026, 8, 17, 12)
    const daily = state({
      dailyResults: {
        '2026-09-16': race(),
        '2026-09-14': race(),
      },
    })

    expect(dailyStreak(daily, today)).toBe(1)
  })

  it('derives summary, win, category, record, and recent-route data immutably', () => {
    const older = race({
      challengeId: 'old',
      mode: 'live',
      won: true,
      category: 'science',
      durationMs: 8_000,
      clicks: 3,
      finishedAt: 10,
    })
    const newer = race({
      challengeId: 'new',
      category: 'history',
      durationMs: 12_000,
      clicks: 7,
      finishedAt: 20,
    })
    const data = state({
      races: [older, newer],
      personalBests: { old: older as RaceResult },
    })

    expect(totalRaces(data)).toBe(2)
    expect(wins(data)).toBe(1)
    expect(bestTimeMs(data)).toBe(8_000)
    expect(averageClicks(data)).toBe(5)
    expect(favoriteCategory(data)).toBe('history')
    expect(personalRecords(data)).toHaveLength(1)
    expect(recentRoutes(data, 1)[0]?.challengeId).toBe('new')
    expect(data.races).toEqual([older, newer])
  })
})
