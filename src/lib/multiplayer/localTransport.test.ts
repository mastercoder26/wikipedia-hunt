import { afterEach, describe, expect, it, vi } from 'vitest'
import { localTransport } from '@/lib/multiplayer/localTransport'

describe('localTransport', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips a room through localStorage', async () => {
    const host = { id: 'h1', name: 'Host', color: '#fff' }
    const room = await localTransport.create(host, { revealArticles: true })
    expect(room.code).toHaveLength(4)

    const joined = await localTransport.join(room.code.toLowerCase(), {
      id: 'g1',
      name: 'Guest',
      color: '#000',
    })
    expect(joined.players).toHaveLength(2)

    const fetched = await localTransport.get(room.code)
    expect(fetched?.players.map((p) => p.id)).toEqual(['h1', 'g1'])

    const challenge = {
      id: 'c1',
      start: { title: 'A', key: 'A' },
      target: { title: 'B', key: 'B' },
      category: 'science' as const,
      difficulty: 'easy' as const,
    }
    await localTransport.setChallenge(room.code, 'h1', challenge)
    await expect(localTransport.setChallenge(room.code, 'g1', challenge)).rejects.toThrow(/host/i)

    const started = await localTransport.startRace(room.code, 'h1', 0)
    expect(started.status).toBe('countdown')
    expect((await localTransport.get(room.code))?.status).toBe('racing')

    await localTransport.patchPlayer(room.code, 'g1', { clicks: 3 })
    expect((await localTransport.get(room.code))?.players[1].clicks).toBe(3)

    await localTransport.leave(room.code, 'h1')
    expect((await localTransport.get(room.code))?.hostId).toBe('g1')
    await localTransport.leave(room.code, 'g1')
    expect(await localTransport.get(room.code)).toBeNull()
  })

  it('falls back safely when localStorage starts throwing during a room read', async () => {
    const storage = {
      getItem: vi.fn((key: string) => {
        if (key === 'wikidash:room:') return null
        throw new Error('storage denied')
      }),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    }
    vi.stubGlobal('localStorage', storage)

    await expect(localTransport.get('ZZZZ')).resolves.toBeNull()
  })
})
