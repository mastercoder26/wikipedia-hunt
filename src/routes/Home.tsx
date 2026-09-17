import { Link } from 'react-router-dom'
import { Page } from '@/components/Shell'
import { Reveal } from '@/components/Reveal'
import { ButtonLink, Panel, Stat } from '@/components/ui'
import { ArticleImage } from '@/components/ArticleImage'
import { useArticleImages } from '@/hooks/useArticleImages'
import { dailyChallenge, dailyNumber } from '@/data/daily'
import { CHALLENGES } from '@/data/challenges'
import { loadState } from '@/lib/game/storage'
import { bestTimeMs, totalRaces } from '@/lib/game/stats'
import { formatDuration } from '@/lib/game/format'

const MODES = [
  { to: '/play', name: 'Solo', line: 'Race your own record' },
  { to: '/live', name: 'Live', line: 'Up to eight players' },
  { to: '/daily', name: 'Daily', line: 'One pair for everyone' },
]

export function Home() {
  const today = dailyChallenge()
  const number = dailyNumber()
  const state = loadState()
  const images = useArticleImages([today.start.title, today.target.title])

  return (
    <Page wide>
      <Reveal as="section">
        <h1 className="display display-xl text-[clamp(2.75rem,7.5vw,5.25rem)] text-[var(--ink)] max-w-[16ch]">
          Get from here to there using only links.
        </h1>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <ButtonLink to="/play" variant="primary" size="lg">
            Start a race
          </ButtonLink>
          <ButtonLink to="/daily" variant="secondary" size="lg">
            Daily #{number}
          </ButtonLink>
          <p className="text-[15px] text-[var(--ink-3)] sm:ml-3">No search. No new tabs.</p>
        </div>
      </Reveal>

      <Reveal delay={0.06} className="mt-14">
        <Link to="/daily" className="press block group">
          <Panel className="overflow-hidden p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <ArticleImage
                title={today.start.title}
                image={images.get(today.start.title)}
                aspect="aspect-[16/9]"
              />
              <span
                aria-label="to"
                className="display justify-self-center text-[28px] text-[var(--accent)]"
              >
                →
              </span>
              <ArticleImage
                title={today.target.title}
                image={images.get(today.target.title)}
                tone="accent"
                aspect="aspect-[16/9]"
              />
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-3 px-1 pt-5 pb-1">
              <p className="display display-sm text-[clamp(1.125rem,2.5vw,1.5rem)] text-[var(--ink)]">
                Daily #{number}
              </p>
              <span className="text-[14px] text-[var(--ink-3)] group-hover:text-[var(--accent)] transition-colors">
                Play today&rsquo;s →
              </span>
            </div>
          </Panel>
        </Link>
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {MODES.map((mode) => (
            <Link key={mode.to} to={mode.to} className="press block group">
              <Panel className="h-full p-6 flex items-baseline justify-between gap-4">
                <span className="display display-sm text-[20px] text-[var(--ink)]">{mode.name}</span>
                <span className="text-[13px] text-[var(--ink-3)] group-hover:text-[var(--accent)] transition-colors text-right">
                  {mode.line}
                </span>
              </Panel>
            </Link>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.14} className="mt-4">
        <Panel className="p-7 sm:p-9 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-8">
          <Stat value={CHALLENGES.length} label="Pairs" />
          <Stat value={7} label="Categories" />
          <Stat value={totalRaces(state)} label="Races" />
          <Stat
            value={bestTimeMs(state) === null ? '—' : formatDuration(bestTimeMs(state) as number)}
            label="Best time"
            accent
          />
        </Panel>
      </Reveal>
    </Page>
  )
}
