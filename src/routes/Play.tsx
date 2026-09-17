import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '@/components/Shell'
import { Reveal } from '@/components/Reveal'
import { ChallengePicker } from '@/components/ChallengePicker'
import { Eyebrow, Stat } from '@/components/ui'
import { useRace } from '@/lib/game/raceStore'
import { loadState } from '@/lib/game/storage'
import { formatDuration } from '@/lib/game/format'
import type { Challenge } from '@/lib/types'

const LIMITS = [undefined, 10, 7, 5] as const

export function Play() {
  const navigate = useNavigate()
  const begin = useRace((s) => s.begin)
  const [clickLimit, setClickLimit] = useState<number | undefined>(undefined)

  async function start(challenge: Challenge) {
    navigate('/race')
    await begin(challenge, 'solo', { clickLimit })
  }

  const pbs = Object.values(loadState().personalBests ?? {}).slice(0, 4)

  return (
    <Page wide>
      <Reveal as="header">
        <Eyebrow>Solo</Eyebrow>
        <h1 className="display display-xl mt-4 text-[clamp(2.75rem,8vw,5rem)] text-[var(--ink)]">
          Solo Dash
        </h1>
      </Reveal>

      <section className="mt-10 flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <span className="text-[13px] text-[var(--ink-3)]">Click limit</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {LIMITS.map((limit) => (
            <button
              key={String(limit)}
              onClick={() => setClickLimit(limit)}
              className={`text-[13.5px] pb-0.5 border-b transition-colors ${
                clickLimit === limit
                  ? 'text-[var(--ink)] border-[var(--accent)]'
                  : 'text-[var(--ink-3)] border-transparent hover:text-[var(--ink)]'
              }`}
            >
              {limit === undefined ? 'No limit' : `${limit} clicks`}
            </button>
          ))}
        </div>

      </section>

      <div className="mt-10">
        <ChallengePicker onSelect={start} />
      </div>

      {pbs.length > 0 ? (
        <section className="mt-20">
          <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Records to beat</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6 pt-8">
            {pbs.map((pb) => (
              <Stat
                key={pb.challengeId}
                value={formatDuration(pb.durationMs)}
                label={pb.challengeId.replace(/^[a-z]+-/, '').replace(/-/g, ' ')}
                hint={`${pb.clicks} clicks`}
              />
            ))}
          </div>
        </section>
      ) : null}
    </Page>
  )
}
