import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { REDUCED, SPRING, materialize } from '@/lib/motion'
import { useRace } from '@/lib/game/raceStore'
import { ArticleReader } from '@/components/ArticleReader'
import { ClickCounter, ProgressTrail, RaceTimer } from '@/components/RaceHud'
import { useElapsed } from '@/hooks/useElapsed'
import { Button, Tag } from '@/components/ui'
import { recordRace } from '@/lib/game/storage'
import { playFinish } from '@/lib/game/sound'
import { submitDaily } from '@/lib/game/dailySubmit'
import type { RaceResult } from '@/lib/types'

export function Race({
  onFinish,
  overlayActions,
}: {
  onFinish?: (result: RaceResult) => void
  /** Live Race replaces the solo finish buttons with room-aware ones. */
  overlayActions?: React.ReactNode
}) {
  const navigate = useNavigate()
  const {
    challenge, mode, status, startedAt, finishedAt, clicks, clickLimit,
    path, html, currentTitle, loading, error, visited, go, back, retry, surrender, reset,
  } = useRace()

  const elapsed = useElapsed(startedAt, finishedAt)
  const [trailOpen, setTrailOpen] = useState(false)
  const [confirmSurrender, setConfirmSurrender] = useState(false)

  // No challenge means a direct URL hit or a reload. Send them home.
  useEffect(() => {
    if (!challenge) navigate('/play', { replace: true })
  }, [challenge, navigate])

  const done = status === 'finished' || status === 'surrendered'

  const result = useMemo<RaceResult | null>(() => {
    if (!challenge || !done || !startedAt || !finishedAt) return null
    return {
      challengeId: challenge.id,
      mode,
      durationMs: finishedAt - startedAt,
      clicks,
      path,
      finishedAt,
      surrendered: status === 'surrendered',
      clickLimit,
    }
  }, [challenge, done, startedAt, finishedAt, mode, clicks, path, status, clickLimit])

  // Record and celebrate exactly once, when the race lands.
  useEffect(() => {
    if (!result || !challenge) return
    // LiveRoom records live races instead, once the winner is known.
    // Recording here would always store them as a loss.
    if (mode !== 'live') recordRace(result, challenge)
    onFinish?.(result)
    if (mode === 'daily' && !result.surrendered) void submitDaily(result)
    if (!result.surrendered) {
      playFinish()
      confetti({ particleCount: 90, spread: 72, origin: { y: 0.28 }, disableForReducedMotion: true })
    }
  }, [result, challenge, onFinish, mode])

  if (!challenge) return null

  return (
    <div className="min-h-full bg-[var(--paper)] flex flex-col">
      <div className="sticky top-0 z-40 px-3 sm:px-5 pt-3 sm:pt-4 pointer-events-none">
        <header className="chrome pointer-events-auto mx-auto max-w-[52rem] rounded-[22px] px-4 sm:px-5 py-2.5">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1 flex items-baseline gap-2.5 text-[14px]">
              <span className="truncate text-[var(--ink-3)]">{challenge.start.title}</span>
              <span aria-hidden="true" className="text-[var(--accent)] shrink-0">
                →
              </span>
              <span className="display display-sm truncate text-[17px] text-[var(--ink)]">
                {challenge.target.title}
              </span>
            </div>

            <div className="flex items-baseline gap-4 sm:gap-6 shrink-0">
              <div className="text-right">
                <RaceTimer ms={elapsed} />
              </div>
              <div className="text-right text-[var(--ink-3)]">
                <ClickCounter clicks={clicks} limit={clickLimit} />
              </div>
            </div>
          </div>

          <div className="mt-1.5 pt-1.5 border-t border-[var(--rule-soft)] flex items-center gap-3">
            <button
              onClick={back}
              disabled={path.length < 2 || done || loading}
              className="press shrink-0 text-[13px] text-[var(--ink-2)] hover:text-[var(--ink)] disabled:opacity-30 disabled:pointer-events-none"
            >
              ← Back
            </button>
            <button
              onClick={() => setTrailOpen((v) => !v)}
              className="min-w-0 flex-1 text-left py-0.5 hover:opacity-70 transition-opacity"
              aria-expanded={trailOpen}
            >
              <ProgressTrail path={path} compact={!trailOpen} />
            </button>
            {!done ? (
              <button
                onClick={() => setConfirmSurrender(true)}
                className="press shrink-0 text-[13px] text-[var(--ink-3)] hover:text-[var(--accent)]"
              >
                Give up
              </button>
            ) : null}
          </div>
        </header>
      </div>

      <main className="flex-1 w-full mx-auto max-w-[52rem] px-4 sm:px-8 py-9">
        {error ? (
          <div className="mb-8 p-5 rounded-[var(--radius)] bg-[var(--accent-wash)]">
            <p className="text-[13.5px] text-[var(--ink)]">{error}</p>
            <Button
              size="sm"
              className="mt-2.5"
              onClick={retry}
            >
              Try again
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-8">
          <h1 className="display display-lg text-[30px] text-[var(--ink)] truncate">{currentTitle}</h1>
          <span className="ml-auto flex gap-1.5">
            <Tag>{challenge.difficulty}</Tag>
            {clickLimit !== undefined ? <Tag tone="accent">{clickLimit} max</Tag> : null}
          </span>
        </div>

        <ArticleReader
          html={html}
          loading={loading}
          visited={visited}
          targetTitle={challenge.target.title}
          onNavigate={go}
        />
      </main>

      <AnimatePresence>
        {confirmSurrender && !done ? (
          <Overlay key="surrender" onClose={() => setConfirmSurrender(false)}>
          <h2 className="display text-[30px] text-[var(--ink)]">Give up on this one?</h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
            The run is still recorded, and you will see a route that would have worked.
          </p>
          <div className="mt-5 flex gap-2 justify-end">
            <Button onClick={() => setConfirmSurrender(false)}>Keep racing</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmSurrender(false)
                surrender()
              }}
            >
              Give up
            </Button>
            </div>
          </Overlay>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {done && result ? (
          <Overlay key="done">
          <div className="text-center">
            <span className="eyebrow text-[var(--accent)]">
              {result.surrendered ? 'Abandoned' : 'Target reached'}
            </span>
            <h2 className="display display-lg mt-3 text-[46px] text-[var(--ink)]">
              {result.surrendered ? 'Dead end' : challenge.target.title}
            </h2>
            <p className="mt-3 text-[13px] text-[var(--ink-3)]">
              {challenge.start.title} → {challenge.target.title}
            </p>
          </div>
          <div className="mt-6 flex gap-2">
            {overlayActions ?? (
              <>
                <Button
                  className="flex-1"
                  onClick={() => {
                    reset()
                    navigate('/play')
                  }}
                >
                  New race
                </Button>
                <Button variant="primary" className="flex-1" onClick={() => navigate('/results')}>
                  See results
                </Button>
              </>
            )}
          </div>
          </Overlay>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <m.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgb(var(--scrim)/0.45)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduced ? REDUCED : SPRING.quick}
    >
      <m.div
        className="w-full max-w-md p-7 rounded-[26px] bg-[var(--raised)] shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
        variants={reduced ? undefined : materialize}
        initial={reduced ? { opacity: 0 } : 'hidden'}
        animate={reduced ? { opacity: 1 } : 'shown'}
        exit={reduced ? { opacity: 0 } : 'gone'}
        transition={reduced ? REDUCED : SPRING.surface}
      >
        {children}
      </m.div>
    </m.div>
  )
}
