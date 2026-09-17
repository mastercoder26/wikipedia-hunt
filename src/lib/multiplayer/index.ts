// Public entry point for the multiplayer layer: transport selection plus the
// `useRoom` polling hook. UI code should only ever import from here.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RoomState } from '@/lib/types'
import type { RoomTransport, TransportKind } from '@/lib/multiplayer/transport'
import { localTransport } from '@/lib/multiplayer/localTransport'
import { httpTransport } from '@/lib/multiplayer/httpTransport'
import { webrtcTransport } from '@/lib/multiplayer/webrtcTransport'

export type { RoomTransport, TransportKind } from '@/lib/multiplayer/transport'
export { localTransport } from '@/lib/multiplayer/localTransport'
export { httpTransport } from '@/lib/multiplayer/httpTransport'
export { webrtcTransport } from '@/lib/multiplayer/webrtcTransport'
export {
  generateRoomCode,
  normalizeRoomCode,
  isValidRoomCode,
  ROOM_CODE_LENGTH,
} from '@/lib/multiplayer/roomCode'
export {
  MAX_PLAYERS,
  MAX_NAME_LENGTH,
  STALE_PLAYER_TTL_MS,
  RoomError,
} from '@/lib/multiplayer/roomLogic'

/** Poll cadence per room status (ms). Racing needs a tighter loop. */
export const POLL_INTERVAL_MS = { idle: 1000, racing: 600 } as const
export const HEARTBEAT_INTERVAL_MS = 5000

const configured = import.meta.env.VITE_MULTIPLAYER as string | undefined

let activeKind: TransportKind =
  configured === 'local' ? 'local' : configured === 'http' ? 'http' : 'webrtc'

function transportFor(kind: TransportKind): RoomTransport {
  if (kind === 'http') return httpTransport
  if (kind === 'local') return localTransport
  return webrtcTransport
}

/**
 * The transport to use right now. Defaults to WebRTC. Pin with
 * VITE_MULTIPLAYER=local, http, or webrtc.
 */
export function getTransport(): RoomTransport {
  return transportFor(activeKind)
}

/**
 * The transport, guaranteed to be the final choice. Entry points that create or
 * join a room await this first: picking `local` for the write and then flipping
 * to `http` for the reads would strand the player in a room nobody can see.
 */
export async function getReadyTransport(): Promise<RoomTransport> {
  await resolveTransport()
  return getTransport()
}

export function getTransportKind(): TransportKind {
  return activeKind
}

/** Resolves the transport. WebRTC is the default unless VITE_MULTIPLAYER pins another. */
export function resolveTransport(): Promise<TransportKind> {
  return Promise.resolve(activeKind)
}

export interface UseRoomResult {
  room: RoomState | null
  error: string | null
  loading: boolean
  refresh: () => Promise<void>
}

function intervalFor(room: RoomState | null): number {
  return room?.status === 'racing' || room?.status === 'countdown'
    ? POLL_INTERVAL_MS.racing
    : POLL_INTERVAL_MS.idle
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

interface RoomSession {
  key: string | null
  room: RoomState | null
  error: string | null
  loading: boolean
}

/**
 * Polls the room, deduping on `version`, and heartbeats the local player so the
 * server can prune them if the tab goes away. Polling stops while the tab is
 * hidden and resumes on focus; all timers are cleared on unmount.
 */
export function useRoom(code: string | null, playerId: string | null): UseRoomResult {
  // The room, its error and its loading flag are stored together with the
  // session key they belong to, so switching rooms can never show a stale room
  // for a frame and nothing has to be reset during render.
  const key = code ? `${code}:${playerId ?? ''}` : null
  const keyRef = useRef(key)
  useLayoutEffect(() => {
    keyRef.current = key
  }, [key])

  const [session, setSession] = useState<RoomSession>(() => ({
    key,
    room: null,
    error: null,
    loading: Boolean(code),
  }))

  const roomRef = useRef<RoomState | null>(null)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const beatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const mounted = useRef(true)

  const patchSession = useCallback(
    (partial: Partial<RoomSession>) => {
      setSession((prev) => {
        const base: RoomSession =
          prev.key === key ? prev : { key, room: null, error: null, loading: true }
        return { ...base, ...partial, key }
      })
    },
    [key],
  )

  /** Applies a fetched room, skipping renders when `version` did not move. */
  const commit = useCallback(
    (next: RoomState | null) => {
      const current = roomRef.current
      if (next && current && next.version === current.version && next.code === current.code) {
        return
      }
      roomRef.current = next
      patchSession({ room: next })
    },
    [patchSession],
  )

  const fetchRoom = useCallback(async () => {
    if (!code) return
    try {
      const next = await getTransport().get(code)
      if (!mounted.current || keyRef.current !== key) return
      commit(next)
      patchSession({ error: next ? null : `Room ${code} was not found`, loading: false })
    } catch (caught) {
      if (!mounted.current || keyRef.current !== key) return
      patchSession({
        error: caught instanceof Error ? caught.message : 'Could not load the room',
        loading: false,
      })
    }
  }, [code, key, commit, patchSession])

  useEffect(() => {
    mounted.current = true
    roomRef.current = null

    if (!code) {
      return () => {
        mounted.current = false
      }
    }

    const clearTimers = () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
      if (beatTimer.current) clearInterval(beatTimer.current)
      pollTimer.current = null
      beatTimer.current = null
    }

    const loop = () => {
      if (!mounted.current || isHidden()) return
      void fetchRoom().finally(() => {
        if (!mounted.current || keyRef.current !== key || isHidden()) return
        if (pollTimer.current) clearTimeout(pollTimer.current)
        pollTimer.current = setTimeout(loop, intervalFor(roomRef.current))
      })
    }

    const beat = () => {
      if (!playerId || !mounted.current || isHidden()) return
      void getTransport()
        .patchPlayer(code, playerId, { lastSeen: Date.now() })
        .then((next) => {
          if (mounted.current && keyRef.current === key) commit(next)
        })
        .catch(() => {
          // A dropped heartbeat is not fatal; the next poll reports the truth.
        })
    }

    const start = () => {
      if (isHidden()) return
      loop()
      if (!beatTimer.current) beatTimer.current = setInterval(beat, HEARTBEAT_INTERVAL_MS)
    }

    const onVisibility = () => {
      if (isHidden()) {
        clearTimers()
        return
      }
      start()
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)

    return () => {
      mounted.current = false
      clearTimers()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [code, playerId, key, fetchRoom, commit])

  const refresh = useCallback(async () => {
    await fetchRoom()
  }, [fetchRoom])

  const view: RoomSession =
    session.key === key ? session : { key, room: null, error: null, loading: Boolean(code) }

  return { room: view.room, error: view.error, loading: view.loading, refresh }
}
