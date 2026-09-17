import { describe, expect, it } from 'vitest'
import type { Challenge, PlayerProfile, RoomSettings, RoomState } from '@/lib/types'
import {
  MAX_PLAYERS,
  addPlayer,
  applyPlayerPatch,
  createRoom,
  deriveStatus,
  pruneStale,
  rematch,
  removePlayer,
  setChallenge,
  startRace,
} from '@/lib/multiplayer/roomLogic'

const NOW = 1_700_000_000_000

const SETTINGS: RoomSettings = { revealArticles: true }

const CHALLENGE: Challenge = {
  id: 'ch-1',
  start: { title: 'Apollo 11', key: 'Apollo_11' },
  target: { title: 'Cheese', key: 'Cheese' },
  category: 'science',
  difficulty: 'easy',
}

function profile(id: string, name = `Player ${id}`): PlayerProfile {
  return { id, name, color: '#ff0000' }
}

function roomWith(count: number, now = NOW): RoomState {
  let room = createRoom('ABCD', profile('p1', 'Host'), SETTINGS, now)
  for (let i = 2; i <= count; i += 1) {
    room = addPlayer(room, profile(`p${i}`), now)
  }
  return room
}

/** Deep-equal snapshot used to prove a function did not mutate its input. */
function snapshot(room: RoomState): string {
  return JSON.stringify(room)
}

describe('createRoom', () => {
  it('starts in the lobby with the creator as host', () => {
    const room = createRoom('ABCD', profile('p1', 'Host'), SETTINGS, NOW)

    expect(room.status).toBe('lobby')
    expect(room.hostId).toBe('p1')
    expect(room.players).toHaveLength(1)
    expect(room.players[0].isHost).toBe(true)
    expect(room.version).toBe(1)
  })
})

describe('addPlayer', () => {
  it('rejects a 9th player', () => {
    const full = roomWith(MAX_PLAYERS)

    expect(full.players).toHaveLength(MAX_PLAYERS)
    expect(() => addPlayer(full, profile('p9'), NOW)).toThrow(/full/i)
  })

  it('suffixes duplicate names', () => {
    const room = addPlayer(
      addPlayer(createRoom('ABCD', profile('p1', 'Ada'), SETTINGS, NOW), profile('p2', 'Ada'), NOW),
      profile('p3', 'Ada'),
      NOW,
    )

    expect(room.players.map((player) => player.name)).toEqual(['Ada', 'Ada 2', 'Ada 3'])
  })

  it('caps names at 16 characters', () => {
    const room = addPlayer(
      createRoom('ABCD', profile('p1', 'Host'), SETTINGS, NOW),
      profile('p2', 'AbsurdlyLongPlayerName'),
      NOW,
    )

    expect(room.players[1].name).toBe('AbsurdlyLongPlaye'.slice(0, 16))
  })

  it('does not mutate the input room', () => {
    const room = roomWith(2)
    const before = snapshot(room)

    addPlayer(room, profile('p3'), NOW)

    expect(snapshot(room)).toBe(before)
    expect(room.players).toHaveLength(2)
  })

  it('bumps the version', () => {
    const room = roomWith(2)

    expect(addPlayer(room, profile('p3'), NOW).version).toBe(room.version + 1)
  })
})

describe('removePlayer', () => {
  it('reassigns the host to the longest-standing remaining player', () => {
    const room = roomWith(3)

    const next = removePlayer(room, 'p1')

    expect(next).not.toBeNull()
    expect(next?.hostId).toBe('p2')
    expect(next?.players[0].isHost).toBe(true)
    expect(next?.players[1].isHost).toBe(false)
  })

  it('returns null when the room empties', () => {
    const room = roomWith(1)

    expect(removePlayer(room, 'p1')).toBeNull()
  })

  it('does not mutate the input room', () => {
    const room = roomWith(3)
    const before = snapshot(room)

    removePlayer(room, 'p1')

    expect(snapshot(room)).toBe(before)
  })
})

describe('applyPlayerPatch', () => {
  it('merges the patch and refreshes lastSeen', () => {
    const room = roomWith(2)
    const before = snapshot(room)

    const next = applyPlayerPatch(room, 'p2', { clicks: 7, state: 'racing' }, NOW + 500)

    expect(next.players[1].clicks).toBe(7)
    expect(next.players[1].state).toBe('racing')
    expect(next.players[1].lastSeen).toBe(NOW + 500)
    expect(snapshot(room)).toBe(before)
  })

  it('ignores attempts to grab the host flag', () => {
    const room = roomWith(2)

    const next = applyPlayerPatch(room, 'p2', { isHost: true }, NOW)

    expect(next.players[1].isHost).toBe(false)
  })

  it('throws for an unknown player', () => {
    expect(() => applyPlayerPatch(roomWith(2), 'nope', { clicks: 1 }, NOW)).toThrow(/not in this room/i)
  })
})

describe('startRace', () => {
  it('sets countdown, startsAt and resets every player', () => {
    const dirty = applyPlayerPatch(
      setChallenge(roomWith(2), CHALLENGE),
      'p2',
      { clicks: 12, path: ['A', 'B'], state: 'finished' },
      NOW,
    )
    const before = snapshot(dirty)

    const next = startRace(dirty, 3000, NOW)

    expect(next.status).toBe('countdown')
    expect(next.startsAt).toBe(NOW + 3000)
    expect(next.players.every((player) => player.state === 'racing')).toBe(true)
    expect(next.players.every((player) => player.clicks === 0)).toBe(true)
    expect(next.players.every((player) => player.path?.length === 0)).toBe(true)
    expect(snapshot(dirty)).toBe(before)
  })

  it('refuses to start without a challenge', () => {
    expect(() => startRace(roomWith(2), 3000, NOW)).toThrow(/challenge/i)
  })
})

describe('deriveStatus', () => {
  it('flips countdown to racing once startsAt passes', () => {
    const counting = startRace(setChallenge(roomWith(2), CHALLENGE), 3000, NOW)

    expect(deriveStatus(counting, NOW + 2999).status).toBe('countdown')
    expect(deriveStatus(counting, NOW + 3000).status).toBe('racing')
  })

  it('flips to finished once everyone is finished or surrendered', () => {
    const racing = deriveStatus(
      startRace(setChallenge(roomWith(2), CHALLENGE), 0, NOW),
      NOW,
    )
    expect(racing.status).toBe('racing')

    const oneDone = applyPlayerPatch(racing, 'p1', { state: 'finished' }, NOW)
    expect(deriveStatus(oneDone, NOW + 10).status).toBe('racing')

    const allDone = applyPlayerPatch(oneDone, 'p2', { state: 'surrendered' }, NOW)
    expect(deriveStatus(allDone, NOW + 20).status).toBe('finished')
  })

  it('returns the same object and version when nothing changed', () => {
    const room = roomWith(2)

    expect(deriveStatus(room, NOW)).toBe(room)
  })

  it('does not mutate the input room', () => {
    const counting = startRace(setChallenge(roomWith(2), CHALLENGE), 3000, NOW)
    const before = snapshot(counting)

    deriveStatus(counting, NOW + 5000)

    expect(snapshot(counting)).toBe(before)
  })
})

describe('rematch', () => {
  it('returns everyone to the lobby with the new challenge', () => {
    const finished = applyPlayerPatch(
      startRace(setChallenge(roomWith(2), CHALLENGE), 0, NOW),
      'p1',
      { state: 'finished', clicks: 5, durationMs: 42 },
      NOW,
    )

    const next = rematch(finished, { ...CHALLENGE, id: 'ch-2' }, NOW)

    expect(next.status).toBe('lobby')
    expect(next.startsAt).toBeNull()
    expect(next.challenge?.id).toBe('ch-2')
    expect(next.players.every((player) => player.state === 'lobby')).toBe(true)
    expect(next.players.every((player) => player.durationMs === undefined)).toBe(true)
  })
})

describe('pruneStale', () => {
  it('drops players unseen for longer than the ttl', () => {
    const room = roomWith(3)
    const stale = applyPlayerPatch(room, 'p3', {}, NOW - 60_000)
    const before = snapshot(stale)

    const next = pruneStale(stale, NOW, 30_000)

    expect(next?.players.map((player) => player.id)).toEqual(['p1', 'p2'])
    expect(snapshot(stale)).toBe(before)
  })

  it('reassigns the host when the host goes stale', () => {
    const room = roomWith(3)
    const stale = applyPlayerPatch(room, 'p1', {}, NOW - 60_000)

    const next = pruneStale(stale, NOW, 30_000)

    expect(next?.hostId).toBe('p2')
    expect(next?.players[0].isHost).toBe(true)
  })

  it('returns the same object when nobody is stale', () => {
    const room = roomWith(3)

    expect(pruneStale(room, NOW, 30_000)).toBe(room)
  })

  it('returns null when everybody is stale', () => {
    const room = roomWith(2)

    expect(pruneStale(room, NOW + 60_000, 30_000)).toBeNull()
  })
})
