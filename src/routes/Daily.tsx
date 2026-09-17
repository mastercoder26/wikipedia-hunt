import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '@/components/Shell'
import { Reveal } from '@/components/Reveal'
import { Button, Eyebrow, Stat } from '@/components/ui'
import { useRace } from '@/lib/game/raceStore'
import { dailyChallenge, dailyDateKey, dailyNumber, msUntilNextDaily } from '@/data/daily'
import { loadState } from '@/lib/game/storage'
import { formatDuration } from '@/lib/game/format'

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

  async function play() {
    navigate('/race')
    await begin(challenge, 'daily')
  }

  return (
    <Page wide>
      <Reveal as="header">
        <Eyebrow>Daily #{number}</Eyebrow>
        <h1 className="display display-xl mt-4 text-[clamp(2.75rem,8vw,5rem)] text-[var(--ink)]">
          {challenge.start.title} → {challenge.target.title}
        </h1>
        <p className="mt-4 text-[14px] text-[var(--ink-3)]">Next pair in {nextIn}</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Button variant="primary" size="lg" onClick={() => void play()}>
            Play today
          </Button>
        </div>
        {bestByClicks ? (
          <div className="mt-10">
            <Stat value={formatDuration(bestByClicks.durationMs)} label="Your time" accent />
          </div>
        ) : null}
      </Reveal>
    </Page>
  )
}
