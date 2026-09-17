import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArticleHtml } from '@/lib/wiki'
import type { Challenge } from '@/lib/types'

const { fetchArticleHtml } = vi.hoisted(() => ({
  fetchArticleHtml: vi.fn<(key: string) => Promise<ArticleHtml>>(),
}))

vi.mock('@/lib/wiki', () => ({ fetchArticleHtml }))

import { useRace } from '@/lib/game/raceStore'

const CHALLENGE: Challenge = {
  id: 'race-1',
  start: { title: 'Start', key: 'Start' },
  target: { title: 'Target', key: 'Target' },
  category: 'science',
  difficulty: 'easy',
}

function article(key: string): ArticleHtml {
  return { key, title: key.replace(/_/g, ' '), html: `<p>${key}</p>` }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('raceStore', () => {
  beforeEach(() => {
    fetchArticleHtml.mockReset()
    useRace.getState().reset()
  })

  it('ignores a second navigation while the first article is loading', async () => {
    const next = deferred<ArticleHtml>()
    fetchArticleHtml.mockImplementation((key) =>
      key === 'Start' ? Promise.resolve(article(key)) : next.promise,
    )
    await useRace.getState().begin(CHALLENGE, 'solo')

    const first = useRace.getState().go('First', 'First')
    const second = useRace.getState().go('Second', 'Second')

    expect(fetchArticleHtml).toHaveBeenCalledTimes(2)
    expect(useRace.getState().clicks).toBe(1)
    next.resolve(article('First'))
    await Promise.all([first, second])
    expect(useRace.getState().path.map((step) => step.key)).toEqual(['Start', 'First'])
  })

  it('does not let an older begin request overwrite a newer race', async () => {
    const oldStart = deferred<ArticleHtml>()
    const newStart = deferred<ArticleHtml>()
    fetchArticleHtml.mockImplementation((key) =>
      key === 'Start' ? oldStart.promise : newStart.promise,
    )
    const newerChallenge: Challenge = {
      ...CHALLENGE,
      id: 'race-2',
      start: { title: 'New Start', key: 'New_Start' },
    }

    const oldBegin = useRace.getState().begin(CHALLENGE, 'solo')
    const newBegin = useRace.getState().begin(newerChallenge, 'solo')
    newStart.resolve(article('New_Start'))
    await newBegin
    oldStart.resolve(article('Start'))
    await oldBegin

    expect(useRace.getState().challenge?.id).toBe('race-2')
    expect(useRace.getState().currentKey).toBe('New_Start')
    expect(useRace.getState().path.map((step) => step.key)).toEqual(['New_Start'])
  })

  it('ends on the final allowed link when it does not reach the target', async () => {
    fetchArticleHtml.mockImplementation(async (key) => article(key))
    await useRace.getState().begin(CHALLENGE, 'solo', { clickLimit: 1 })

    await useRace.getState().go('Other', 'Other')

    expect(useRace.getState().clicks).toBe(1)
    expect(useRace.getState().status).toBe('surrendered')
    expect(useRace.getState().currentKey).toBe('Other')
  })

  it('applies the same click-limit boundary to back navigation', async () => {
    fetchArticleHtml.mockImplementation(async (key) => article(key))
    await useRace.getState().begin(CHALLENGE, 'solo', { clickLimit: 2 })
    await useRace.getState().go('Other', 'Other')

    await useRace.getState().back()

    expect(useRace.getState().clicks).toBe(2)
    expect(useRace.getState().status).toBe('surrendered')
    expect(useRace.getState().currentKey).toBe('Start')
  })

  it('continues backward through history on consecutive back actions', async () => {
    fetchArticleHtml.mockImplementation(async (key) => article(key))
    await useRace.getState().begin(CHALLENGE, 'solo')
    await useRace.getState().go('Second', 'Second')
    await useRace.getState().go('Third', 'Third')

    await useRace.getState().back()
    await useRace.getState().back()

    expect(useRace.getState().currentKey).toBe('Start')
    expect(useRace.getState().path.map((step) => step.key)).toEqual([
      'Start',
      'Second',
      'Third',
      'Second',
      'Start',
    ])
  })

  it('retries a failed article fetch without charging another click', async () => {
    fetchArticleHtml
      .mockResolvedValueOnce(article('Start'))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(article('Second'))
    await useRace.getState().begin(CHALLENGE, 'solo')
    await useRace.getState().go('Second', 'Second')

    expect(useRace.getState().error).toBe('network down')
    expect(useRace.getState().clicks).toBe(1)
    await useRace.getState().retry()

    expect(useRace.getState().currentKey).toBe('Second')
    expect(useRace.getState().clicks).toBe(1)
    expect(useRace.getState().error).toBeNull()
  })
})
