import { useState } from 'react'
import type { ArticleImage as Image } from '@/lib/wiki'

/**
 * An article's lead image with its title on a frosted pill, or a typographic
 * tile when Wikipedia has no image for it. Plenty of articles have none, so
 * the fallback is a normal state and has to look deliberate.
 */
export function ArticleImage({
  title,
  image,
  label,
  tone = 'ink',
  className = '',
  aspect = 'aspect-[4/3]',
}: {
  title: string
  image?: Image | null
  /** Overrides the pill text. Defaults to the article title. */
  label?: string
  tone?: 'ink' | 'accent'
  className?: string
  aspect?: string
}) {
  const [failed, setFailed] = useState(false)
  const showImage = image && !failed

  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius)] bg-[var(--paper-2)] ${aspect} ${className}`}
    >
      {showImage ? (
        <img
          src={image.source}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6">
          <span
            aria-hidden="true"
            className={`display display-lg text-center leading-[0.95] text-[clamp(1.5rem,4vw,2.25rem)] opacity-25 ${
              tone === 'accent' ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
            }`}
          >
            {title.slice(0, 18)}
          </span>
        </div>
      )}
      <span className="frost absolute left-3 bottom-3 max-w-[calc(100%-1.5rem)] truncate rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--ink)]">
        {label ?? title}
      </span>
    </div>
  )
}
