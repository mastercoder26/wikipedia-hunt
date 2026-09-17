import type { Category, Challenge, RaceResult } from '@/lib/types'

const STORAGE_KEY = 'wikidash:v1'
const STORAGE_VERSION = 1 as const
const MAX_RACES = 200

export interface StoredProfile {
  name: string
  color: string
}

/**
 * Category is copied from the challenge for pure stats. A live-race caller may
 * attach `won`; RaceResult itself has no placement/winner field.
 */
export interface StoredRaceResult extends RaceResult {
  category?: Category
  won?: boolean
}

export interface GameStorageState {
  version: typeof STORAGE_VERSION
  profile: StoredProfile
  races: StoredRaceResult[]
  dailyResults: Record<string, StoredRaceResult>
  dailyTimeResults: Record<string, StoredRaceResult>
  personalBests: Record<string, StoredRaceResult>
}

export type RecordableRaceResult = RaceResult & { won?: boolean }

// Matches the first entry of PLAYER_COLORS so a fresh player's dot is a
// colour they can also pick by hand.
const DEFAULT_PROFILE: StoredProfile = { name: 'Player', color: '#2f76d6' }

let memoryState = createDefaultState()

function createDefaultState(profile: StoredProfile = DEFAULT_PROFILE): GameStorageState {
  return {
    version: STORAGE_VERSION,
    profile: { ...profile },
    races: [],
    dailyResults: {},
    dailyTimeResults: {},
    personalBests: {},
  }
}

function cloneRace<T extends StoredRaceResult>(race: T): T {
  return {
    ...race,
    path: race.path.map((step) => ({ ...step })),
  }
}

function cloneRecord(
  record: Record<string, StoredRaceResult>,
): Record<string, StoredRaceResult> {
  return Object.fromEntries(
    Object.entries(record).map(([key, result]) => [key, cloneRace(result)]),
  )
}

function cloneState(state: GameStorageState): GameStorageState {
  return {
    version: STORAGE_VERSION,
    profile: { ...state.profile },
    races: state.races.map(cloneRace),
    dailyResults: cloneRecord(state.dailyResults),
    dailyTimeResults: cloneRecord(state.dailyTimeResults),
    personalBests: cloneRecord(state.personalBests),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRaceResult(value: unknown): value is StoredRaceResult {
  if (!isRecord(value) || !Array.isArray(value.path)) return false

  return (
    typeof value.challengeId === 'string' &&
    (value.mode === 'solo' || value.mode === 'live' || value.mode === 'daily') &&
    typeof value.durationMs === 'number' &&
    typeof value.clicks === 'number' &&
    typeof value.finishedAt === 'number' &&
    typeof value.surrendered === 'boolean'
  )
}

function parseRaceRecord(value: unknown): Record<string, StoredRaceResult> {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, StoredRaceResult] => isRaceResult(entry[1]))
      .map(([key, result]) => [key, cloneRace(result)]),
  )
}

function normalizeState(value: unknown): GameStorageState {
  if (!isRecord(value) || value.version !== STORAGE_VERSION) return createDefaultState()

  const profile = isRecord(value.profile)
    ? {
        name: typeof value.profile.name === 'string' ? value.profile.name : DEFAULT_PROFILE.name,
        color:
          typeof value.profile.color === 'string' ? value.profile.color : DEFAULT_PROFILE.color,
      }
    : DEFAULT_PROFILE
  const races = Array.isArray(value.races)
    ? value.races.filter(isRaceResult).map(cloneRace)
    : []

  return {
    version: STORAGE_VERSION,
    profile: { ...profile },
    races: latestRaces(races),
    dailyResults: parseRaceRecord(value.dailyResults),
    dailyTimeResults: parseRaceRecord(value.dailyTimeResults),
    personalBests: parseRaceRecord(value.personalBests),
  }
}

function latestRaces(races: readonly StoredRaceResult[]): StoredRaceResult[] {
  return races
    .map(cloneRace)
    .sort((left, right) => right.finishedAt - left.finishedAt)
    .slice(0, MAX_RACES)
}

function dateKey(timestamp: number): string {
  const date = new Date(timestamp)
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isBetterByClicks(candidate: RaceResult, current?: RaceResult): boolean {
  return (
    current === undefined ||
    candidate.clicks < current.clicks ||
    (candidate.clicks === current.clicks && candidate.durationMs < current.durationMs)
  )
}

function isBetterByTime(candidate: RaceResult, current?: RaceResult): boolean {
  return (
    current === undefined ||
    candidate.durationMs < current.durationMs ||
    (candidate.durationMs === current.durationMs && candidate.clicks < current.clicks)
  )
}

export function loadState(): GameStorageState {
  try {
    if (typeof localStorage === 'undefined') return cloneState(memoryState)
    const rawState = localStorage.getItem(STORAGE_KEY)
    if (rawState === null) return cloneState(memoryState)

    const parsedState = normalizeState(JSON.parse(rawState) as unknown)
    memoryState = cloneState(parsedState)
    return cloneState(parsedState)
  } catch {
    return cloneState(memoryState)
  }
}

export function saveState(next: GameStorageState): void {
  const normalized = normalizeState(next)
  memoryState = cloneState(normalized)

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // The in-memory copy above is the persistence layer when storage is denied.
  }
}

export function recordRace(
  result: RecordableRaceResult,
  challenge: Challenge,
): GameStorageState {
  const current = loadState()
  const storedResult: StoredRaceResult = cloneRace({
    ...result,
    category: challenge.category,
  })
  let dailyResults = cloneRecord(current.dailyResults)
  let dailyTimeResults = cloneRecord(current.dailyTimeResults)
  let personalBests = cloneRecord(current.personalBests)

  if (!storedResult.surrendered) {
    if (isBetterByClicks(storedResult, personalBests[challenge.id])) {
      personalBests = { ...personalBests, [challenge.id]: cloneRace(storedResult) }
    }

    if (storedResult.mode === 'daily') {
      const key = dateKey(storedResult.finishedAt)
      if (isBetterByClicks(storedResult, dailyResults[key])) {
        dailyResults = { ...dailyResults, [key]: cloneRace(storedResult) }
      }
      if (isBetterByTime(storedResult, dailyTimeResults[key])) {
        dailyTimeResults = { ...dailyTimeResults, [key]: cloneRace(storedResult) }
      }
    }
  }

  const next: GameStorageState = {
    ...current,
    races: latestRaces([...current.races, storedResult]),
    dailyResults,
    dailyTimeResults,
    personalBests,
  }
  saveState(next)
  return cloneState(next)
}

export function getProfile(): StoredProfile {
  return { ...loadState().profile }
}

export function setProfile(profile: StoredProfile): GameStorageState {
  const next = { ...loadState(), profile: { ...profile } }
  saveState(next)
  return cloneState(next)
}

export function resetStats(): GameStorageState {
  const next = createDefaultState(loadState().profile)
  saveState(next)
  return cloneState(next)
}
