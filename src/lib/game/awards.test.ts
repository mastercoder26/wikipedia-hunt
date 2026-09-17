import { describe, expect, it } from 'vitest'

import type { RoomPlayer } from '@/lib/types'

import { computeAwards, mostUnusualArticle, shortestRoute } from './awards'

function player(overrides: Partial<RoomPlayer> & Pick<RoomPlayer, 'id'>): RoomPlayer {
  const { id, ...remainingOverrides } = overrides
  return {
    id,
    name: id,
    color: '#000000',
    isHost: false,
    state: 'finished',
    clicks: 5,
    durationMs: 10_000,
    path: ['Start', 'Target'],
    lastSeen: 0,
    ...remainingOverrides,
  }
}

describe('race awards', () => {
  it('assigns every award according to its metric', () => {
    const players = [
      player({ id: 'winner', durationMs: 10_000, clicks: 4, path: ['S', 'T'] }),
      player({ id: 'close', durationMs: 12_500, clicks: 3, path: ['S', 'A', 'T'] }),
      player({ id: 'wanderer', durationMs: 20_000, clicks: 8, path: ['S', 'A', 'B', 'C', 'T'] }),
    ]

    const byId = Object.fromEntries(computeAwards(players).map((award) => [award.id, award.playerId]))
    expect(byId).toEqual({
      speedrunner: 'winner',
      minimalist: 'close',
      explorer: 'wanderer',
      'photo-finish': 'close',
      'lost-in-the-wiki': 'wanderer',
    })
  })

  it('breaks metric ties by player id, independently of input order', () => {
    const players = [player({ id: 'zeta' }), player({ id: 'alpha' })]

    expect(computeAwards(players).map((award) => award.playerId)).toEqual([
      'alpha',
      'alpha',
      'alpha',
      'zeta',
      'alpha',
    ])
  })

  it('does not assign Photo Finish in a single-player race', () => {
    const awards = computeAwards([player({ id: 'solo' })])

    expect(awards.map((award) => award.id)).toEqual([
      'speedrunner',
      'minimalist',
      'explorer',
      'lost-in-the-wiki',
    ])
  })

  it('finds unusual articles and the shortest route deterministically', () => {
    const players = [
      player({ id: 'beta', path: ['Start', 'Very Obscure Article', 'Target'] }),
      player({ id: 'alpha', path: ['Start', 'Rare', 'Target'] }),
    ]

    expect(mostUnusualArticle(players)).toBe('Very Obscure Article')
    expect(shortestRoute(players)?.id).toBe('alpha')
  })
})
