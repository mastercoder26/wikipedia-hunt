import { getProfile, setProfile } from './storage'
import type { PlayerProfile } from '@/lib/types'

const ID_KEY = 'wikidash:playerId'

/** Eight colours legible as a dot in both themes. */
export const PLAYER_COLORS = [
  '#e4451c', '#2f76d6', '#14866d', '#b8860b',
  '#8b5cf6', '#db2777', '#0891b2', '#65a30d',
] as const

function randomId() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Stable per-browser id, so a reload rejoins as the same player. */
export function playerId(): string {
  try {
    const existing = localStorage.getItem(ID_KEY)
    if (existing) return existing
    const fresh = randomId()
    localStorage.setItem(ID_KEY, fresh)
    return fresh
  } catch {
    return randomId()
  }
}

export function currentProfile(): PlayerProfile {
  const stored = getProfile()
  return { id: playerId(), name: stored.name, color: stored.color }
}

export function saveProfile(name: string, color: string) {
  setProfile({ name: name.trim().slice(0, 16) || 'Player', color })
}
