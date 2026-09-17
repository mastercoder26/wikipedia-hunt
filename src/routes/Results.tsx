import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '@/components/Shell'
import { Reveal } from '@/components/Reveal'
import { Button, EmptyState, Eyebrow, Stat, Tag } from '@/components/ui'
import { ShareCard } from '@/components/ShareCard'
import { ArticleImage } from '@/components/ArticleImage'
import { useArticleImages } from '@/hooks/useArticleImages'
import { useRace } from '@/lib/game/raceStore'
import { buildShareCard, formatDuration, formatPathArrow } from '@/lib/game/format'
import { loadState } from '@/lib/game/storage'
import { dailyNumber } from '@/data/daily'
import { findRoute } from '@/lib/game/route'
import type { PathStep } from '@/lib/types'

export function Results() {
  const navigate = useNavigate()
  const { challenge, mode, status, startedAt, finishedAt, clicks, clickLimit, path, reset, begin } =
    useRace()
  const [suggested, setSuggested] = useState<string[] | null>(null)
  const [routeBusy, setRouteBusy] = useState(false)

  const durationMs = startedAt && finishedAt ? finishedAt - startedAt : 0
  const images = useArticleImages(
    useMemo(() => (challenge ? [challenge.start.title, challenge.target.title] : []), [challenge]),
  )
  const surrendered = status === 'surrendered'

  const previousBest = useMemo(() => {
    if (!challenge) return undefined
    return loadState().personalBests?.[challenge.id]
  }, [challenge])

  // Mirrors storage's record rule: fewer clicks wins, ties broken on time.
  const isPersonalBest =
    !surrendered &&
    (!previousBest ||
      clicks < previousBest.clicks ||
      (clicks === previousBest.clicks && durationMs <= previousBest.durationMs))

  useEffect(() => {
    if (!challenge) navigate('/play', { replace: true })
  }, [challenge, navigate])

  if (!challenge || status === 'idle') {
    return (
      <Page>
        <EmptyState
          title="No race to show"
          body="Finish a race and the breakdown lands here."
          action={
            <Button variant="primary" onClick={() => navigate('/play')}>
              Start a race
            </Button>
          }
        />
      </Page>
    )
  }

  const avgPerClick = clicks > 0 ? durationMs / clicks : 0
  const share = buildShareCard(
    { challengeId: challenge.id, mode, durationMs, clicks, path, finishedAt: finishedAt ?? 0, surrendered },
    challenge,
    mode === 'daily' ? dailyNumber() : undefined,
  )

  async function revealRoute() {
    if (!challenge) return
    setRouteBusy(true)
    try {
      setSuggested(await findRoute(challenge.start, challenge.target))
    } finally {
      setRouteBusy(false)
    }
  }

  return (
    <Page wide>
      <Reveal as="header">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow index={surrendered ? '×' : '✓'}>{surrendered ? 'Abandoned' : 'Target reached'}</Eyebrow>
          {isPersonalBest ? <Tag tone="accent">Personal best</Tag> : null}
        </div>
        <h1 className="display display-xl mt-6 text-[clamp(2.25rem,7vw,4.5rem)] text-[var(--ink)] flex flex-wrap items-baseline gap-x-5">
          <span className="text-[var(--ink-3)]">{challenge.start.title}</span>
          <span className="text-[var(--accent)]" aria-label="to">
            →
          </span>
          <span>{challenge.target.title}</span>
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center max-w-2xl">
          <ArticleImage
            title={challenge.start.title}
            image={images.get(challenge.start.title)}
            label="Start"
            aspect="aspect-[16/10]"
          />
          <span
            aria-hidden="true"
            className="display display-lg justify-self-center text-[28px] text-[var(--accent)]"
          >
            →
          </span>
          <ArticleImage
            title={challenge.target.title}
            image={images.get(challenge.target.title)}
            label="Target"
            tone="accent"
            aspect="aspect-[16/10]"
          />
        </div>

        <div className="mt-11 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6">
          <Stat value={formatDuration(durationMs)} label="Time" accent size="lg" />
          <Stat value={clicks} label="Clicks" size="lg" />
          <Stat value={path.length} label="Articles" size="lg" />
          <Stat value={formatDuration(avgPerClick)} label="Per click" size="lg" />
        </div>

        {previousBest && !isPersonalBest ? (
          <p className="mt-6 text-[13px] text-[var(--ink-3)]">
            Your record for this pair is {formatDuration(previousBest.durationMs)} in{' '}
            {previousBest.clicks} clicks.
          </p>
        ) : null}

        <div className="mt-9 flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={async () => {
              navigate('/race')
              await begin(challenge, mode, { clickLimit })
            }}
          >
            Run it again
          </Button>
          <Button
            onClick={() => {
              reset()
              navigate('/play')
            }}
          >
            New pair
          </Button>
        </div>
      </Reveal>

      <div className="mt-20 grid gap-16 lg:grid-cols-[1.3fr_1fr] lg:gap-20">
        <section>
          <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Your route</h2>
          <RouteList path={path} targetTitle={challenge.target.title} />
        </section>

        <div>
          {surrendered ? (
            <section className="mb-14">
              <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">A route that works</h2>
              <div className="pt-5">
                {suggested ? (
                  suggested.length > 0 ? (
                    <p className="display display-sm text-[19px] leading-snug text-[var(--ink)]">
                      {suggested.join('  →  ')}
                    </p>
                  ) : (
                    <p className="text-[13.5px] text-[var(--ink-3)]">
                      No route was found within the search budget. Some pairs are that far apart.
                    </p>
                  )
                ) : (
                  <>
                    <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">
                      Search Wikipedia&rsquo;s links for a route you could have taken.
                    </p>
                    <Button size="sm" className="mt-4" onClick={revealRoute} disabled={routeBusy}>
                      {routeBusy ? 'Searching' : 'Show me'}
                    </Button>
                  </>
                )}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Share</h2>
            <div className="pt-5">
              <ShareCard text={share} />
            </div>
          </section>
        </div>
      </div>
    </Page>
  )
}

function RouteList({ path, targetTitle }: { path: PathStep[]; targetTitle: string }) {
  if (path.length === 0) return <p className="pt-5 text-[13.5px] text-[var(--ink-3)]">No articles visited.</p>
  return (
    <>
      <ol>
        {path.map((step, i) => {
          const isTarget = step.title === targetTitle
          return (
            <li
              key={`${step.key}-${i}`}
              className="grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-4 py-3 border-b border-[var(--rule-soft)]"
            >
              <span className={`eyebrow ${isTarget ? 'text-[var(--accent)]' : 'text-[var(--ink-3)]'}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={`display text-[19px] truncate ${
                  isTarget ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
                }`}
              >
                {step.title}
              </span>
              <span className="tnum font-mono text-[11.5px] text-[var(--ink-3)]">
                {formatDuration(step.at)}
                {step.viaBack ? ' ↩' : ''}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-5 text-[12.5px] leading-relaxed text-[var(--ink-3)]">{formatPathArrow(path)}</p>
    </>
  )
}
