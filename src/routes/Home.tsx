import { Link } from 'react-router-dom'
import { Page } from '@/components/Shell'
import { Reveal } from '@/components/Reveal'
import { ButtonLink, Panel } from '@/components/ui'

export function Home() {
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
        <Link to="/play" className="press block group">
          <Panel className="h-full p-6 flex items-baseline justify-between gap-4">
            <span className="display display-sm text-[20px] text-[var(--ink)]">Solo</span>
            <span className="text-[13px] text-[var(--ink-3)] group-hover:text-[var(--accent)] transition-colors">
              Race your own record
            </span>
          </Panel>
        </Link>
      </Reveal>
    </Page>
  )
}
