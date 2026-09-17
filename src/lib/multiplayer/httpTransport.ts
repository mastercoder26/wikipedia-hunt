// HTTP transport: talks to the Vercel serverless functions under /api/room/*.
// The server owns the room state, so this file is a thin, well-typed fetch
// wrapper that turns `{ ok: false, error }` payloads into readable Errors.

import type {
  Challenge,
  PlayerProfile,
  RoomPlayer,
  RoomSettings,
  RoomState,
} from '@/lib/types'
import type { RoomTransport } from '@/lib/multiplayer/transport'
import { normalizeRoomCode } from '@/lib/multiplayer/roomCode'

export const API_BASE = '/api/room'

interface ApiEnvelope<T> {
  ok: boolean
  error?: string
  room?: T
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiEnvelope<unknown>
    if (typeof body?.error === 'string' && body.error) return body.error
  } catch {
    // Non-JSON error body (gateway timeout, HTML error page, ...).
  }
  return `${response.status} ${response.statusText || 'Request failed'}`
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'content-type': 'application/json' },
      ...init,
    })
  } catch (error) {
    throw new Error(
      `Could not reach the multiplayer server: ${
        error instanceof Error ? error.message : 'network error'
      }`,
    )
  }

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  try {
    return (await response.json()) as ApiEnvelope<T>
  } catch {
    throw new Error('The multiplayer server returned an invalid response')
  }
}

async function post(path: string, body: unknown): Promise<RoomState> {
  const payload = await request<RoomState>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!payload.room) throw new Error('The multiplayer server returned no room')
  return payload.room
}

/** Cheap liveness probe used to auto-select this transport. */
export async function probeApi(timeoutMs = 1500): Promise<boolean> {
  if (typeof fetch === 'undefined') return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE}/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    // A 200 is not enough. A dev server or a static host will happily answer
    // /api/room/health with the SPA's index.html, and treating that as a live
    // backend sends every later call into a JSON parse failure. The probe only
    // passes on a real JSON body that identifies itself as this API.
    if (!response.ok) return false
    if (!(response.headers.get('content-type') ?? '').includes('application/json')) return false
    const data = (await response.json()) as { ok?: unknown }
    return data?.ok === true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export const httpTransport: RoomTransport = {
  async create(profile: PlayerProfile, settings: RoomSettings): Promise<RoomState> {
    return post('/create', { profile, settings })
  },

  async join(code: string, profile: PlayerProfile): Promise<RoomState> {
    return post('/join', { code: normalizeRoomCode(code), profile })
  },

  async leave(code: string, playerId: string): Promise<void> {
    await request('/leave', {
      method: 'POST',
      body: JSON.stringify({ code: normalizeRoomCode(code), playerId }),
    })
  },

  async get(code: string): Promise<RoomState | null> {
    const normalized = normalizeRoomCode(code)
    const payload = await request<RoomState>(`/get?code=${encodeURIComponent(normalized)}`)
    return payload.room ?? null
  },

  async patchPlayer(
    code: string,
    playerId: string,
    patch: Partial<RoomPlayer>,
  ): Promise<RoomState> {
    return post('/patch', { code: normalizeRoomCode(code), playerId, patch })
  },

  async setChallenge(code: string, hostId: string, challenge: Challenge): Promise<RoomState> {
    return post('/challenge', { code: normalizeRoomCode(code), hostId, challenge })
  },

  async setSettings(code: string, hostId: string, settings: RoomSettings): Promise<RoomState> {
    return post('/settings', { code: normalizeRoomCode(code), hostId, settings })
  },

  async startRace(code: string, hostId: string, countdownMs: number): Promise<RoomState> {
    return post('/start', { code: normalizeRoomCode(code), hostId, countdownMs })
  },

  async rematch(code: string, hostId: string, challenge: Challenge): Promise<RoomState> {
    return post('/rematch', { code: normalizeRoomCode(code), hostId, challenge })
  },
}
