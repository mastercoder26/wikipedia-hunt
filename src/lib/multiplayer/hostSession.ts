import {
  addPlayer,
  applyPlayerPatch,
  assertHost,
  deriveStatus,
  pruneStale,
  rematch,
  removePlayer,
  setChallenge,
  setSettings,
  startRace,
} from '@/lib/multiplayer/roomLogic'
import type { Challenge, PlayerProfile, RoomPlayer, RoomSettings, RoomState } from '@/lib/types'

export type HostAction =
  | { type: 'join'; profile: PlayerProfile }
  | { type: 'leave'; playerId: string }
  | { type: 'patch'; playerId: string; patch: Partial<RoomPlayer> }
  | { type: 'challenge'; hostId: string; challenge: Challenge }
  | { type: 'settings'; hostId: string; settings: RoomSettings }
  | { type: 'start'; hostId: string; countdownMs: number }
  | { type: 'rematch'; hostId: string; challenge: Challenge }
  | { type: 'get' }

/**
 * In-memory room owned by the WebRTC host tab. Guests send `HostAction`
 * messages; the host is the only place `roomLogic` runs.
 */
export class HostSession {
  private room: RoomState | null

  constructor(initial: RoomState) {
    this.room = initial
  }

  snapshot(now: number = Date.now()): RoomState | null {
    return this.tick(now)
  }

  apply(action: HostAction, now: number = Date.now()): RoomState | null {
    const current = this.tick(now)
    if (!current && action.type !== 'join') return null

    switch (action.type) {
      case 'get':
        return current
      case 'join':
        if (!current) return null
        this.room = addPlayer(current, action.profile, now)
        return this.room
      case 'leave':
        if (!current) return null
        this.room = removePlayer(current, action.playerId)
        return this.room
      case 'patch':
        if (!current) return null
        this.room = deriveStatus(
          applyPlayerPatch(current, action.playerId, action.patch, now),
          now,
        )
        return this.room
      case 'challenge':
        if (!current) return null
        assertHost(current, action.hostId)
        this.room = setChallenge(current, action.challenge)
        return this.room
      case 'settings':
        if (!current) return null
        assertHost(current, action.hostId)
        this.room = setSettings(current, action.settings)
        return this.room
      case 'start':
        if (!current) return null
        assertHost(current, action.hostId)
        this.room = startRace(current, action.countdownMs, now)
        return this.room
      case 'rematch':
        if (!current) return null
        assertHost(current, action.hostId)
        this.room = rematch(current, action.challenge, now)
        return this.room
      default: {
        const _never: never = action
        return _never
      }
    }
  }

  private tick(now: number): RoomState | null {
    if (!this.room) return null
    const pruned = pruneStale(this.room, now)
    if (!pruned) {
      this.room = null
      return null
    }
    this.room = deriveStatus(pruned, now)
    return this.room
  }
}
