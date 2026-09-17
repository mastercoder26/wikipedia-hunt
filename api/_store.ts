// Room storage adapter with two backends.
//
// 1. Upstash Redis over its REST API. THIS IS THE PRODUCTION PATH. Enabled by
//    setting UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Rooms live
//    under `wikidash:room:<CODE>` as JSON with a 2 hour TTL.
// 2. An in-module Map with the same TTL semantics. THIS ONLY WORKS RELIABLY ON
//    A SINGLE INSTANCE: every Vercel lambda instance gets its own Map and the
//    memory disappears when the instance is recycled, so two players can easily
//    land on two instances and never see each other. It exists purely so
//    `vercel dev` works with no external services. Never ship a deployment that
//    relies on it. Configure Upstash instead.

import type { RoomState } from '../src/lib/types'

export const ROOM_KEY_PREFIX = 'wikidash:room:'
export const ROOM_TTL_SECONDS = 2 * 60 * 60

export interface RoomStore {
  readonly backend: 'upstash' | 'memory'
  get(code: string): Promise<RoomState | null>
  set(code: string, room: RoomState): Promise<void>
  remove(code: string): Promise<void>
}

function keyFor(code: string): string {
  return `${ROOM_KEY_PREFIX}${code}`
}

function parseRoom(raw: string | null): RoomState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as RoomState
    return parsed && typeof parsed.code === 'string' ? parsed : null
  } catch {
    return null
  }
}

// --- Upstash Redis (production) ---------------------------------------------

function createUpstashStore(url: string, token: string): RoomStore {
  const endpoint = url.replace(/\/+$/, '')

  async function command(args: (string | number)[]): Promise<unknown> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(args),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Upstash request failed (${response.status}): ${detail.slice(0, 200)}`)
    }

    const body = (await response.json()) as { result?: unknown; error?: string }
    if (body.error) throw new Error(`Upstash error: ${body.error}`)
    return body.result ?? null
  }

  return {
    backend: 'upstash',
    async get(code) {
      const result = await command(['GET', keyFor(code)])
      return parseRoom(typeof result === 'string' ? result : null)
    },
    async set(code, room) {
      await command(['SET', keyFor(code), JSON.stringify(room), 'EX', ROOM_TTL_SECONDS])
    },
    async remove(code) {
      await command(['DEL', keyFor(code)])
    },
  }
}

// --- In-memory (local `vercel dev` only) ------------------------------------

interface MemoryEntry {
  room: RoomState
  expiresAt: number
}

const memory = new Map<string, MemoryEntry>()

function createMemoryStore(): RoomStore {
  return {
    backend: 'memory',
    async get(code) {
      const entry = memory.get(keyFor(code))
      if (!entry) return null
      if (Date.now() > entry.expiresAt) {
        memory.delete(keyFor(code))
        return null
      }
      // Clone so callers can never mutate what is "stored".
      return JSON.parse(JSON.stringify(entry.room)) as RoomState
    },
    async set(code, room) {
      memory.set(keyFor(code), {
        room: JSON.parse(JSON.stringify(room)) as RoomState,
        expiresAt: Date.now() + ROOM_TTL_SECONDS * 1000,
      })
    },
    async remove(code) {
      memory.delete(keyFor(code))
    },
  }
}

let cached: RoomStore | null = null

export function getStore(): RoomStore {
  if (cached) return cached

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  cached = url && token ? createUpstashStore(url, token) : createMemoryStore()
  return cached
}
