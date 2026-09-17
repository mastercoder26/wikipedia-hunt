// Browser-side client for the English Wikipedia Action API.
// Every request is CORS-friendly (origin=*) and uses formatversion=2.

import type { ArticleRef } from '@/lib/types'

const API_BASE = 'https://en.wikipedia.org/w/api.php'
const SEARCH_LIMIT = 10
const HTML_CACHE_LIMIT = 30
/** Random generator over-fetches because junk pages get filtered out. */
const RANDOM_OVERFETCH = 3
const RANDOM_MAX_REQUEST = 50

const JUNK_TITLE_PATTERNS: readonly RegExp[] = [
  /^List of /i,
  /^Lists of /i,
  /^Index of /i,
  /^Outline of /i,
  /^Timeline of /i,
  /\(disambiguation\)/i,
]

export interface ArticleHtml {
  title: string
  key: string
  html: string
  redirectedFrom?: string
}

/** "Apollo 11" -> "Apollo_11" */
export function titleToKey(title: string): string {
  return decodeSafely(title).trim().replace(/\s+/g, '_')
}

/** "Apollo_11" -> "Apollo 11" */
export function keyToTitle(key: string): string {
  return decodeSafely(key).replace(/_/g, ' ').trim()
}

function decodeSafely(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    // Malformed percent-escapes (e.g. a bare "%" in a title) must not blow up.
    return value
  }
}

function toRef(title: string): ArticleRef {
  return { title: keyToTitle(title), key: titleToKey(title) }
}

/** True for pages that make for bad race endpoints (lists, indexes, disambiguation). */
function isJunkTitle(title: string): boolean {
  return JUNK_TITLE_PATTERNS.some((pattern) => pattern.test(title))
}

function buildUrl(params: Record<string, string | number>): string {
  const search = new URLSearchParams({
    format: 'json',
    formatversion: '2',
    origin: '*',
  })

  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value))
  }

  return `${API_BASE}?${search.toString()}`
}

interface ApiErrorPayload {
  error?: { info?: string; code?: string }
}

/** Single choke point for fetching: throws readable Errors, never swallows failures. */
async function requestApi<T>(
  params: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(buildUrl(params), { signal, method: 'GET' })
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new Error(`Wikipedia request failed: ${getErrorMessage(error)}`)
  }

  if (!response.ok) {
    throw new Error(`Wikipedia API returned ${response.status} ${response.statusText}`)
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch (error: unknown) {
    throw new Error(`Wikipedia API returned invalid JSON: ${getErrorMessage(error)}`)
  }

  const apiError = (payload as ApiErrorPayload | null)?.error

  if (apiError) {
    const code = apiError.code ?? 'unknown'
    throw new Error(`Wikipedia API error (${code}): ${apiError.info ?? 'no details provided'}`)
  }

  return payload as T
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface SearchResponse {
  query?: { search?: Array<{ title?: string }> }
}

/** Up to 10 search hits. Debouncing is the caller's responsibility. */
export async function searchArticles(
  query: string,
  signal?: AbortSignal,
): Promise<ArticleRef[]> {
  const trimmed = query.trim()

  if (!trimmed) return []

  const data = await requestApi<SearchResponse>(
    {
      action: 'query',
      list: 'search',
      srsearch: trimmed,
      srlimit: SEARCH_LIMIT,
      srnamespace: 0,
      srinfo: '',
      srprop: '',
    },
    signal,
  )

  const hits = data.query?.search ?? []

  return hits
    .map((hit) => hit.title)
    .filter((title): title is string => typeof title === 'string' && title.length > 0)
    .map(toRef)
}

interface ParseResponse {
  parse?: {
    title?: string
    text?: string
    redirects?: Array<{ from?: string; to?: string }>
  }
}

const htmlCache = new Map<string, ArticleHtml>()

function readCache(cacheKey: string): ArticleHtml | undefined {
  return htmlCache.get(cacheKey)
}

/** FIFO eviction keeps back-navigation instant without unbounded growth. */
function writeCache(cacheKey: string, value: ArticleHtml): void {
  if (htmlCache.has(cacheKey)) htmlCache.delete(cacheKey)
  htmlCache.set(cacheKey, value)

  while (htmlCache.size > HTML_CACHE_LIMIT) {
    const oldest = htmlCache.keys().next()
    if (oldest.done) break
    htmlCache.delete(oldest.value)
  }
}

export function clearArticleCache(): void {
  htmlCache.clear()
}

/** Raw article HTML plus the resolved canonical title (redirects followed). */
export async function fetchArticleHtml(
  key: string,
  signal?: AbortSignal,
): Promise<ArticleHtml> {
  const page = keyToTitle(key)

  if (!page) {
    throw new Error('Cannot fetch an article without a title.')
  }

  const cacheKey = titleToKey(page)
  const cached = readCache(cacheKey)

  if (cached) return cached

  const data = await requestApi<ParseResponse>(
    {
      action: 'parse',
      page,
      prop: 'text|displaytitle',
      redirects: 1,
    },
    signal,
  )

  const parsed = data.parse

  if (!parsed || typeof parsed.text !== 'string' || typeof parsed.title !== 'string') {
    throw new Error(`Wikipedia returned no article content for "${page}".`)
  }

  const redirect = parsed.redirects?.find((entry) => typeof entry.from === 'string')
  const result: ArticleHtml = {
    title: parsed.title,
    key: titleToKey(parsed.title),
    html: parsed.text,
    ...(redirect?.from ? { redirectedFrom: redirect.from } : {}),
  }

  writeCache(cacheKey, result)
  // Also cache under the resolved key so a later direct hit is free.
  if (result.key !== cacheKey) writeCache(result.key, result)

  return result
}

interface RandomResponse {
  query?: { pages?: Array<{ title?: string; pageprops?: Record<string, unknown> }> }
}

/** Random mainspace articles with disambiguation/list/index pages filtered out. */
export async function getRandomArticles(count: number): Promise<ArticleRef[]> {
  if (!Number.isFinite(count) || count <= 0) return []

  const requested = Math.min(Math.ceil(count * RANDOM_OVERFETCH), RANDOM_MAX_REQUEST)

  const data = await requestApi<RandomResponse>({
    action: 'query',
    generator: 'random',
    grnnamespace: 0,
    grnlimit: requested,
    prop: 'pageprops',
    ppprop: 'disambiguation',
  })

  const pages = data.query?.pages ?? []

  return pages
    .filter((page) => typeof page.title === 'string')
    .filter((page) => !('disambiguation' in (page.pageprops ?? {})))
    .filter((page) => !isJunkTitle(page.title as string))
    .slice(0, count)
    .map((page) => toRef(page.title as string))
}

interface ResolveResponse {
  query?: {
    normalized?: Array<{ from?: string; to?: string }>
    redirects?: Array<{ from?: string; to?: string }>
    pages?: Array<{ title?: string; missing?: boolean; invalid?: boolean }>
  }
}

/** Canonical ArticleRef for a title or key, or null when the page does not exist. */
export async function resolveTitle(titleOrKey: string): Promise<ArticleRef | null> {
  const title = keyToTitle(titleOrKey)

  if (!title) return null

  const data = await requestApi<ResolveResponse>({
    action: 'query',
    titles: title,
    redirects: 1,
  })

  const page = data.query?.pages?.[0]

  if (!page || page.missing || page.invalid || typeof page.title !== 'string') {
    return null
  }

  return toRef(page.title)
}

// --- Lead images -------------------------------------------------------------

export interface ArticleImage {
  /** Canonical article title the image belongs to. */
  title: string
  source: string
  width: number
  height: number
}

interface PageImageResult {
  title: string
  thumbnail?: { source: string; width: number; height: number }
}

/** Cached per title so a thumbnail is fetched once per session, not per screen. */
const imageCache = new Map<string, ArticleImage | null>()

/**
 * Lead images for up to 50 articles in one request. Plenty of articles have no
 * lead image at all, so a title maps to `null` rather than being omitted and
 * refetched forever.
 */
export async function getArticleImages(
  titles: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, ArticleImage | null>> {
  const wanted = Array.from(new Set(titles.map((t) => t.replace(/_/g, ' ').trim()))).filter(Boolean)
  const missing = wanted.filter((t) => !imageCache.has(t))

  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50)
    const data = await requestApi<{
      query?: {
        pages?: PageImageResult[]
        normalized?: { from: string; to: string }[]
        redirects?: { from: string; to: string }[]
      }
    }>(
      {
        action: 'query',
        titles: batch.join('|'),
        prop: 'pageimages',
        piprop: 'thumbnail',
        pithumbsize: 800,
        pilicense: 'any',
        redirects: 1,
      },
      signal,
    )

    // Map every alias the API reported back to what the caller asked for, so a
    // redirect or a normalization still resolves to an image.
    const alias = new Map<string, string>()
    for (const r of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])]) {
      alias.set(r.to, r.from)
    }

    for (const page of data.query?.pages ?? []) {
      const image: ArticleImage | null = page.thumbnail
        ? {
            title: page.title,
            source: page.thumbnail.source,
            width: page.thumbnail.width,
            height: page.thumbnail.height,
          }
        : null
      imageCache.set(page.title, image)
      const asked = alias.get(page.title)
      if (asked) imageCache.set(asked, image)
    }

    // Anything the API never mentioned has no image as far as we are concerned.
    for (const title of batch) if (!imageCache.has(title)) imageCache.set(title, null)
  }

  return new Map(wanted.map((t) => [t, imageCache.get(t) ?? null]))
}

export function clearImageCache(): void {
  imageCache.clear()
}
