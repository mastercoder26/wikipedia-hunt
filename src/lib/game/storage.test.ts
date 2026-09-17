import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Challenge, RaceResult } from '@/lib/types'

import {
  getProfile,
  loadState,
  recordRace,
  resetStats,
  saveState,
  setProfile,
} from './storage'

const challenge: Challenge = {
  id: 'daily-2026-09-17',
  start: { title: 'Beagle', key: 'Beagle' },
  target: { title: 'Apollo 11', key: 'Apollo_11' },
  category: 'science',
  difficulty: 'medium',
}

function result(overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    challengeId: challenge.id,
    mode: 'daily',
    durationMs: 90_000,
    clicks: 7,
    path: [
      { title: 'Beagle', key: 'Beagle', at: 0, viaBack: false },
      { title: 'Apollo 11', key: 'Apollo_11', at: 90_000, viaBack: false },
    ],
    finishedAt: new Date(2026, 8, 17, 12).getTime(),
    surrendered: false,
    ...overrides,
  }
}

describe('game storage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    resetStats()
  })

  it('round-trips cloned state and profile data', () => {
    setProfile({ name: 'Ada', color: '#ff00aa' })
    recordRace(result(), challenge)

    const loaded = loadState()
    loaded.races[0]?.path.splice(0)

    expect(getProfile()).toEqual({ name: 'Ada', color: '#ff00aa' })
    expect(loadState().races[0]?.path).toHaveLength(2)
  })

  it('survives a throwing localStorage by using memory persistence', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })

    setProfile({ name: 'Private', color: '#123456' })

    expect(getProfile()).toEqual({ name: 'Private', color: '#123456' })
  })

  it('keeps daily best-clicks and best-time records independently', () => {
    const quickButLong = result({ clicks: 8, durationMs: 40_000 })
    const fewerClicks = result({ clicks: 6, durationMs: 80_000 })
    const tiedClicksSlower = result({ clicks: 6, durationMs: 95_000 })
    const tiedClicksFaster = result({ clicks: 6, durationMs: 70_000 })

    recordRace(quickButLong, challenge)
    recordRace(fewerClicks, challenge)
    recordRace(tiedClicksSlower, challenge)
    recordRace(tiedClicksFaster, challenge)

    const state = loadState()
    const dateKey = '2026-09-17'
    expect(state.dailyResults[dateKey]).toMatchObject({ clicks: 6, durationMs: 70_000 })
    expect(state.dailyTimeResults[dateKey]).toMatchObject({ clicks: 8, durationMs: 40_000 })
  })

  it('caps race history to the latest 200 results', () => {
    const initial = loadState()
    saveState({
      ...initial,
      races: Array.from({ length: 205 }, (_, index) =>
        result({ finishedAt: index, durationMs: index + 1 }),
      ),
    })

    expect(loadState().races).toHaveLength(200)
    expect(loadState().races[0]?.finishedAt).toBe(204)
  })
})
