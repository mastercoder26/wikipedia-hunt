import { describe, expect, it } from 'vitest'
import { HostSession } from '@/lib/multiplayer/hostSession'
import { createRoom } from '@/lib/multiplayer/roomLogic'
import type { Challenge, PlayerProfile } from '@/lib/types'

const HOST: PlayerProfile = { id: 'host', name: 'Ada', color: '#111' }
const GUEST: PlayerProfile = { id: 'guest', name: 'Bob', color: '#222' }

const CHALLENGE: Challenge = {
  id: 'c1',
  start: { title: 'A', key: 'A' },
  target: { title: 'B', key: 'B' },
  category: 'science',
  difficulty: 'easy',
}

function session(now = 1_000) {
  return new HostSession(createRoom('ABCD', HOST, { revealArticles: false }, now))
}

describe('HostSession', () => {
  it('adds a guest and keeps the host', () => {
    const host = session()
    const room = host.apply({ type: 'join', profile: GUEST }, 1_100)
    expect(room?.players.map((player) => player.id)).toEqual(['host', 'guest'])
    expect(room?.hostId).toBe('host')
  })

  it('rejects host-only actions from a guest', () => {
    const host = session()
    host.apply({ type: 'join', profile: GUEST }, 1_100)
    expect(() =>
      host.apply({ type: 'challenge', hostId: 'guest', challenge: CHALLENGE }, 1_200),
    ).toThrow(/host/i)
  })

  it('starts a race from the host and resets clicks', () => {
    const host = session()
    host.apply({ type: 'join', profile: GUEST }, 1_100)
    host.apply({ type: 'challenge', hostId: 'host', challenge: CHALLENGE }, 1_200)
    const room = host.apply({ type: 'start', hostId: 'host', countdownMs: 5_000 }, 2_000)
    expect(room?.status).toBe('countdown')
    expect(room?.startsAt).toBe(7_000)
    expect(room?.players.every((player) => player.clicks === 0)).toBe(true)
  })

  it('returns null after the last player leaves', () => {
    const host = session()
    expect(host.apply({ type: 'leave', playerId: 'host' }, 1_100)).toBeNull()
    expect(host.snapshot(1_200)).toBeNull()
  })

  it('returns the current room for get after pruning nobody', () => {
    const host = session()
    const room = host.apply({ type: 'get' }, 1_050)
    expect(room?.code).toBe('ABCD')
    expect(room?.players).toHaveLength(1)
  })
})
