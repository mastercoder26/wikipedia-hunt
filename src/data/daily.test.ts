import { describe, expect, it } from 'vitest'
import { dailyChallenge, dailyDateKey, dailyNumber, msUntilNextDaily } from './daily'

/** Local-time constructor, so tests exercise the same calendar the players see. */
function localDate(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour, 0, 0, 0)
}

describe('dailyDateKey', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(dailyDateKey(localDate(2026, 1, 1))).toBe('2026-01-01')
    expect(dailyDateKey(localDate(2026, 9, 7))).toBe('2026-09-07')
    expect(dailyDateKey(localDate(2026, 12, 31))).toBe('2026-12-31')
  })

  it('does not shift across the UTC boundary late at night', () => {
    // Arrange: 23:30 local on the 17th.
    const lateNight = localDate(2026, 3, 17, 23)
    lateNight.setMinutes(30)

    // Act & Assert: still the 17th, whatever the runner's timezone.
    expect(dailyDateKey(lateNight)).toBe('2026-03-17')
  })
})

describe('dailyNumber', () => {
  it('is 1 on the launch epoch of 2026-01-01', () => {
    expect(dailyNumber(localDate(2026, 1, 1))).toBe(1)
  })

  it('is stable across every hour of the same local day', () => {
    const hours = [0, 6, 12, 18, 23].map((hour) => dailyNumber(localDate(2026, 1, 1, hour)))
    expect(new Set(hours).size).toBe(1)
  })

  it('increments by exactly 1 per day for a long run of consecutive days', () => {
    // Arrange: 400 consecutive days, crossing DST changes and a year boundary.
    const numbers = Array.from({ length: 400 }, (_, offset) =>
      dailyNumber(localDate(2026, 1, 1 + offset)),
    )

    // Act
    const deltas = numbers.slice(1).map((value, index) => value - numbers[index])

    // Assert
    expect(numbers[0]).toBe(1)
    expect(new Set(deltas)).toEqual(new Set([1]))
  })

  it('goes negative or zero before the epoch', () => {
    expect(dailyNumber(localDate(2025, 12, 31))).toBe(0)
    expect(dailyNumber(localDate(2025, 12, 25))).toBe(-6)
  })
})

describe('dailyChallenge', () => {
  it('returns the same challenge for repeated calls on the same date', () => {
    const first = dailyChallenge(localDate(2026, 9, 17))
    const second = dailyChallenge(localDate(2026, 9, 17))

    expect(first).toEqual(second)
  })

  it('ignores the time of day within a local date', () => {
    const morning = dailyChallenge(localDate(2026, 9, 17, 1))
    const evening = dailyChallenge(localDate(2026, 9, 17, 23))

    expect(morning).toEqual(evening)
  })

  it('tags the challenge id with the daily date key', () => {
    expect(dailyChallenge(localDate(2026, 9, 17)).id).toBe('daily-2026-09-17')
  })

  it('keeps a real start and target from the catalog', () => {
    const challenge = dailyChallenge(localDate(2026, 5, 4))

    expect(challenge.start.title.length).toBeGreaterThan(0)
    expect(challenge.start.key).toBe(challenge.start.title.replace(/ /g, '_'))
    expect(challenge.target.key).toBe(challenge.target.title.replace(/ /g, '_'))
    expect(challenge.start.title).not.toBe(challenge.target.title)
  })

  it('usually differs between different dates', () => {
    // Arrange: a year of dailies.
    const pairs = Array.from({ length: 365 }, (_, offset) => {
      const challenge = dailyChallenge(localDate(2026, 1, 1 + offset))
      return `${challenge.start.title}->${challenge.target.title}`
    })

    // Assert: plenty of variety, and adjacent days rarely repeat.
    const distinct = new Set(pairs)
    expect(distinct.size).toBeGreaterThan(60)

    const adjacentRepeats = pairs.slice(1).filter((pair, index) => pair === pairs[index]).length
    expect(adjacentRepeats).toBeLessThan(20)
  })

  it('leans toward medium difficulty but still shows easy and hard', () => {
    const difficulties = Array.from({ length: 365 }, (_, offset) =>
      dailyChallenge(localDate(2026, 1, 1 + offset)).difficulty,
    )
    const count = (value: string) => difficulties.filter((d) => d === value).length

    expect(count('medium')).toBeGreaterThan(count('easy'))
    expect(count('medium')).toBeGreaterThan(count('hard'))
    expect(count('easy')).toBeGreaterThan(0)
    expect(count('hard')).toBeGreaterThan(0)
  })
})

describe('msUntilNextDaily', () => {
  it('stays within (0, 86400000] across the whole day', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const ms = msUntilNextDaily(localDate(2026, 6, 10, hour))
      expect(ms).toBeGreaterThan(0)
      expect(ms).toBeLessThanOrEqual(86_400_000)
    }
  })

  it('is a full day at exactly local midnight', () => {
    expect(msUntilNextDaily(localDate(2026, 6, 10, 0))).toBe(86_400_000)
  })

  it('counts down as the day progresses', () => {
    const morning = msUntilNextDaily(localDate(2026, 6, 10, 9))
    const evening = msUntilNextDaily(localDate(2026, 6, 10, 21))

    expect(evening).toBeLessThan(morning)
  })

  it('works with the default argument', () => {
    const ms = msUntilNextDaily()
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(86_400_000)
  })
})
