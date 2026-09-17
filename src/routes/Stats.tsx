import { useMemo, useState } from 'react'
import { Page } from '@/components/Shell'
import { Reveal } from '@/components/Reveal'
import { Button, ButtonLink, EmptyState, Eyebrow, Stat, Tag } from '@/components/ui'
import { loadState, resetStats } from '@/lib/game/storage'
import {
  averageClicks, bestTimeMs, dailyStreak, favoriteCategory,
  personalRecords, recentRoutes, totalRaces, wins,
} from '@/lib/game/stats'
import { formatClicks, formatDuration, formatPathArrow } from '@/lib/game/format'

export function Stats() {
  // `nonce` is the cache-bust: resetting stats bumps it to force a re-read.
  const [nonce, setNonce] = useState(0)
  const state = useMemo(() => {
    void nonce
    return loadState()
  }, [nonce])
  const [confirming, setConfirming] = useState(false)

  const races = totalRaces(state)
  const best = bestTimeMs(state)
  const records = personalRecords(state)
  const routes = recentRoutes(state, 8)

  if (races === 0) {
    return (
      <Page>
        <EmptyState
          title="No races yet"
          body="Your stats are kept in this browser. There is no account and nothing syncs. Finish a race and this fills in."
          action={
            <ButtonLink to="/play" variant="primary">
              Start your first race
            </ButtonLink>
          }
        />
      </Page>
    )
  }

  return (
    <Page wide>
      <Reveal as="header" className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Local only</Eyebrow>
          <h1 className="display display-xl mt-4 text-[clamp(2.75rem,8vw,5rem)] text-[var(--ink)]">
            Your record
          </h1>
        </div>
        <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
          Reset
        </Button>
      </Reveal>

      {confirming ? (
        <div className="mt-8 p-5 border-l-2 border-[var(--accent)] bg-[var(--accent-wash)]">
          <p className="text-[13.5px] text-[var(--ink)]">
            Delete every race, record and streak stored in this browser. This cannot be undone.
          </p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => setConfirming(false)}>
              Keep my stats
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                resetStats()
                setConfirming(false)
                setNonce((n) => n + 1)
              }}
            >
              Delete everything
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-7">
        <Stat value={races} label="Total races" />
        <Stat value={wins(state)} label="Live wins" />
        <Stat value={best === null ? '—' : formatDuration(best)} label="Best time" accent />
        <Stat value={averageClicks(state).toFixed(1)} label="Avg clicks" />
        <Stat value={dailyStreak(state)} label="Daily streak" />
        <Stat value={favoriteCategory(state) ?? '—'} label="Top category" />
      </div>

      <div className="mt-20 grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
        {records.length > 0 ? (
          <section>
            <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Personal records</h2>
            <ul>
              {records.slice(0, 8).map((record) => (
                <li
                  key={record.challengeId}
                  className="grid grid-cols-[1fr_auto] items-baseline gap-4 py-3.5 border-b border-[var(--rule-soft)]"
                >
                  <span className="display display-sm text-[17px] text-[var(--ink)] truncate">
                    {record.challengeId.replace(/^[a-z]+-/, '').replace(/-/g, ' ')}
                  </span>
                  <span className="tnum font-mono text-[12.5px] text-[var(--ink-2)] shrink-0">
                    {formatDuration(record.durationMs)} · {record.clicks}c
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Past routes</h2>
          <ul>
            {routes.map((race, i) => (
              <li
                key={`${race.challengeId}-${race.finishedAt}-${i}`}
                className="py-4 border-b border-[var(--rule-soft)]"
              >
                <div className="flex flex-wrap items-center gap-3 mb-1.5">
                  <Tag tone={race.surrendered ? 'neutral' : 'good'}>
                    {race.surrendered ? 'gave up' : race.mode}
                  </Tag>
                  <span className="tnum font-mono text-[12px] text-[var(--ink-2)]">
                    {formatDuration(race.durationMs)} · {formatClicks(race.clicks)}
                  </span>
                  <span className="ml-auto eyebrow">
                    {new Date(race.finishedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--ink-3)]">{formatPathArrow(race.path)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Page>
  )
}
