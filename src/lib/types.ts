// Shared domain contracts for WikiDash. Everything else builds on these.

export type Category =
  | 'science'
  | 'history'
  | 'sports'
  | 'geography'
  | 'entertainment'
  | 'technology'
  | 'random'

export type Difficulty = 'easy' | 'medium' | 'hard'

export type GameMode = 'solo' | 'live' | 'daily'

/** A Wikipedia article identified by its canonical, unescaped title. */
export interface ArticleRef {
  /** Canonical title, e.g. "Apollo 11". */
  title: string
  /** URL-encoded db key, e.g. "Apollo_11". */
  key: string
}

export interface Challenge {
  id: string
  start: ArticleRef
  target: ArticleRef
  category: Category
  difficulty: Difficulty
}

/** One article visit inside a race. */
export interface PathStep {
  title: string
  key: string
  /** ms since race start when this article rendered. */
  at: number
  /** True when the step came from the browser-style back button. */
  viaBack: boolean
}

export type RaceStatus = 'idle' | 'countdown' | 'racing' | 'finished' | 'surrendered'

export interface RaceResult {
  challengeId: string
  mode: GameMode
  /** Race duration in ms. */
  durationMs: number
  clicks: number
  path: PathStep[]
  finishedAt: number
  surrendered: boolean
  clickLimit?: number
}

export interface PlayerProfile {
  id: string
  name: string
  color: string
}

export type PlayerRaceState = 'lobby' | 'ready' | 'racing' | 'finished' | 'surrendered'

export interface RoomPlayer extends PlayerProfile {
  isHost: boolean
  state: PlayerRaceState
  clicks: number
  /** Only populated when the room reveals live positions. */
  currentArticle?: string
  durationMs?: number
  path?: string[]
  lastSeen: number
}

export interface RoomSettings {
  revealArticles: boolean
  clickLimit?: number
}

export interface RoomState {
  code: string
  hostId: string
  challenge: Challenge | null
  settings: RoomSettings
  players: RoomPlayer[]
  status: 'lobby' | 'countdown' | 'racing' | 'finished'
  /** Epoch ms of the synchronized race start. */
  startsAt: number | null
  version: number
}

export type AwardId =
  | 'speedrunner'
  | 'minimalist'
  | 'explorer'
  | 'photo-finish'
  | 'lost-in-the-wiki'

export interface Award {
  id: AwardId
  label: string
  description: string
  playerId: string
}
