import type { ArticleRef } from '@/lib/types'

const API = 'https://en.wikipedia.org/w/api.php'

/** Request ceiling, so this cannot hammer Wikipedia. */
const MAX_REQUESTS = 40
const FRONTIER_CAP = 60

async function call(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = new URL(API)
  const search = { format: 'json', formatversion: '2', origin: '*', ...params }
  for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Wikipedia responded ${res.status}`)
  return (await res.json()) as Record<string, unknown>
}

interface PageLinks {
  title: string
  links?: { title: string }[]
  linkshere?: { title: string }[]
}

/** Outgoing article links from a page (namespace 0 only). */
async function outLinks(title: string): Promise<string[]> {
  const data = await call({
    action: 'query',
    titles: title,
    prop: 'links',
    plnamespace: '0',
    pllimit: 'max',
    redirects: '1',
  })
  const pages = (data.query as { pages?: PageLinks[] } | undefined)?.pages ?? []
  return pages[0]?.links?.map((l) => l.title) ?? []
}

/** Articles that link into a page, for the backward half of the search. */
async function inLinks(title: string): Promise<string[]> {
  const data = await call({
    action: 'query',
    titles: title,
    prop: 'linkshere',
    lhnamespace: '0',
    lhlimit: 'max',
    redirects: '1',
  })
  const pages = (data.query as { pages?: PageLinks[] } | undefined)?.pages ?? []
  return pages[0]?.linkshere?.map((l) => l.title) ?? []
}

/**
 * Bidirectional breadth-first search over Wikipedia's link graph. Used on the
 * results screen to show a player who gave up one route that would have
 * worked. It trades completeness for a bounded request count, so an empty
 * array means "not found within budget", not "no route exists".
 */
export async function findRoute(start: ArticleRef, target: ArticleRef): Promise<string[]> {
  let requests = 0
  const forward = new Map<string, string[]>([[start.title, [start.title]]])
  const backward = new Map<string, string[]>([[target.title, [target.title]]])

  let forwardFrontier = [start.title]
  let backwardFrontier = [target.title]

  for (let depth = 0; depth < 3; depth += 1) {
    // Expand forwards.
    const nextForward: string[] = []
    for (const node of forwardFrontier.slice(0, FRONTIER_CAP)) {
      if (requests >= MAX_REQUESTS) return []
      requests += 1
      let links: string[]
      try {
        links = await outLinks(node)
      } catch {
        continue
      }
      const prefix = forward.get(node) ?? [node]
      for (const link of links) {
        if (forward.has(link)) continue
        const pathTo = [...prefix, link]
        forward.set(link, pathTo)
        const meeting = backward.get(link)
        if (meeting) return [...pathTo.slice(0, -1), ...meeting]
        nextForward.push(link)
      }
    }
    forwardFrontier = nextForward

    // Expand backwards.
    const nextBackward: string[] = []
    for (const node of backwardFrontier.slice(0, FRONTIER_CAP)) {
      if (requests >= MAX_REQUESTS) return []
      requests += 1
      let links: string[]
      try {
        links = await inLinks(node)
      } catch {
        continue
      }
      const suffix = backward.get(node) ?? [node]
      for (const link of links) {
        if (backward.has(link)) continue
        const pathFrom = [link, ...suffix]
        backward.set(link, pathFrom)
        const meeting = forward.get(link)
        if (meeting) return [...meeting.slice(0, -1), ...pathFrom]
        nextBackward.push(link)
      }
    }
    backwardFrontier = nextBackward

    if (forwardFrontier.length === 0 && backwardFrontier.length === 0) break
  }

  return []
}
