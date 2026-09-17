// Daily Dash global leaderboard.
//
// GET  /api/daily?date=YYYY-MM-DD   → { ok, board: { byTime, byClicks } }
// POST /api/daily                   → validates a route, then stores it
//
// Submitted routes are verified against Wikipedia's link graph before they are
// stored. A route must start on the day's start article, end on its target, and
// every consecutive pair must be a real link. A client can still lie about its
// clock, but it cannot invent a route.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { dailyChallenge } from '../src/data/daily'

const KEY_PREFIX = 'wikidash:daily:'
const TTL_SECONDS = 60 * 60 * 24 * 8
const MAX_ENTRIES = 50
const MAX_PATH = 40
const MAX_NAME = 16

interface Entry {
  name: string
  durationMs: number
  clicks: number
  path: string[]
  at: number
}

// --- storage -----------------------------------------------------------------

function upstash() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return async (command: unknown[]): Promise<unknown> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    })
    if (!res.ok) throw new Error(`Upstash responded ${res.status}`)
    const data = (await res.json()) as { result?: unknown }
    return data.result
  }
}

async function readEntries(date: string): Promise<Entry[]> {
  const run = upstash()
  if (!run) return []
  const raw = (await run(['GET', KEY_PREFIX + date])) as string | null
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Entry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeEntries(date: string, entries: Entry[]): Promise<void> {
  const run = upstash()
  if (!run) throw new Error('Leaderboard storage is not configured.')
  await run(['SET', KEY_PREFIX + date, JSON.stringify(entries), 'EX', String(TTL_SECONDS)])
}

// --- route validation --------------------------------------------------------

const WIKI = 'https://en.wikipedia.org/w/api.php'

function normalize(title: string) {
  return title.replace(/_/g, ' ').trim().toLowerCase()
}

/**
 * Returns true when every consecutive pair in `path` is a real Wikipedia link.
 * One request: ask for each page's links, filtered to the set of titles that
 * actually appear in the route, so the response stays small.
 */
async function isRealRoute(path: string[]): Promise<boolean> {
  if (path.length < 2) return false
  const sources = path.slice(0, -1)
  const url = new URL(WIKI)
  url.searchParams.set('action', 'query')
  url.searchParams.set('format', 'json')
  url.searchParams.set('formatversion', '2')
  url.searchParams.set('prop', 'links')
  url.searchParams.set('plnamespace', '0')
  url.searchParams.set('pllimit', 'max')
  url.searchParams.set('redirects', '1')
  url.searchParams.set('titles', sources.join('|'))
  url.searchParams.set('pltitles', Array.from(new Set(path.slice(1))).join('|'))

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Wikipedia responded ${res.status}`)
  const data = (await res.json()) as {
    query?: {
      pages?: { title: string; links?: { title: string }[] }[]
      redirects?: { from: string; to: string }[]
      normalized?: { from: string; to: string }[]
    }
  }

  // Map every alias Wikipedia reported back to the canonical title, so a route
  // that went through a redirect still validates.
  const canonical = new Map<string, string>()
  for (const r of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])]) {
    canonical.set(normalize(r.from), normalize(r.to))
  }
  const resolve = (t: string) => canonical.get(normalize(t)) ?? normalize(t)

  const linksByPage = new Map<string, Set<string>>()
  for (const page of data.query?.pages ?? []) {
    linksByPage.set(
      normalize(page.title),
      new Set((page.links ?? []).map((l) => normalize(l.title))),
    )
  }

  for (let i = 0; i < path.length - 1; i += 1) {
    const from = resolve(path[i])
    const to = resolve(path[i + 1])
    if (from === to) continue // a redirect hop is free
    const links = linksByPage.get(from)
    if (!links || !links.has(to)) return false
  }
  return true
}

// --- handler -----------------------------------------------------------------

function rank(entries: Entry[]) {
  const byTime = [...entries].sort((a, b) => a.durationMs - b.durationMs || a.clicks - b.clicks)
  const byClicks = [...entries].sort((a, b) => a.clicks - b.clicks || a.durationMs - b.durationMs)
  return { byTime: byTime.slice(0, 20), byClicks: byClicks.slice(0, 20) }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const date = String(req.query.date ?? '')
      if (!DATE_RE.test(date)) return res.status(400).json({ ok: false, error: 'Bad date.' })
      if (!upstash()) {
        return res.status(503).json({ ok: false, error: 'Leaderboard storage is not configured.' })
      }
      return res.status(200).json({ ok: true, board: rank(await readEntries(date)) })
    }

    if (req.method === 'POST') {
      if (!upstash()) {
        return res.status(503).json({ ok: false, error: 'Leaderboard storage is not configured.' })
      }
      const body = (req.body ?? {}) as Partial<Entry> & { date?: string }
      const date = String(body.date ?? '')
      const name = String(body.name ?? '').trim().slice(0, MAX_NAME)
      const durationMs = Number(body.durationMs)
      const clicks = Number(body.clicks)
      const path = Array.isArray(body.path) ? body.path.map(String) : []

      if (!DATE_RE.test(date)) return res.status(400).json({ ok: false, error: 'Bad date.' })
      if (!name) return res.status(400).json({ ok: false, error: 'A name is required.' })
      if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 6 * 60 * 60 * 1000) {
        return res.status(400).json({ ok: false, error: 'Implausible time.' })
      }
      if (!Number.isInteger(clicks) || clicks < 1 || clicks > MAX_PATH) {
        return res.status(400).json({ ok: false, error: 'Implausible click count.' })
      }
      if (path.length < 2 || path.length > MAX_PATH) {
        return res.status(400).json({ ok: false, error: 'Route is the wrong length.' })
      }

      // The route has to be for the pair that was actually set that day.
      const challenge = dailyChallenge(new Date(`${date}T12:00:00`))
      if (
        normalize(path[0]) !== normalize(challenge.start.title) ||
        normalize(path[path.length - 1]) !== normalize(challenge.target.title)
      ) {
        return res.status(400).json({ ok: false, error: 'Route does not match today’s challenge.' })
      }

      if (!(await isRealRoute(path))) {
        return res.status(400).json({ ok: false, error: 'Route could not be verified against Wikipedia.' })
      }

      const entries = await readEntries(date)
      // One entry per name, best-only, so retries do not flood the board.
      const existing = entries.find((e) => e.name.toLowerCase() === name.toLowerCase())
      const fresh: Entry = { name, durationMs, clicks, path, at: Date.now() }
      let next: Entry[]
      if (!existing) {
        next = [...entries, fresh]
      } else if (durationMs < existing.durationMs || clicks < existing.clicks) {
        next = entries.map((e) =>
          e === existing
            ? {
                ...fresh,
                durationMs: Math.min(existing.durationMs, durationMs),
                clicks: Math.min(existing.clicks, clicks),
                path: durationMs <= existing.durationMs ? path : existing.path,
              }
            : e,
        )
      } else {
        next = entries
      }

      next = next
        .sort((a, b) => a.durationMs - b.durationMs)
        .slice(0, MAX_ENTRIES)
      await writeEntries(date, next)
      return res.status(200).json({ ok: true, board: rank(next) })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed.' })
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: err instanceof Error ? err.message : 'Unexpected error.' })
  }
}
