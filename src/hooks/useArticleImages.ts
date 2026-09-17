import { useEffect, useState } from 'react'
import { getArticleImages } from '@/lib/wiki'
import type { ArticleImage } from '@/lib/wiki'

/**
 * Lead images for a set of article titles, fetched in one batched request.
 * Titles are joined into a stable key so passing a fresh array each render
 * does not refetch. A missing image is a normal outcome, not an error.
 */
export function useArticleImages(titles: readonly string[]) {
  const key = titles.join('|')
  const [images, setImages] = useState<Map<string, ArticleImage | null>>(() => new Map())

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    let cancelled = false
    getArticleImages(key.split('|'), controller.signal)
      .then((found) => {
        if (!cancelled) setImages(found)
      })
      .catch(() => {
        // Images are decoration. A failure leaves the typographic fallback.
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [key])

  return images
}
