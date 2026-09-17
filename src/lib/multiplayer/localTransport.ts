// Zero-backend transport: localStorage is the source of truth (shared by every
// tab on the machine) and BroadcastChannel is the change notification. When
// BroadcastChannel is missing we fall back to the `storage` event, and when
// localStorage itself is unavailable (SSR, hardened private mode) we degrade to
// an in-memory Map so the app still runs for a single tab.

import type {
  Challenge,
  PlayerProfile,
  RoomPlayer,
  RoomSettings,
  RoomState,
} from '@/lib/types'
import type { RoomTransport } from '@/lib/multiplayer/transport'
import { generateRoomCode, normalizeRoomCode } from '@/lib/multiplayer/roomCode'
import {
  ROOM_TTL_MS,
  RoomError,
  STALE_PLAYER_TTL_MS,
  addPlayer,
  applyPlayerPatch,
  assertHost,
  createRoom,
  deriveStatus,
  pruneStale,
  rematch,
  removePlayer,
  setChallenge,
  setSettings,
  startRace,
} from '@/lib/multiplayer/roomLogic'

const STORAGE_PREFIX = 'wikidash:room:'
const CHANNEL_NAME = 'wikidash:rooms'
const MAX_CODE_ATTEMPTS = 25

interface RoomEnvelope {
  state: RoomState
  updatedAt: number
}

type RoomListener = (code: string) => void

const memoryStore = new Map<string, RoomEnvelope>()
const listeners = new Set<RoomListener>()

let channel: BroadcastChannel | null = null
let wired = false

function storageKey(code: string): string {
  return `${STORAGE_PREFIX}${code}`
}

function safeLocalStorage(): Storage | null {
  try {
    const store = globalThis.localStorage
    if (!store) return null
    // Touch it: Safari throws here when storage is blocked.
    store.getItem(STORAGE_PREFIX)
    return store
  } catch {
    return null
  }
}

function notify(code: string): void {
  for (const listener of listeners) listener(code)
}

function ensureWired(): void {
  if (wired || typeof window === 'undefined') return
  wired = true

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (event: MessageEvent<{ code?: string }>) => {
        const code = event.data?.code
        if (typeof code === 'string') notify(code)
      }
      return
    } catch {
      channel = null
    }
  }

  // Fallback for browsers (or embedded webviews) without BroadcastChannel.
  window.addEventListener('storage', (event) => {
    if (event.key && event.key.startsWith(STORAGE_PREFIX)) {
      notify(event.key.slice(STORAGE_PREFIX.length))
    }
  })
}

function broadcast(code: string): void {
  ensureWired()
  notify(code)
  try {
    channel?.postMessage({ code })
  } catch {
    // A closed channel must never break a write.
  }
}

function readEnvelope(code: string, now: number): RoomEnvelope | null {
  const store = safeLocalStorage()
  let envelope: RoomEnvelope | null = null

  if (store) {
    try {
      const raw = store.getItem(storageKey(code))
      if (raw) {
        const parsed = JSON.parse(raw) as RoomEnvelope
        if (parsed?.state?.code) envelope = parsed
      }
    } catch {
      try {
        store.removeItem(storageKey(code))
      } catch {
        // Storage can become unavailable after the initial capability check.
      }
      envelope = memoryStore.get(code) ?? null
    }
  } else {
    envelope = memoryStore.get(code) ?? null
  }

  if (!envelope) return null
  if (now - envelope.updatedAt > ROOM_TTL_MS) {
    deleteRoom(code)
    return null
  }
  return envelope
}

function writeRoom(state: RoomState, now: number): RoomState {
  const envelope: RoomEnvelope = { state, updatedAt: now }
  const store = safeLocalStorage()
  if (store) {
    try {
      store.setItem(storageKey(state.code), JSON.stringify(envelope))
    } catch (error) {
      throw new RoomError(
        `Could not save the room locally: ${error instanceof Error ? error.message : 'storage full'}`,
        507,
      )
    }
  } else {
    memoryStore.set(state.code, envelope)
  }
  broadcast(state.code)
  return state
}

function deleteRoom(code: string): void {
  const store = safeLocalStorage()
  if (store) {
    try {
      store.removeItem(storageKey(code))
    } catch {
      // The in-memory copy is still cleared below when storage is revoked.
    }
  }
  memoryStore.delete(code)
  broadcast(code)
}

/** Reads, prunes stale players and advances status. Never writes. */
function loadRoom(code: string, now: number): RoomState | null {
  const envelope = readEnvelope(code, now)
  if (!envelope) return null

  const pruned = pruneStale(envelope.state, now, STALE_PLAYER_TTL_MS)
  if (!pruned) return null
  return deriveStatus(pruned, now)
}

function requireRoom(code: string, now: number): RoomState {
  const room = loadRoom(code, now)
  if (!room) throw new RoomError(`Room ${code} was not found`, 404)
  return room
}

function pickFreeCode(now: number): string {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode()
    if (!readEnvelope(code, now)) return code
  }
  throw new RoomError('Could not allocate a room code, try again', 503)
}

/** Subscribe to cross-tab room changes. Returns an unsubscribe function. */
export function subscribeToRooms(listener: RoomListener): () => void {
  ensureWired()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const localTransport: RoomTransport = {
  async create(profile: PlayerProfile, settings: RoomSettings): Promise<RoomState> {
    const now = Date.now()
    const code = pickFreeCode(now)
    return writeRoom(createRoom(code, profile, settings, now), now)
  },

  async join(code: string, profile: PlayerProfile): Promise<RoomState> {
    const now = Date.now()
    const normalized = normalizeRoomCode(code)
    const room = requireRoom(normalized, now)
    return writeRoom(addPlayer(room, profile, now), now)
  },

  async leave(code: string, playerId: string): Promise<void> {
    const now = Date.now()
    const normalized = normalizeRoomCode(code)
    const room = loadRoom(normalized, now)
    if (!room) return

    const next = removePlayer(room, playerId)
    if (!next) {
      deleteRoom(normalized)
      return
    }
    writeRoom(next, now)
  },

  async get(code: string): Promise<RoomState | null> {
    return loadRoom(normalizeRoomCode(code), Date.now())
  },

  async patchPlayer(
    code: string,
    playerId: string,
    patch: Partial<RoomPlayer>,
  ): Promise<RoomState> {
    const now = Date.now()
    const normalized = normalizeRoomCode(code)
    const room = requireRoom(normalized, now)
    const patched = applyPlayerPatch(room, playerId, patch, now)
    return writeRoom(deriveStatus(patched, now), now)
  },

  async setChallenge(code: string, hostId: string, challenge: Challenge): Promise<RoomState> {
    const now = Date.now()
    const room = requireRoom(normalizeRoomCode(code), now)
    assertHost(room, hostId)
    return writeRoom(setChallenge(room, challenge), now)
  },

  async setSettings(code: string, hostId: string, settings: RoomSettings): Promise<RoomState> {
    const now = Date.now()
    const room = requireRoom(normalizeRoomCode(code), now)
    assertHost(room, hostId)
    return writeRoom(setSettings(room, settings), now)
  },

  async startRace(code: string, hostId: string, countdownMs: number): Promise<RoomState> {
    const now = Date.now()
    const room = requireRoom(normalizeRoomCode(code), now)
    assertHost(room, hostId)
    return writeRoom(startRace(room, countdownMs, now), now)
  },

  async rematch(code: string, hostId: string, challenge: Challenge): Promise<RoomState> {
    const now = Date.now()
    const room = requireRoom(normalizeRoomCode(code), now)
    assertHost(room, hostId)
    return writeRoom(rematch(room, challenge, now), now)
  },
}
