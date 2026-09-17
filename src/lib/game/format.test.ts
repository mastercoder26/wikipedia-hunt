import { describe, expect, it } from 'vitest'

import type { Challenge, RaceResult } from '@/lib/types'

import {
  buildShareCard,
  formatClicks,
  formatDuration,
  formatDurationPrecise,
  formatPathArrow,
} from './format'

const challenge: Challenge = {
  id: 'daily-18',
  start: { title: 'Beagle', key: 'Beagle' },
  target: { title: 'Apollo 11', key: 'Apollo_11' },
  category: 'science',
  difficulty: 'medium',
}

const result: RaceResult = {
  challengeId: challenge.id,
  mode: 'daily',
  durationMs: 102_000,
  clicks: 7,
  path: [
    { title: 'Beagle', key: 'Beagle', at: 0, viaBack: false },
    { title: 'Dog', key: 'Dog', at: 20_000, viaBack: false },
    { title: 'United States', key: 'United_States', at: 50_000, viaBack: false },
    { title: 'NASA', key: 'NASA', at: 80_000, viaBack: false },
    { title: 'Apollo 11', key: 'Apollo_11', at: 102_000, viaBack: false },
  ],
  finishedAt: 0,
  surrendered: false,
}

describe('game formatting', () => {
  it('formats durations, clicks, and paths', () => {
    expect(formatDuration(102_000)).toBe('1:42')
    expect(formatDurationPrecise(723_400)).toBe('12:03.4')
    expect(formatClicks(1)).toBe('1 click')
    expect(formatClicks(7)).toBe('7 clicks')
    expect(formatPathArrow(result.path)).toBe('Beagle → Dog → United States → NASA → Apollo 11')
  })

  it('builds the exact share card', () => {
    expect(buildShareCard(result, challenge, 18)).toBe(
      'WikiDash #18\n' +
        'Beagle → Apollo 11\n' +
        '1:42 • 7 clicks\n' +
        'Route: Beagle → Dog → United States → NASA → Apollo 11',
    )
  })
})
