import { create } from 'zustand'
import { fetchArticleHtml } from '@/lib/wiki'
import { sanitizeArticleHtml } from '@/lib/wiki/sanitize'
import type { Challenge, GameMode, PathStep, RaceStatus } from '@/lib/types'

/** How close two titles must be to count as "the same article". */
function sameArticle(a: string, b: string) {
  return a.replace(/_/g, ' ').trim().toLowerCase() === b.replace(/_/g, ' ').trim().toLowerCase()
}

function previousInHistory(path: readonly PathStep[]): PathStep | undefined {
  let index = path.length - 1

  while (index >= 0 && path[index].viaBack) {
    const currentKey = path[index].key
    index = path.findLastIndex((step, candidate) => candidate < index && step.key === currentKey)
  }

  return index > 0 ? path[index - 1] : undefined
}

interface PendingLoad {
  key: string
  title: string
  meta: { isFirst: boolean; viaBack: boolean }
}

interface RaceState {
  challenge: Challenge | null
  mode: GameMode
  status: RaceStatus
  /** Epoch ms the clock started. Set once, never recomputed, so the timer
      survives re-renders and matches the synchronized multiplayer start. */
  startedAt: number | null
  finishedAt: number | null
  clicks: number
  clickLimit?: number
  path: PathStep[]
  /** Sanitized HTML of the article currently on screen. */
  html: string
  currentTitle: string
  currentKey: string
  loading: boolean
  error: string | null
  pendingLoad: PendingLoad | null
  /** Titles already visited, for the visited-link colour. */
  visited: Set<string>
  begin: (challenge: Challenge, mode: GameMode, opts?: { startedAt?: number; clickLimit?: number }) => Promise<void>
  go: (key: string, title: string) => Promise<void>
  back: () => Promise<void>
  retry: () => Promise<void>
  surrender: () => void
  reset: () => void
}

const EMPTY = {
  challenge: null,
  mode: 'solo' as GameMode,
  status: 'idle' as RaceStatus,
  startedAt: null,
  finishedAt: null,
  clicks: 0,
  clickLimit: undefined,
  path: [] as PathStep[],
  html: '',
  currentTitle: '',
  currentKey: '',
  loading: false,
  error: null,
  pendingLoad: null as PendingLoad | null,
  visited: new Set<string>(),
}

let loadSequence = 0

export const useRace = create<RaceState>((set, get) => ({
  ...EMPTY,

  async begin(challenge, mode, opts) {
    const request = ++loadSequence
    const startedAt = opts?.startedAt ?? Date.now()
    set({
      ...EMPTY,
      visited: new Set<string>(),
      path: [],
      challenge,
      mode,
      clickLimit: opts?.clickLimit,
      status: 'racing',
      startedAt,
      loading: true,
      pendingLoad: {
        key: challenge.start.key,
        title: challenge.start.title,
        meta: { isFirst: true, viaBack: false },
      },
    })
    await load(challenge.start.key, challenge.start.title, { isFirst: true, viaBack: false }, request, set, get)
  },

  async go(key, title) {
    const { status, clickLimit, clicks, loading } = get()
    if (status !== 'racing' || loading) return
    if (clickLimit !== undefined && clicks >= clickLimit) {
      set({ status: 'surrendered', finishedAt: Date.now() })
      return
    }
    const request = ++loadSequence
    set({
      clicks: clicks + 1,
      loading: true,
      error: null,
      pendingLoad: { key, title, meta: { isFirst: false, viaBack: false } },
    })
    await load(key, title, { isFirst: false, viaBack: false }, request, set, get)
  },

  async back() {
    const { status, path, clicks, clickLimit, loading } = get()
    // Back is a legal move but it is not free: it costs a click, same as a link.
    if (status !== 'racing' || loading || path.length < 2) return
    const previous = previousInHistory(path)
    if (!previous) return
    if (clickLimit !== undefined && clicks >= clickLimit) {
      set({ status: 'surrendered', finishedAt: Date.now() })
      return
    }
    const request = ++loadSequence
    set({
      clicks: clicks + 1,
      loading: true,
      error: null,
      pendingLoad: {
        key: previous.key,
        title: previous.title,
        meta: { isFirst: false, viaBack: true },
      },
    })
    await load(previous.key, previous.title, { isFirst: false, viaBack: true }, request, set, get)
  },

  async retry() {
    const { pendingLoad, status, loading } = get()
    if (!pendingLoad || status !== 'racing' || loading) return
    const request = ++loadSequence
    set({ loading: true, error: null })
    await load(pendingLoad.key, pendingLoad.title, pendingLoad.meta, request, set, get)
  },

  surrender() {
    if (get().status !== 'racing') return
    loadSequence += 1
    set({ status: 'surrendered', finishedAt: Date.now() })
  },

  reset() {
    loadSequence += 1
    set({ ...EMPTY, visited: new Set<string>(), path: [] })
  },
}))

type Setter = (partial: Partial<RaceState>) => void

async function load(
  key: string,
  title: string,
  meta: { isFirst: boolean; viaBack: boolean },
  request: number,
  set: Setter,
  get: () => RaceState,
) {
  try {
    const article = await fetchArticleHtml(key)
    const state = get()
    if (request !== loadSequence || state.status !== 'racing') return

    const html = sanitizeArticleHtml(article.html)
    const at = state.startedAt ? Date.now() - state.startedAt : 0
    const step: PathStep = { title: article.title, key: article.key, at, viaBack: meta.viaBack }

    const visited = new Set(state.visited)
    visited.add(article.title)

    // A redirect that lands on the target still counts as reaching the target,
    // which is why this compares the RESOLVED title, not the clicked one.
    const reachedTarget =
      !!state.challenge && sameArticle(article.title, state.challenge.target.title)
    const exhaustedLimit =
      !meta.isFirst && state.clickLimit !== undefined && state.clicks >= state.clickLimit
    const terminalState: Partial<RaceState> = reachedTarget && !meta.isFirst
      ? { status: 'finished', finishedAt: Date.now() }
      : exhaustedLimit
        ? { status: 'surrendered', finishedAt: Date.now() }
        : {}

    set({
      html,
      currentTitle: article.title,
      currentKey: article.key,
      path: [...state.path, step],
      visited,
      loading: false,
      error: null,
      pendingLoad: null,
      ...terminalState,
    })
  } catch (err) {
    if (request !== loadSequence || get().status !== 'racing') return
    set({
      loading: false,
      error: err instanceof Error ? err.message : `Could not load "${title}".`,
    })
  }
}
