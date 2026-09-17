import { useEffect, useRef } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { REDUCED, SPRING } from '@/lib/motion'

interface Props {
  html: string
  loading: boolean
  /** Titles already visited. These links render in the visited colour. */
  visited: Set<string>
  /** The target article title, so its links can glow. */
  targetTitle: string
  onNavigate: (key: string, title: string) => void
}

function normalize(s: string) {
  return s.replace(/_/g, ' ').trim().toLowerCase()
}

/**
 * Renders sanitized Wikipedia HTML and owns every click inside it.
 *
 * Link handling is one delegated listener rather than per-anchor handlers.
 * An article can carry thousands of links, and rebinding them on every
 * render would cost more than the rest of the frame.
 */
export function ArticleReader({ html, loading, visited, targetTitle, onNavigate }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  // Paint link state after each article swap.
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const target = normalize(targetTitle)
    root.querySelectorAll<HTMLAnchorElement>('a.wd-link').forEach((a) => {
      const title = a.dataset.wikiTitle ?? ''
      if (visited.has(title)) a.dataset.visited = 'true'
      else delete a.dataset.visited
      if (normalize(title) === target) a.dataset.target = 'true'
    })
  }, [html, visited, targetTitle])

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a.wd-link') as HTMLAnchorElement | null
      if (!anchor) {
        // Everything else is inert, including the spans the sanitizer
        // leaves behind.
        const dead = (event.target as HTMLElement | null)?.closest?.('.wd-link-disabled')
        if (dead) event.preventDefault()
        return
      }
      event.preventDefault()
      // No cmd/ctrl/middle-click route into a new tab.
      const key = anchor.dataset.wikiKey
      const title = anchor.dataset.wikiTitle
      if (key && title) onNavigate(key, title)
    }

    const onAux = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest?.('a')) event.preventDefault()
    }

    const onContext = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest?.('a')) event.preventDefault()
    }

    root.addEventListener('click', onClick)
    root.addEventListener('auxclick', onAux)
    root.addEventListener('contextmenu', onContext)
    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('auxclick', onAux)
      root.removeEventListener('contextmenu', onContext)
    }
    // `html` is a dependency because the container does not exist on the first
    // render (the skeleton renders instead), so the listener has to re-attach
    // once there is an article to attach it to.
  }, [onNavigate, html])

  // Scroll back to the top whenever a new article arrives.
  useEffect(() => {
    if (html) window.scrollTo({ top: 0, behavior: 'auto' })
  }, [html])

  if (loading && !html) return <ArticleSkeleton />

  return (
    <div className="relative">
      {/* While the next article is in flight the current one recedes rather
          than freezing, so the wait reads as motion instead of a stall. */}
      <m.div
        animate={{ opacity: loading ? 0.42 : 1 }}
        transition={reduced ? REDUCED : SPRING.quick}
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={html.slice(0, 64)}
            ref={ref}
            className="wd-article"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? REDUCED : SPRING.ui}
            // Safe: this HTML has already been parsed and rewritten by
            // sanitizeArticleHtml, which strips scripts, handlers and targets.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </AnimatePresence>
      </m.div>
    </div>
  )
}

export function ArticleSkeleton() {
  return (
    <div className="wd-article" aria-hidden="true">
      <div className="wd-skeleton h-8 w-2/3 mb-6" />
      <div className="wd-skeleton h-4 w-full mb-2.5" />
      <div className="wd-skeleton h-4 w-[96%] mb-2.5" />
      <div className="wd-skeleton h-4 w-[88%] mb-2.5" />
      <div className="wd-skeleton h-4 w-[92%] mb-6" />
      <div className="wd-skeleton h-40 w-full mb-6" />
      <div className="wd-skeleton h-4 w-full mb-2.5" />
      <div className="wd-skeleton h-4 w-[90%] mb-2.5" />
      <div className="wd-skeleton h-4 w-[70%]" />
    </div>
  )
}
