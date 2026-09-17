// Catch-all serverless endpoint for multiplayer rooms.
//
//   GET  /api/room/health
//   GET  /api/room/get?code=XXXX
//   POST /api/room/create | join | leave | patch | challenge | settings | start | rematch
//
// Every rule lives in src/lib/multiplayer/roomLogic so the client and the server
// can never drift. This file only does transport, validation and authorization.
// Host-only actions verify `hostId` against the stored room; the client is never
// trusted for that.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type {
  Challenge,
  PlayerProfile,
  RoomPlayer,
  RoomSettings,
  RoomState,
} from '../../src/lib/types'
import {
  MAX_NAME_LENGTH,
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
} from '../../src/lib/multiplayer/roomLogic'
import {
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from '../../src/lib/multiplayer/roomCode'
import { getStore } from '../_store'

const MAX_BODY_BYTES = 16 * 1024
const MAX_ID_LENGTH = 64
const MAX_TITLE_LENGTH = 256
const MAX_PATH_STEPS = 500
const MAX_CLICKS = 10_000
const MAX_COUNTDOWN_MS = 30_000
const MAX_CLICK_LIMIT = 500
const MAX_CODE_ATTEMPTS = 25

// --- validation -------------------------------------------------------------

function fail(message: string, status = 400): never {
  throw new RoomError(message, status)
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`)
  return value as Record<string, unknown>
}

function asString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') fail(`${label} must be a string`)
  const trimmed = value.trim()
  if (!trimmed) fail(`${label} is required`)
  if (trimmed.length > maxLength) fail(`${label} must be at most ${maxLength} characters`)
  return trimmed
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean`)
  return value
}

function asInt(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be a number`)
  const rounded = Math.round(value)
  if (rounded < min || rounded > max) fail(`${label} must be between ${min} and ${max}`)
  return rounded
}

function parseCode(value: unknown): string {
  if (typeof value !== 'string') fail('code is required')
  const code = normalizeRoomCode(value)
  if (!isValidRoomCode(code)) fail(`code must be ${ROOM_CODE_LENGTH} valid characters`, 400)
  return code
}

function parseProfile(value: unknown): PlayerProfile {
  const raw = asRecord(value, 'profile')
  return {
    id: asString(raw.id, 'profile.id', MAX_ID_LENGTH),
    name: asString(raw.name, 'profile.name', MAX_NAME_LENGTH),
    color: asString(raw.color, 'profile.color', 32),
  }
}

function parseSettings(value: unknown): RoomSettings {
  const raw = asRecord(value, 'settings')
  const settings: RoomSettings = { revealArticles: asBoolean(raw.revealArticles, 'settings.revealArticles') }
  if (raw.clickLimit === undefined || raw.clickLimit === null) return settings
  return { ...settings, clickLimit: asInt(raw.clickLimit, 'settings.clickLimit', 1, MAX_CLICK_LIMIT) }
}

function parseArticle(value: unknown, label: string): { title: string; key: string } {
  const raw = asRecord(value, label)
  return {
    title: asString(raw.title, `${label}.title`, MAX_TITLE_LENGTH),
    key: asString(raw.key, `${label}.key`, MAX_TITLE_LENGTH),
  }
}

const CATEGORIES = new Set([
  'science',
  'history',
  'sports',
  'geography',
  'entertainment',
  'technology',
  'random',
])
const DIFFICULTIES = new Set(['easy', 'medium', 'hard'])

function parseChallenge(value: unknown): Challenge {
  const raw = asRecord(value, 'challenge')
  const category = asString(raw.category, 'challenge.category', 32)
  const difficulty = asString(raw.difficulty, 'challenge.difficulty', 16)
  if (!CATEGORIES.has(category)) fail('challenge.category is not a known category')
  if (!DIFFICULTIES.has(difficulty)) fail('challenge.difficulty is not a known difficulty')

  const challenge: Challenge = {
    id: asString(raw.id, 'challenge.id', MAX_ID_LENGTH),
    start: parseArticle(raw.start, 'challenge.start'),
    target: parseArticle(raw.target, 'challenge.target'),
    category: category as Challenge['category'],
    difficulty: difficulty as Challenge['difficulty'],
  }
  return challenge
}

const PLAYER_STATES = new Set(['lobby', 'ready', 'racing', 'finished', 'surrendered'])

/** Only the fields a player is allowed to report about itself. */
function parsePatch(value: unknown): Partial<RoomPlayer> {
  const raw = asRecord(value, 'patch')
  const patch: Partial<RoomPlayer> = {}

  if (raw.state !== undefined) {
    const state = asString(raw.state, 'patch.state', 16)
    if (!PLAYER_STATES.has(state)) fail('patch.state is not a known player state')
    patch.state = state as RoomPlayer['state']
  }
  if (raw.clicks !== undefined) patch.clicks = asInt(raw.clicks, 'patch.clicks', 0, MAX_CLICKS)
  if (raw.durationMs !== undefined) {
    patch.durationMs = asInt(raw.durationMs, 'patch.durationMs', 0, Number.MAX_SAFE_INTEGER)
  }
  if (raw.currentArticle !== undefined) {
    patch.currentArticle = asString(raw.currentArticle, 'patch.currentArticle', MAX_TITLE_LENGTH)
  }
  if (raw.path !== undefined) {
    if (!Array.isArray(raw.path)) fail('patch.path must be an array')
    if (raw.path.length > MAX_PATH_STEPS) fail(`patch.path must have at most ${MAX_PATH_STEPS} steps`)
    patch.path = raw.path.map((step, index) => asString(step, `patch.path[${index}]`, MAX_TITLE_LENGTH))
  }
  if (raw.name !== undefined) patch.name = asString(raw.name, 'patch.name', MAX_NAME_LENGTH)
  if (raw.color !== undefined) patch.color = asString(raw.color, 'patch.color', 32)

  return patch
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body
  if (raw === undefined || raw === null || raw === '') return {}

  if (typeof raw === 'string') {
    if (raw.length > MAX_BODY_BYTES) fail('Request body is too large', 413)
    try {
      return asRecord(JSON.parse(raw), 'body')
    } catch (error) {
      if (error instanceof RoomError) throw error
      fail('Request body is not valid JSON')
    }
  }
  return asRecord(raw, 'body')
}

// --- storage helpers --------------------------------------------------------

const store = getStore()

/** Loads a room, prunes stale players and advances status before use. */
async function loadRoom(code: string, now: number): Promise<RoomState> {
  const stored = await store.get(code)
  if (!stored) fail(`Room ${code} was not found`, 404)

  const pruned = pruneStale(stored, now, STALE_PLAYER_TTL_MS)
  if (!pruned) {
    await store.remove(code)
    fail(`Room ${code} was not found`, 404)
  }

  const fresh = deriveStatus(pruned, now)
  if (fresh !== stored) await store.set(code, fresh)
  return fresh
}

async function save(room: RoomState): Promise<RoomState> {
  await store.set(room.code, room)
  return room
}

async function allocateCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode()
    if (!(await store.get(code))) return code
  }
  throw new RoomError('Could not allocate a room code, try again', 503)
}

// --- routes -----------------------------------------------------------------

function actionFrom(req: VercelRequest): string {
  const raw = req.query.action
  const segments = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  return (segments[segments.length - 1] ?? '').toLowerCase()
}

async function route(action: string, req: VercelRequest): Promise<RoomState | null> {
  const now = Date.now()
  const method = (req.method ?? 'GET').toUpperCase()

  if (action === 'get') {
    if (method !== 'GET') fail('Use GET for /api/room/get', 405)
    const code = parseCode(req.query.code)
    const stored = await store.get(code)
    if (!stored) return null
    return loadRoom(code, now)
  }

  if (method !== 'POST') fail(`Use POST for /api/room/${action}`, 405)
  const body = parseBody(req)

  switch (action) {
    case 'create': {
      const profile = parseProfile(body.profile)
      const settings = parseSettings(body.settings)
      const code = await allocateCode()
      return save(createRoom(code, profile, settings, now))
    }
    case 'join': {
      const code = parseCode(body.code)
      const profile = parseProfile(body.profile)
      return save(addPlayer(await loadRoom(code, now), profile, now))
    }
    case 'leave': {
      const code = parseCode(body.code)
      const playerId = asString(body.playerId, 'playerId', MAX_ID_LENGTH)
      const stored = await store.get(code)
      if (!stored) return null
      const next = removePlayer(stored, playerId)
      if (!next) {
        await store.remove(code)
        return null
      }
      return save(next)
    }
    case 'patch': {
      const code = parseCode(body.code)
      const playerId = asString(body.playerId, 'playerId', MAX_ID_LENGTH)
      const patch = parsePatch(body.patch ?? {})
      const room = applyPlayerPatch(await loadRoom(code, now), playerId, patch, now)
      return save(deriveStatus(room, now))
    }
    case 'challenge': {
      const code = parseCode(body.code)
      const hostId = asString(body.hostId, 'hostId', MAX_ID_LENGTH)
      const challenge = parseChallenge(body.challenge)
      const room = await loadRoom(code, now)
      assertHost(room, hostId)
      return save(setChallenge(room, challenge))
    }
    case 'settings': {
      const code = parseCode(body.code)
      const hostId = asString(body.hostId, 'hostId', MAX_ID_LENGTH)
      const settings = parseSettings(body.settings)
      const room = await loadRoom(code, now)
      assertHost(room, hostId)
      return save(setSettings(room, settings))
    }
    case 'start': {
      const code = parseCode(body.code)
      const hostId = asString(body.hostId, 'hostId', MAX_ID_LENGTH)
      const countdownMs = asInt(body.countdownMs, 'countdownMs', 0, MAX_COUNTDOWN_MS)
      const room = await loadRoom(code, now)
      assertHost(room, hostId)
      return save(startRace(room, countdownMs, now))
    }
    case 'rematch': {
      const code = parseCode(body.code)
      const hostId = asString(body.hostId, 'hostId', MAX_ID_LENGTH)
      const challenge = parseChallenge(body.challenge)
      const room = await loadRoom(code, now)
      assertHost(room, hostId)
      return save(rematch(room, challenge, now))
    }
    default:
      return fail(`Unknown action "${action}"`, 404)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('cache-control', 'no-store')
  const action = actionFrom(req)

  if (action === 'health') {
    res.status(200).json({ ok: true, backend: store.backend })
    return
  }

  try {
    const room = await route(action, req)
    res.status(200).json({ ok: true, room })
  } catch (error) {
    if (error instanceof RoomError) {
      res.status(error.status).json({ ok: false, error: error.message })
      return
    }
    // Unexpected failures (storage outage, bad JSON from Redis, ...) are logged
    // server-side and reported generically so nothing internal leaks.
    console.error('[api/room] unexpected failure', error)
    res.status(500).json({ ok: false, error: 'Multiplayer service is unavailable' })
  }
}
