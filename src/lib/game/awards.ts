import type { Award, AwardId, RoomPlayer } from '@/lib/types'

const PHOTO_FINISH_WINDOW_MS = 3_000

const AWARD_COPY: Record<AwardId, Pick<Award, 'label' | 'description'>> = {
  speedrunner: {
    label: 'Speedrunner',
    description: 'Fastest completion',
  },
  minimalist: {
    label: 'Minimalist',
    description: 'Fewest clicks',
  },
  explorer: {
    label: 'Explorer',
    description: 'Visited the most articles',
  },
  'photo-finish': {
    label: 'Photo Finish',
    description: 'Finished within 3 seconds of the winner',
  },
  'lost-in-the-wiki': {
    label: 'Lost in the Wiki',
    description: 'Longest route',
  },
}

function finishedPlayers(players: readonly RoomPlayer[]): RoomPlayer[] {
  return players.filter(
    (player) =>
      player.state === 'finished' &&
      player.durationMs !== undefined &&
      Number.isFinite(player.durationMs),
  )
}

function comparePlayerId(left: RoomPlayer, right: RoomPlayer): number {
  return left.id.localeCompare(right.id)
}

function articleCount(player: RoomPlayer): number {
  return new Set((player.path ?? []).map((title) => title.trim().toLocaleLowerCase())).size
}

function award(id: AwardId, player: RoomPlayer): Award {
  return { id, ...AWARD_COPY[id], playerId: player.id }
}

export function computeAwards(players: readonly RoomPlayer[]): Award[] {
  const finishers = finishedPlayers(players)
  if (finishers.length === 0) return []

  const fastest = [...finishers].sort(
    (left, right) =>
      (left.durationMs ?? Infinity) - (right.durationMs ?? Infinity) ||
      comparePlayerId(left, right),
  )[0]
  const minimalist = [...finishers].sort(
    (left, right) => left.clicks - right.clicks || comparePlayerId(left, right),
  )[0]
  const explorer = [...finishers].sort(
    (left, right) => articleCount(right) - articleCount(left) || comparePlayerId(left, right),
  )[0]
  const longest = [...finishers].sort(
    (left, right) =>
      (right.path?.length ?? 0) - (left.path?.length ?? 0) || comparePlayerId(left, right),
  )[0]

  const results = [
    award('speedrunner', fastest),
    award('minimalist', minimalist),
    award('explorer', explorer),
  ]
  const winnerTime = fastest.durationMs ?? Infinity
  const photoFinisher = finishers
    .filter(
      (player) =>
        player.id !== fastest.id &&
        (player.durationMs ?? Infinity) - winnerTime <= PHOTO_FINISH_WINDOW_MS,
    )
    .sort(
      (left, right) =>
        (left.durationMs ?? Infinity) - (right.durationMs ?? Infinity) ||
        comparePlayerId(left, right),
    )[0]

  if (photoFinisher !== undefined) results.push(award('photo-finish', photoFinisher))
  results.push(award('lost-in-the-wiki', longest))
  return results
}

/**
 * Obscurity heuristic: among titles visited by exactly one player, prefer the
 * longest trimmed title, then alphabetical order. It is stable and needs no API.
 */
export function mostUnusualArticle(players: readonly RoomPlayer[]): string | undefined {
  const visitors = new Map<string, { title: string; playerIds: Set<string> }>()

  for (const player of players) {
    for (const rawTitle of new Set(player.path ?? [])) {
      const title = rawTitle.trim()
      const key = title.toLocaleLowerCase()
      const current = visitors.get(key) ?? { title, playerIds: new Set<string>() }
      visitors.set(key, {
        title: current.title.localeCompare(title) <= 0 ? current.title : title,
        playerIds: new Set([...current.playerIds, player.id]),
      })
    }
  }

  return [...visitors.values()]
    .filter(({ playerIds }) => playerIds.size === 1)
    .map(({ title }) => title)
    .sort((left, right) => right.length - left.length || left.localeCompare(right))[0]
}

export function shortestRoute(players: readonly RoomPlayer[]): RoomPlayer | undefined {
  const shortest = finishedPlayers(players)
    .filter((player) => player.path !== undefined)
    .sort(
      (left, right) =>
        (left.path?.length ?? Infinity) - (right.path?.length ?? Infinity) ||
        comparePlayerId(left, right),
    )[0]

  return shortest === undefined
    ? undefined
    : { ...shortest, path: shortest.path === undefined ? undefined : [...shortest.path] }
}
