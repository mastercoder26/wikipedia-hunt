import { Link } from 'react-router-dom'
import { Page } from '@/components/Shell'
import { Reveal } from '@/components/Reveal'
import { ButtonLink, Panel, Stat } from '@/components/ui'
import { CHALLENGES } from '@/data/challenges'
import { loadState } from '@/lib/game/storage'

const MODES = [{ to: '/play', name: 'Solo', line: 'Race your own record' }]

export function Home() {
  const state = loadState()
  const races = state.races.length

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
          <p className="text-[15px] text-[var(--ink-3)] sm:ml-3">No search. No new tabs.</p>
        </div>
      </Reveal>

      <Reveal delay={0.1} className="mt-14">
        <div className="grid gap-4 sm:grid-cols-2">
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
        <Panel className="p-7 sm:p-9 grid grid-cols-2 gap-x-8 gap-y-8">
          <Stat value={CHALLENGES.length} label="Pairs" />
          <Stat value={races} label="Races" />
        </Panel>
      </Reveal>
    </Page>
  )
}
