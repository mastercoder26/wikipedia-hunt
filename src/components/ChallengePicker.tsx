import { useMemo, useState } from 'react'
import { Button, Panel } from './ui'
import { ArticleSearch } from './ArticleSearch'
import { challengesBy, randomChallenge } from '@/data/challenges'
import { getRandomArticles } from '@/lib/wiki'
import type { ArticleRef, Category, Challenge, Difficulty } from '@/lib/types'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'science', label: 'Science' },
  { id: 'history', label: 'History' },
  { id: 'sports', label: 'Sports' },
  { id: 'geography', label: 'Geography' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'technology', label: 'Technology' },
  { id: 'random', label: 'Random' },
]

const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Closely connected topics' },
  { id: 'medium', label: 'Medium', hint: 'Different topics, several logical connections' },
  { id: 'hard', label: 'Hard', hint: 'Extremely unrelated' },
]

type Tab = 'curated' | 'custom' | 'random'

const TABS: [Tab, string][] = [
  ['curated', 'Curated'],
  ['custom', 'Custom'],
  ['random', 'Random'],
]

export function ChallengePicker({
  onSelect,
  ctaLabel = 'Start race',
}: {
  onSelect: (challenge: Challenge) => void
  ctaLabel?: string
}) {
  const [tab, setTab] = useState<Tab>('curated')
  const [category, setCategory] = useState<Category | undefined>()
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>()
  const [start, setStart] = useState<ArticleRef | null>(null)
  const [target, setTarget] = useState<ArticleRef | null>(null)
  const [rolling, setRolling] = useState(false)
  const [rollError, setRollError] = useState<string | null>(null)

  const list = useMemo(() => challengesBy(category, difficulty), [category, difficulty])
  const visible = useMemo(() => list.slice(0, 24), [list])

  async function rollTrueRandom() {
    setRolling(true)
    setRollError(null)
    try {
      const [a, b] = await getRandomArticles(2)
      if (!a || !b) throw new Error('Wikipedia returned too few articles.')
      onSelect({
        id: `random-${a.key}-${b.key}`,
        start: a,
        target: b,
        category: 'random',
        difficulty: 'hard',
      })
    } catch (err) {
      setRollError(err instanceof Error ? err.message : 'Could not reach Wikipedia.')
    } finally {
      setRolling(false)
    }
  }

  return (
    <div>
      <div role="tablist" className="inline-flex items-stretch gap-1 p-1 rounded-full bg-[var(--paper-2)]">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`press px-4 h-8 rounded-full text-[13.5px] font-medium ${
              tab === id
                ? 'bg-[var(--raised)] text-[var(--ink)] shadow-[var(--shadow-float)]'
                : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'curated' ? (
        <div className="pt-6">
          <Filters
            category={category}
            difficulty={difficulty}
            onCategory={setCategory}
            onDifficulty={setDifficulty}
          />

          <div className="mt-8 mb-3 flex items-baseline justify-between gap-4">
            <span className="text-[13px] text-[var(--ink-3)]">
              {visible.length < list.length
                ? `Showing ${visible.length} of ${list.length} pairs`
                : `${list.length} pair${list.length === 1 ? '' : 's'}`}
            </span>
            <button
              onClick={() => {
                const pick = randomChallenge(category, difficulty)
                if (pick) onSelect(pick)
              }}
              disabled={list.length === 0}
              className="text-[13px] font-medium text-[var(--accent)] hover:underline underline-offset-4 disabled:opacity-35"
            >
              Surprise me →
            </button>
          </div>

          {list.length === 0 ? (
            <p className="py-10 text-[14px] text-[var(--ink-3)]">
              No challenges match that combination. Try another filter.
            </p>
          ) : (
            <Panel className="overflow-hidden">
              <ul>
                {visible.map((challenge) => (
                  <li key={challenge.id}>
                    <button
                      onClick={() => onSelect(challenge)}
                      className="group w-full text-left flex items-center gap-4 px-5 py-4 border-b border-[var(--rule-soft)] last:border-0 hover:bg-[var(--paper-2)] transition-colors"
                    >
                      <span className="min-w-0 flex-1 text-[15.5px] font-medium text-[var(--ink)] truncate">
                        {challenge.start.title}
                        <span className="text-[var(--accent)] mx-2">→</span>
                        {challenge.target.title}
                      </span>
                      <span className="shrink-0 text-[12px] text-[var(--ink-3)] opacity-0 group-hover:opacity-100 transition-opacity">
                        {challenge.difficulty}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      ) : null}

      {tab === 'custom' ? (
        <div className="pt-8 max-w-xl">
          <div className="grid gap-6">
            <ArticleSearch label="Starting article" value={start} onChange={setStart} placeholder="Beagle" />
            <ArticleSearch label="Target article" value={target} onChange={setTarget} placeholder="Apollo 11" />
          </div>
          <Button
            variant="primary"
            size="lg"
            className="mt-8 w-full"
            disabled={!start || !target || start.key === target.key}
            onClick={() => {
              if (!start || !target) return
              onSelect({
                id: `custom-${start.key}-${target.key}`,
                start,
                target,
                category: 'random',
                difficulty: 'medium',
              })
            }}
          >
            {ctaLabel}
          </Button>
          {start && target && start.key === target.key ? (
            <p className="mt-3 text-[13px] text-[var(--accent)]">
              The start and the target need to be different articles.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'random' ? (
        <div className="pt-8 max-w-xl">
          <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">
            Two articles pulled at random from Wikipedia. Disambiguation and list pages are filtered out.
            Nothing else is.
          </p>
          <Button variant="primary" size="lg" className="mt-6" onClick={rollTrueRandom} disabled={rolling}>
            {rolling ? 'Rolling' : 'Roll a random pair'}
          </Button>
          {rollError ? <p className="mt-3 text-[13px] text-[var(--accent)]">{rollError}</p> : null}

          <Panel bordered={false} className="mt-10 pt-8 border-t border-[var(--rule-soft)] shadow-none rounded-none bg-transparent">
            <p className="mb-5 text-[13px] text-[var(--ink-3)]">Or roll from the curated list</p>
            <Filters
              category={category}
              difficulty={difficulty}
              onCategory={setCategory}
              onDifficulty={setDifficulty}
            />
            <Button
              className="mt-6"
              onClick={() => {
                const pick = randomChallenge(category, difficulty)
                if (pick) onSelect(pick)
              }}
            >
              Roll curated
            </Button>
          </Panel>
        </div>
      ) : null}
    </div>
  )
}

function Filters({
  category,
  difficulty,
  onCategory,
  onDifficulty,
}: {
  category?: Category
  difficulty?: Difficulty
  onCategory: (c?: Category) => void
  onDifficulty: (d?: Difficulty) => void
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:gap-10">
      <div>
        <p className="mb-3 text-[13px] text-[var(--ink-3)]">Category</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <FilterLink active={!category} onClick={() => onCategory(undefined)}>
            All
          </FilterLink>
          {CATEGORIES.map((c) => (
            <FilterLink key={c.id} active={category === c.id} onClick={() => onCategory(c.id)}>
              {c.label}
            </FilterLink>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-3 text-[13px] text-[var(--ink-3)]">Difficulty</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <FilterLink active={!difficulty} onClick={() => onDifficulty(undefined)}>
            Any
          </FilterLink>
          {DIFFICULTIES.map((d) => (
            <FilterLink
              key={d.id}
              active={difficulty === d.id}
              onClick={() => onDifficulty(d.id)}
              title={d.hint}
            >
              {d.label}
            </FilterLink>
          ))}
        </div>
        {difficulty ? (
          <p className="mt-2.5 text-[12px] text-[var(--ink-3)]">
            {DIFFICULTIES.find((d) => d.id === difficulty)?.hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** Filters read as a masthead list, underlined when active. */
function FilterLink({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`text-[13.5px] pb-0.5 border-b transition-colors ${
        active
          ? 'text-[var(--ink)] border-[var(--accent)]'
          : 'text-[var(--ink-3)] border-transparent hover:text-[var(--ink)]'
      }`}
    >
      {children}
    </button>
  )
}
