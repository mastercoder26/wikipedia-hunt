import { HostSession, type HostAction } from '@/lib/multiplayer/hostSession'
import { createRoom, RoomError } from '@/lib/multiplayer/roomLogic'
import { generateRoomCode, normalizeRoomCode } from '@/lib/multiplayer/roomCode'
import { peerIdFor } from '@/lib/multiplayer/peerId'
import type { DataLink, Signaling } from '@/lib/multiplayer/signaling'
import type {
  Challenge,
  PlayerProfile,
  RoomPlayer,
  RoomSettings,
  RoomState,
} from '@/lib/types'
import type { RoomTransport } from '@/lib/multiplayer/transport'
import { createPeerJsSignaling } from '@/lib/multiplayer/peerJsSignaling'

const MAX_CODE_ATTEMPTS = 25
const RPC_TIMEOUT_MS = 8_000

type Envelope =
  | { kind: 'req'; id: string; action: HostAction }
  | { kind: 'res'; id: string; ok: true; room: RoomState | null }
  | { kind: 'res'; id: string; ok: false; error: string }
  | { kind: 'state'; room: RoomState | null }

function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null) return false
  const kind = (value as { kind?: unknown }).kind
  return kind === 'req' || kind === 'res' || kind === 'state'
}

function requestId(): string {
  const cryptoRef = globalThis.crypto
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID()
  return `r-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

interface HostHandle {
  code: string
  session: HostSession
  guests: Map<DataLink, string | null>
  stopListening: () => void
}

interface GuestHandle {
  code: string
  link: DataLink
  cache: RoomState | null
  pending: Map<
    string,
    {
      resolve: (room: RoomState | null) => void
      reject: (error: Error) => void
    }
  >
  unsubscribe: () => void
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function rpc(handle: GuestHandle, action: HostAction): Promise<RoomState | null> {
  const id = requestId()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      handle.pending.delete(id)
      reject(new Error('The host did not respond'))
    }, RPC_TIMEOUT_MS)
    handle.pending.set(id, {
      resolve: (room) => {
        window.clearTimeout(timer)
        resolve(room)
      },
      reject: (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    })
    handle.link.send({ kind: 'req', id, action } satisfies Envelope)
  })
}

function requireRoom(room: RoomState | null, code: string): RoomState {
  if (!room) throw new RoomError(`Room ${code} was not found`, 404)
  return room
}

export function createWebRtcTransport(signaling: Signaling): RoomTransport {
  const hosts = new Map<string, HostHandle>()
  const guests = new Map<string, GuestHandle>()

  function broadcast(handle: HostHandle, room: RoomState | null) {
    const message: Envelope = { kind: 'state', room }
    for (const link of handle.guests.keys()) {
      link.send(message)
    }
  }

  function attachGuestLink(handle: HostHandle, link: DataLink) {
    handle.guests.set(link, null)
    const unsubscribe = link.subscribe((payload) => {
      if (!isEnvelope(payload) || payload.kind !== 'req') return
      try {
        const room = handle.session.apply(payload.action)
        if (payload.action.type === 'join') {
          handle.guests.set(link, payload.action.profile.id)
        }
        if (payload.action.type === 'leave') {
          handle.guests.set(link, null)
        }
        link.send({ kind: 'res', id: payload.id, ok: true, room } satisfies Envelope)
        broadcast(handle, room)
        if (!room) {
          teardownHost(handle.code)
        }
      } catch (error) {
        link.send({
          kind: 'res',
          id: payload.id,
          ok: false,
          error: errorMessage(error, 'The host rejected that'),
        } satisfies Envelope)
      }
    })
    const previousClose = link.close.bind(link)
    link.close = () => {
      unsubscribe()
      const playerId = handle.guests.get(link)
      handle.guests.delete(link)
      if (playerId) {
        const room = handle.session.apply({ type: 'leave', playerId })
        broadcast(handle, room)
        if (!room) teardownHost(handle.code)
      }
      previousClose()
    }
  }

  function teardownHost(code: string) {
    const handle = hosts.get(code)
    if (!handle) return
    hosts.delete(code)
    for (const link of handle.guests.keys()) {
      link.send({ kind: 'state', room: null } satisfies Envelope)
      link.close()
    }
    handle.stopListening()
  }

  function attachGuest(code: string, link: DataLink): GuestHandle {
    const handle: GuestHandle = {
      code,
      link,
      cache: null,
      pending: new Map(),
      unsubscribe: () => undefined,
    }
    handle.unsubscribe = link.subscribe((payload) => {
      if (!isEnvelope(payload)) return
      if (payload.kind === 'state') {
        handle.cache = payload.room
        return
      }
      if (payload.kind !== 'res') return
      const waiter = handle.pending.get(payload.id)
      if (!waiter) return
      handle.pending.delete(payload.id)
      if (payload.ok) {
        handle.cache = payload.room
        waiter.resolve(payload.room)
      } else {
        waiter.reject(new Error(payload.error))
      }
    })
    guests.set(code, handle)
    return handle
  }

  async function guestRpc(code: string, action: HostAction): Promise<RoomState> {
    const handle = guests.get(code)
    if (!handle) throw new RoomError(`Room ${code} was not found`, 404)
    return requireRoom(await rpc(handle, action), code)
  }

  return {
    async create(profile: PlayerProfile, settings: RoomSettings): Promise<RoomState> {
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
        const code = generateRoomCode()
        const peerId = peerIdFor(code)
        try {
          const session = new HostSession(
            createRoom(code, profile, settings, Date.now()),
          )
          const handle: HostHandle = {
            code,
            session,
            guests: new Map(),
            stopListening: () => undefined,
          }
          handle.stopListening = await signaling.listen(peerId, (link) => {
            attachGuestLink(handle, link)
            link.send({ kind: 'state', room: session.snapshot() } satisfies Envelope)
          })
          hosts.set(code, handle)
          return requireRoom(session.snapshot(), code)
        } catch (error) {
          const message = errorMessage(error, '')
          if (/already in use|unavailable/i.test(message) && attempt < MAX_CODE_ATTEMPTS - 1) {
            continue
          }
          throw new RoomError(errorMessage(error, 'Could not open a room'), 503)
        }
      }
      throw new RoomError('Could not allocate a room code, try again', 503)
    },

    async join(code: string, profile: PlayerProfile): Promise<RoomState> {
      const normalized = normalizeRoomCode(code)
      const hosted = hosts.get(normalized)
      if (hosted) {
        return requireRoom(hosted.session.apply({ type: 'join', profile }), normalized)
      }
      let handle = guests.get(normalized)
      if (!handle) {
        const link = await signaling.connect(peerIdFor(normalized))
        handle = attachGuest(normalized, link)
      }
      return guestRpc(normalized, { type: 'join', profile })
    },

    async leave(code: string, playerId: string): Promise<void> {
      const normalized = normalizeRoomCode(code)
      const hosted = hosts.get(normalized)
      if (hosted) {
        const room = hosted.session.apply({ type: 'leave', playerId })
        broadcast(hosted, room)
        if (!room) teardownHost(normalized)
        return
      }
      const handle = guests.get(normalized)
      if (!handle) return
      try {
        await rpc(handle, { type: 'leave', playerId })
      } catch {
        // Host already gone.
      }
      handle.unsubscribe()
      handle.link.close()
      guests.delete(normalized)
    },

    async get(code: string): Promise<RoomState | null> {
      const normalized = normalizeRoomCode(code)
      const hosted = hosts.get(normalized)
      if (hosted) return hosted.session.snapshot()
      const handle = guests.get(normalized)
      if (!handle) return null
      try {
        return await rpc(handle, { type: 'get' })
      } catch {
        return handle.cache
      }
    },

    async patchPlayer(
      code: string,
      playerId: string,
      patch: Partial<RoomPlayer>,
    ): Promise<RoomState> {
      const normalized = normalizeRoomCode(code)
      const hosted = hosts.get(normalized)
      if (hosted) {
        const room = hosted.session.apply({ type: 'patch', playerId, patch })
        broadcast(hosted, room)
        return requireRoom(room, normalized)
      }
      return guestRpc(normalized, { type: 'patch', playerId, patch })
    },

    async setChallenge(code: string, hostId: string, challenge: Challenge): Promise<RoomState> {
      const normalized = normalizeRoomCode(code)
      const hosted = hosts.get(normalized)
      if (hosted) {
        const room = hosted.session.apply({ type: 'challenge', hostId, challenge })
        broadcast(hosted, room)
        return requireRoom(room, normalized)
      }
      return guestRpc(normalized, { type: 'challenge', hostId, challenge })
    },

    async setSettings(code: string, hostId: string, settings: RoomSettings): Promise<RoomState> {
      const normalized = normalizeRoomCode(code)
      const hosted = hosts.get(normalized)
      if (hosted) {
        const room = hosted.session.apply({ type: 'settings', hostId, settings })
        broadcast(hosted, room)
        return requireRoom(room, normalized)
      }
      return guestRpc(normalized, { type: 'settings', hostId, settings })
    },

    async startRace(code: string, hostId: string, countdownMs: number): Promise<RoomState> {
      const normalized = normalizeRoomCode(code)
      const hosted = hosts.get(normalized)
      if (hosted) {
        const room = hosted.session.apply({ type: 'start', hostId, countdownMs })
        broadcast(hosted, room)
        return requireRoom(room, normalized)
      }
      return guestRpc(normalized, { type: 'start', hostId, countdownMs })
    },

    async rematch(code: string, hostId: string, challenge: Challenge): Promise<RoomState> {
      const normalized = normalizeRoomCode(code)
      const hosted = hosts.get(normalized)
      if (hosted) {
        const room = hosted.session.apply({ type: 'rematch', hostId, challenge })
        broadcast(hosted, room)
        return requireRoom(room, normalized)
      }
      return guestRpc(normalized, { type: 'rematch', hostId, challenge })
    },
  }
}

export const webrtcTransport = createWebRtcTransport(createPeerJsSignaling())
