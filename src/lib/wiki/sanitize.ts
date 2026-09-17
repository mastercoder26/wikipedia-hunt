// Rewrites raw Wikipedia article HTML for fair-play racing:
// only internal article links survive, everything else becomes inert.

const WIKI_ORIGIN = 'https://en.wikipedia.org'
const INTERNAL_PREFIX = '/wiki/'

/** Chrome that adds nothing to a race, or leaks answers / outside navigation. */
const REMOVE_SELECTORS: readonly string[] = [
  'script',
  'style',
  'link',
  'meta',
  'base',
  'form',
  'area',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'portal',
  '.mw-editsection',
  '.navbox',
  '.navbox-styles',
  '.vertical-navbox',
  '.metadata',
  '.ambox',
  '#coordinates',
  '.reflist',
  '.references',
  '.mw-references-wrap',
  'sup.reference',
  'table.sidebar',
  '.noprint',
  '.mw-empty-elt',
  '.mw-jump-link',
  '.printfooter',
]

/**
 * Namespaced targets are off-limits; article titles may still contain a colon
 * (e.g. "Star Trek: Voyager"), so we only reject a known namespace-ish prefix.
 */
const NAMESPACE_RE = /^[A-Za-z][A-Za-z_ -]{0,30}:/

function decodeSafely(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** "/wiki/Apollo_11#Crew" -> "Apollo_11", or null when not an article link. */
function extractArticleKey(href: string): string | null {
  if (!href.startsWith(INTERNAL_PREFIX)) return null

  const withoutPrefix = href.slice(INTERNAL_PREFIX.length)
  const withoutFragment = withoutPrefix.split('#')[0].split('?')[0]

  if (!withoutFragment) return null

  const decoded = decodeSafely(withoutFragment)

  if (NAMESPACE_RE.test(decoded)) return null

  return decoded
}

function keyToTitle(key: string): string {
  return key.replace(/_/g, ' ').trim()
}

function stripEventHandlers(root: Document): void {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || name === 'target' || name === 'rel') {
        element.removeAttribute(attribute.name)
      }
    }
  }
}

const MEDIA_TAGS = new Set(['img', 'source', 'audio', 'video'])
const NAVIGATION_ATTRIBUTES = new Set([
  'action',
  'formaction',
  'formtarget',
  'srcdoc',
  'ping',
  'data',
  'background',
])

function stripNavigationAttributes(root: Document): void {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    const tag = element.tagName.toLowerCase()

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const isPlayableHref = name === 'href' && tag === 'a' && element.classList.contains('wd-link')

      if ((name === 'href' || name.endsWith(':href')) && !isPlayableHref) {
        element.removeAttribute(attribute.name)
      } else if (NAVIGATION_ATTRIBUTES.has(name)) {
        element.removeAttribute(attribute.name)
      } else if ((name === 'src' || name === 'srcset') && !MEDIA_TAGS.has(tag)) {
        element.removeAttribute(attribute.name)
      }
    }

    const style = (element as HTMLElement).style
    if (!style) continue
    for (const property of Array.from(style)) {
      if (/url\s*\(/i.test(style.getPropertyValue(property))) style.removeProperty(property)
    }
    if (!style.cssText) element.removeAttribute('style')
  }
}

function disableAnchor(doc: Document, anchor: HTMLAnchorElement): void {
  const span = doc.createElement('span')
  span.className = 'wd-link-disabled'
  // Preserve inner markup so images and formatting keep the layout intact.
  span.innerHTML = anchor.innerHTML
  anchor.replaceWith(span)
}

function rewriteAnchors(doc: Document): void {
  for (const anchor of Array.from(doc.querySelectorAll('a'))) {
    const href = anchor.getAttribute('href') ?? ''
    const isRedLink = anchor.classList.contains('new')
    const key = href ? extractArticleKey(href) : null

    if (!key || isRedLink) {
      disableAnchor(doc, anchor)
      continue
    }

    const title = anchor.getAttribute('title') ?? keyToTitle(key)

    anchor.setAttribute('data-wiki-key', key)
    anchor.setAttribute('data-wiki-title', title)
    anchor.setAttribute('href', '#')
    anchor.className = 'wd-link'
  }
}

function absolutizeUrl(value: string): string {
  if (value.startsWith('//')) return `https:${value}`
  if (value.startsWith('/w/') || value.startsWith('/wiki/')) return `${WIKI_ORIGIN}${value}`
  return value
}

function fixSrcset(value: string): string {
  return value
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/)
      if (parts.length === 0 || !parts[0]) return candidate.trim()
      parts[0] = absolutizeUrl(parts[0])
      return parts.join(' ')
    })
    .filter(Boolean)
    .join(', ')
}

function fixMedia(doc: Document): void {
  for (const element of Array.from(doc.querySelectorAll('img, source, audio, video'))) {
    const src = element.getAttribute('src')
    if (src) element.setAttribute('src', absolutizeUrl(src))

    const srcset = element.getAttribute('srcset')
    if (srcset) element.setAttribute('srcset', fixSrcset(srcset))

    if (element.tagName.toLowerCase() === 'img') {
      element.removeAttribute('loading')
      element.setAttribute('loading', 'lazy')
    }
  }
}

/**
 * Sanitize raw article HTML from action=parse into a safe, fair-play fragment.
 * Returns the rewritten body markup.
 */
export function sanitizeArticleHtml(html: string): string {
  if (typeof html !== 'string' || !html.trim()) return ''

  const doc = new DOMParser().parseFromString(html, 'text/html')

  for (const selector of REMOVE_SELECTORS) {
    for (const element of Array.from(doc.querySelectorAll(selector))) {
      element.remove()
    }
  }

  // Order matters: strip handlers/target first so no anchor can survive with them.
  stripEventHandlers(doc)
  rewriteAnchors(doc)
  fixMedia(doc)
  stripNavigationAttributes(doc)

  return doc.body.innerHTML
}
