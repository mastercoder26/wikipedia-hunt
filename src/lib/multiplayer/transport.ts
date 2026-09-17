// One interface, three implementations: WebRTC (default; the host tab is the
// room), BroadcastChannel (same machine), and HTTP polling against /api/room/*.
// Anything in the UI layer should depend on this type, never on a concrete
// transport, so the backend stays swappable.

import type {
  Challenge,
  PlayerProfile,
  RoomPlayer,
  RoomSettings,
  RoomState,
} from '@/lib/types'

export interface RoomTransport {
  create(profile: PlayerProfile, settings: RoomSettings): Promise<RoomState>
  join(code: string, profile: PlayerProfile): Promise<RoomState>
  leave(code: string, playerId: string): Promise<void>
  get(code: string): Promise<RoomState | null>
  patchPlayer(code: string, playerId: string, patch: Partial<RoomPlayer>): Promise<RoomState>
  setChallenge(code: string, hostId: string, challenge: Challenge): Promise<RoomState>
  setSettings(code: string, hostId: string, settings: RoomSettings): Promise<RoomState>
  startRace(code: string, hostId: string, countdownMs: number): Promise<RoomState>
  rematch(code: string, hostId: string, challenge: Challenge): Promise<RoomState>
}

/** Identifies which implementation `getTransport()` handed back. */
export type TransportKind = 'local' | 'http' | 'webrtc'
