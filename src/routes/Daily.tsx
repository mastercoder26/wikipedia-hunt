import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '@/components/Shell'
import { Reveal } from '@/components/Reveal'
import { Button, Eyebrow, Stat, Tag } from '@/components/ui'
import { ShareCard } from '@/components/ShareCard'
import { DailyLeaderboard } from '@/components/DailyLeaderboard'
import { useRace } from '@/lib/game/raceStore'
import { dailyChallenge, dailyDateKey, dailyNumber, msUntilNextDaily } from '@/data/daily'
import { loadState } from '@/lib/game/storage'
import { dailyStreak } from '@/lib/game/stats'
import { buildShareCard, formatDuration } from '@/lib/game/format'

function useCountdown() {
  const [ms, setMs] = useState(() => msUntilNextDaily())
  useEffect(() => {
    const id = window.setInterval(() => setMs(msUntilNextDaily()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function Daily() {
  const navigate = useNavigate()
  const begin = useRace((s) => s.begin)
  const challenge = dailyChallenge()
  const number = dailyNumber()
  const dateKey = dailyDateKey()
  const nextIn = useCountdown()

  const state = loadState()
  const bestByClicks = state.dailyResults?.[dateKey]
  const bestByTime = state.dailyTimeResults?.[dateKey]
  const streak = dailyStreak(state)

  async function play() {
    navigate('/race')
    await begin(challenge, 'daily')
  }

  return (
    <Page wide>
      <Reveal as="header">
        <div className="flex flex-wrap items-center gap-4">
          <Eyebrow>Daily Dash No. {number}</Eyebrow>
          {streak > 0 ? <Tag tone="good">{streak} day streak</Tag> : null}
          <span className="sm:ml-auto eyebrow">
            Resets in <span className="tnum font-mono text-[var(--ink)]">{nextIn}</span>
          </span>
        </div>

        <h1 className="display display-xl mt-7 text-[clamp(2.75rem,9vw,6rem)] text-[var(--ink)] flex flex-wrap items-baseline gap-x-6">
          <span>{challenge.start.title}</span>
          <span className="text-[var(--accent)]" aria-label="to">
            →
          </span>
          <span>{challenge.target.title}</span>
        </h1>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Button variant="primary" size="lg" onClick={play}>
            {bestByClicks ? 'Beat your run' : 'Start today\u2019s'}
          </Button>
          <p className="text-[14px] text-[var(--ink-3)]">Best run counts. Retry as often as you like.</p>
        </div>
      </Reveal>

      {bestByClicks || bestByTime ? (
        <section className="mt-16">
          <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Your day</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6 pt-8">
            <Stat
              value={bestByTime ? formatDuration(bestByTime.durationMs) : '—'}
              label="Fastest"
              hint={bestByTime ? `${bestByTime.clicks} clicks` : undefined}
              accent
            />
            <Stat
              value={bestByClicks ? bestByClicks.clicks : '—'}
              label="Fewest clicks"
              hint={bestByClicks ? formatDuration(bestByClicks.durationMs) : undefined}
            />
            <Stat value={streak} label="Streak" hint="days in a row" />
            <Stat
              value={bestByClicks ? bestByClicks.path.length : '—'}
              label="Articles"
              hint="on your best run"
            />
          </div>
        </section>
      ) : null}

      <div className="mt-14 grid gap-12 lg:gap-16 lg:grid-cols-2">
        <section>
          <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Global leaderboard</h2>
          <DailyLeaderboard dateKey={dateKey} />
        </section>

        {bestByTime ? (
          <section>
            <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Share</h2>
            <div className="pt-5">
              <ShareCard text={buildShareCard(bestByTime, challenge, number)} />
            </div>
          </section>
        ) : null}
      </div>
    </Page>
  )
}
