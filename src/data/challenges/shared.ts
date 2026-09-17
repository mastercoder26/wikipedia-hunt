// Small builders shared by every category file. Keeps the raw catalog terse and
// makes the `key` field impossible to get out of sync with `title`.

import type { ArticleRef, Category, Challenge, Difficulty } from '@/lib/types'

/** Wikipedia db keys are just the canonical title with spaces swapped for underscores. */
export function ref(title: string): ArticleRef {
  return { title, key: title.replace(/ /g, '_') }
}

export type ChallengeFactory = (
  difficulty: Difficulty,
  id: string,
  start: string,
  target: string,
) => Challenge

/** Returns a terse factory bound to one category, used as `const c = make('science')`. */
export function make(category: Category): ChallengeFactory {
  return (difficulty, id, start, target) => ({
    id,
    start: ref(start),
    target: ref(target),
    category,
    difficulty,
  })
}
