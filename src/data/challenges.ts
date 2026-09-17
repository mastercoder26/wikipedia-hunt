// The curated challenge catalog. Raw data lives in ./challenges/<category>.ts so
// that each category stays browsable; this module composes and queries them.

import type { Category, Challenge, Difficulty } from '@/lib/types'
import { ENTERTAINMENT_CHALLENGES } from './challenges/entertainment'
import { GEOGRAPHY_CHALLENGES } from './challenges/geography'
import { HISTORY_CHALLENGES } from './challenges/history'
import { RANDOM_CHALLENGES } from './challenges/random'
import { SCIENCE_CHALLENGES } from './challenges/science'
import { SPORTS_CHALLENGES } from './challenges/sports'
import { TECHNOLOGY_CHALLENGES } from './challenges/technology'

export const CHALLENGES: Challenge[] = [
  ...SCIENCE_CHALLENGES,
  ...HISTORY_CHALLENGES,
  ...SPORTS_CHALLENGES,
  ...GEOGRAPHY_CHALLENGES,
  ...ENTERTAINMENT_CHALLENGES,
  ...TECHNOLOGY_CHALLENGES,
  ...RANDOM_CHALLENGES,
]

const CHALLENGES_BY_ID: ReadonlyMap<string, Challenge> = new Map(
  CHALLENGES.map((challenge) => [challenge.id, challenge]),
)

/** Filter the catalog. Omitting a facet leaves it unconstrained. */
export function challengesBy(category?: Category, difficulty?: Difficulty): Challenge[] {
  return CHALLENGES.filter(
    (challenge) =>
      (category === undefined || challenge.category === category) &&
      (difficulty === undefined || challenge.difficulty === difficulty),
  )
}

/**
 * Pick a random challenge matching the filters. Falls back to the whole catalog
 * when a filter combination has no matches, so callers always get a playable race.
 */
export function randomChallenge(category?: Category, difficulty?: Difficulty): Challenge {
  const pool = challengesBy(category, difficulty)
  const source = pool.length > 0 ? pool : CHALLENGES
  return source[Math.floor(Math.random() * source.length)]
}

export function challengeById(id: string): Challenge | undefined {
  return CHALLENGES_BY_ID.get(id)
}
