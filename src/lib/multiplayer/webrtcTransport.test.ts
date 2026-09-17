import { describe, expect, it } from 'vitest'
import { createMemorySignaling } from '@/lib/multiplayer/signaling'
import { createWebRtcTransport } from '@/lib/multiplayer/webrtcTransport'
import type { PlayerProfile } from '@/lib/types'

const HOST: PlayerProfile = { id: 'host', name: 'Ada', color: '#111' }
const GUEST: PlayerProfile = { id: 'guest', name: 'Bob', color: '#222' }

describe('WebRTC room transport', () => {
  it('lets a second client join the host room over a data channel', async () => {
    const signaling = createMemorySignaling()
    const hostTransport = createWebRtcTransport(signaling)
    const guestTransport = createWebRtcTransport(signaling)

    const created = await hostTransport.create(HOST, { revealArticles: false })
    const joined = await guestTransport.join(created.code, GUEST)

    expect(joined.players.map((player) => player.id)).toEqual(['host', 'guest'])
    expect(await hostTransport.get(created.code)).toMatchObject({
      code: created.code,
      players: [{ id: 'host' }, { id: 'guest' }],
    })
  })

  it('fails to join when nobody is hosting that code', async () => {
    const signaling = createMemorySignaling()
    const guestTransport = createWebRtcTransport(signaling)
    await expect(guestTransport.join('ABCD', GUEST)).rejects.toThrow(/not found|host/i)
  })
})
