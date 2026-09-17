// Pure room rules shared by the client transports and the serverless API.
// Every function takes a RoomState and returns a NEW RoomState; nothing here
// mutates its input, and nothing here touches storage, network or the clock
// (callers pass `now` so results are deterministic and testable).

import type {
  Challenge,
  PlayerProfile,
  RoomPlayer,
  RoomSettings,
  RoomState,
} from '@/lib/types'

export const MAX_PLAYERS = 8
export const MAX_NAME_LENGTH = 16
/** Players that have not been seen for this long are dropped from the room. */
export const STALE_PLAYER_TTL_MS = 30_000
/** How long a room survives without any activity. */
export const ROOM_TTL_MS = 2 * 60 * 60 * 1000

export class RoomError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'RoomError'
    this.status = status
  }
}

function bump(room: RoomState, patch: Partial<RoomState>): RoomState {
  return { ...room, ...patch, version: room.version + 1 }
}

function clampName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH) || 'Player'
}

/** Appends a numeric suffix until the name is unique inside the room. */
function uniqueName(taken: readonly string[], desired: string): string {
  const base = clampName(desired)
  const lower = new Set(taken.map((name) => name.toLowerCase()))
  if (!lower.has(base.toLowerCase())) return base

  for (let suffix = 2; suffix <= MAX_PLAYERS + 1; suffix += 1) {
    const tag = ` ${suffix}`
    const trimmed = base.slice(0, Math.max(1, MAX_NAME_LENGTH - tag.length))
    const candidate = `${trimmed}${tag}`
    if (!lower.has(candidate.toLowerCase())) return candidate
  }
  return base
}

function toPlayer(profile: PlayerProfile, isHost: boolean, now: number): RoomPlayer {
  return {
    id: profile.id,
    name: clampName(profile.name),
    color: profile.color,
    isHost,
    state: 'lobby',
    clicks: 0,
    path: [],
    lastSeen: now,
  }
}

/** Fresh player shape for the start of a race: clean clicks, empty path. */
function resetForRace(player: RoomPlayer, now: number): RoomPlayer {
  return {
    ...player,
    state: 'racing',
    clicks: 0,
    path: [],
    currentArticle: undefined,
    durationMs: undefined,
    lastSeen: now,
  }
}

function withHostFlags(players: readonly RoomPlayer[], hostId: string): RoomPlayer[] {
  return players.map((player) =>
    player.isHost === (player.id === hostId)
      ? player
      : { ...player, isHost: player.id === hostId },
  )
}

export function findPlayer(room: RoomState, playerId: string): RoomPlayer | undefined {
  return room.players.find((player) => player.id === playerId)
}

/** Throws unless `hostId` is the room's current host. */
export function assertHost(room: RoomState, hostId: string): void {
  if (room.hostId !== hostId) {
    throw new RoomError('Only the host can do that', 403)
  }
}

export function createRoom(
  code: string,
  profile: PlayerProfile,
  settings: RoomSettings,
  now: number = Date.now(),
): RoomState {
  return {
    code,
    hostId: profile.id,
    challenge: null,
    settings: { ...settings },
    players: [toPlayer(profile, true, now)],
    status: 'lobby',
    startsAt: null,
    version: 1,
  }
}

/**
 * Adds a player, or refreshes an existing one when the same id rejoins.
 * Throws when the room is already at MAX_PLAYERS.
 */
export function addPlayer(
  room: RoomState,
  profile: PlayerProfile,
  now: number = Date.now(),
): RoomState {
  const existing = findPlayer(room, profile.id)
  if (existing) {
    return bump(room, {
      players: room.players.map((player) =>
        player.id === profile.id
          ? { ...player, color: profile.color, lastSeen: now }
          : player,
      ),
    })
  }

  if (room.players.length >= MAX_PLAYERS) {
    throw new RoomError(`Room is full (${MAX_PLAYERS} players max)`, 409)
  }

  const name = uniqueName(
    room.players.map((player) => player.name),
    profile.name,
  )
  const player = toPlayer({ ...profile, name }, false, now)
  return bump(room, { players: [...room.players, player] })
}

/**
 * Removes a player. The host role moves to the longest-standing remaining
 * player. Returns null when the room is now empty (caller should delete it).
 */
export function removePlayer(room: RoomState, playerId: string): RoomState | null {
  const remaining = room.players.filter((player) => player.id !== playerId)
  if (remaining.length === room.players.length) return room
  if (remaining.length === 0) return null

  const hostId = room.hostId === playerId ? remaining[0].id : room.hostId
  return bump(room, { hostId, players: withHostFlags(remaining, hostId) })
}

/** Merges a partial player update. Identity fields (id, isHost) are ignored. */
export function applyPlayerPatch(
  room: RoomState,
  playerId: string,
  patch: Partial<RoomPlayer>,
  now: number = Date.now(),
): RoomState {
  if (!findPlayer(room, playerId)) {
    throw new RoomError('Player is not in this room', 404)
  }

  const { id: _id, isHost: _isHost, ...safe } = patch
  const players = room.players.map((player) =>
    player.id === playerId ? { ...player, ...safe, lastSeen: now } : player,
  )
  return bump(room, { players })
}

export function setChallenge(room: RoomState, challenge: Challenge): RoomState {
  return bump(room, { challenge })
}

export function setSettings(room: RoomState, settings: RoomSettings): RoomState {
  return bump(room, { settings: { ...settings } })
}

/** Starts the synchronized countdown and resets every player for the race. */
export function startRace(
  room: RoomState,
  countdownMs: number,
  now: number = Date.now(),
): RoomState {
  if (!room.challenge) {
    throw new RoomError('Pick a challenge before starting', 409)
  }

  return bump(room, {
    status: 'countdown',
    startsAt: now + Math.max(0, countdownMs),
    players: room.players.map((player) => resetForRace(player, now)),
  })
}

/** Back to the lobby with a fresh challenge and clean player state. */
export function rematch(
  room: RoomState,
  challenge: Challenge,
  now: number = Date.now(),
): RoomState {
  return bump(room, {
    challenge,
    status: 'lobby',
    startsAt: null,
    players: room.players.map((player) => ({
      ...player,
      state: 'lobby' as const,
      clicks: 0,
      path: [],
      currentArticle: undefined,
      durationMs: undefined,
      lastSeen: now,
    })),
  })
}

/**
 * Advances `status` based on the clock and player states:
 * countdown -> racing once startsAt passes, racing -> finished once every
 * player is finished or surrendered. Returns the SAME object when nothing
 * changed, so pollers can keep deduping on `version`.
 */
export function deriveStatus(room: RoomState, now: number = Date.now()): RoomState {
  let status = room.status

  if (status === 'countdown' && room.startsAt !== null && now >= room.startsAt) {
    status = 'racing'
  }

  if (status === 'racing' && room.players.length > 0) {
    const allDone = room.players.every(
      (player) => player.state === 'finished' || player.state === 'surrendered',
    )
    if (allDone) status = 'finished'
  }

  if (status === room.status) return room
  return bump(room, { status })
}

/**
 * Drops players whose lastSeen is older than `ttlMs`, reassigning the host if
 * needed. Returns the SAME object when nothing was stale, or null when the
 * room emptied out.
 */
export function pruneStale(
  room: RoomState,
  nowMs: number = Date.now(),
  ttlMs: number = STALE_PLAYER_TTL_MS,
): RoomState | null {
  const cutoff = nowMs - ttlMs
  const remaining = room.players.filter((player) => player.lastSeen >= cutoff)
  if (remaining.length === room.players.length) return room
  if (remaining.length === 0) return null

  const hostId = remaining.some((player) => player.id === room.hostId)
    ? room.hostId
    : remaining[0].id
  return bump(room, { hostId, players: withHostFlags(remaining, hostId) })
}
