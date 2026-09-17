import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { REDUCED, SPRING } from '@/lib/motion'
import { useNavigate, useParams } from 'react-router-dom'
import { Page } from '@/components/Shell'
import { Reveal } from '@/components/Reveal'
import { Button, Eyebrow, Stat, Tag } from '@/components/ui'
import { ChallengePicker } from '@/components/ChallengePicker'
import { Race } from './Race'
import { getTransport, useRoom, MAX_PLAYERS } from '@/lib/multiplayer'
import { currentProfile, playerId as getPlayerId } from '@/lib/game/identity'
import { useRace } from '@/lib/game/raceStore'
import { computeAwards, mostUnusualArticle, shortestRoute } from '@/lib/game/awards'
import { formatClicks, formatDuration } from '@/lib/game/format'
import { recordRace } from '@/lib/game/storage'
import { playGo, playTick } from '@/lib/game/sound'
import type { Challenge, RoomPlayer } from '@/lib/types'

const COUNTDOWN_MS = 5000

export function LiveRoom() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const me = getPlayerId()
  const { room, error, loading, refresh } = useRoom(code, me)
  const transport = getTransport()

  const race = useRace()
  const [picking, setPicking] = useState(false)
  // Host actions hit the network, so a failure has to land in front of the
  // host instead of vanishing into an unhandled rejection.
  const [actionError, setActionError] = useState<string | null>(null)

  const isHost = room?.hostId === me
  const players = room?.players ?? []
  const target = room?.challenge

  // Rejoin automatically if the room dropped us (a reload, a network blip).
  useEffect(() => {
    if (!room || loading) return
    if (!room.players.some((p) => p.id === me)) {
      transport.join(code, currentProfile()).then(refresh).catch(() => undefined)
    }
  }, [room, loading, me, code, transport, refresh])

  // ── Start the local race exactly when the shared clock says go ──────────
  const startedRef = useRef(false)
  const [localStartsAt, setLocalStartsAt] = useState<number | null>(null)
  useEffect(() => {
    if (!room) return
    if (room.status !== 'countdown' && room.status !== 'racing') {
      startedRef.current = false
      if (room.status === 'lobby' && race.mode === 'live' && race.status !== 'idle') race.reset()
      return
    }
    if (!room.challenge || !room.startsAt || startedRef.current) return
    const start = () => {
      if (startedRef.current) return
      startedRef.current = true
      setLocalStartsAt(room.startsAt)
      void race.begin(room.challenge!, 'live', {
        startedAt: room.startsAt!,
        clickLimit: room.settings.clickLimit,
      })
    }
    const delay = room.startsAt - Date.now()
    if (delay <= 0) {
      start()
      return
    }
    const timer = window.setTimeout(start, delay)
    return () => window.clearTimeout(timer)
  }, [room?.challenge, room?.startsAt, room?.status, room?.settings.clickLimit, race, room])

  // ── Push my progress into the room ─────────────────────────────────────
  const lastSent = useRef('')
  useEffect(() => {
    if (
      !room ||
      room.status === 'lobby' ||
      !startedRef.current ||
      race.challenge?.id !== room.challenge?.id ||
      race.startedAt !== room.startsAt
    ) return
    const state =
      race.status === 'finished' ? 'finished' : race.status === 'surrendered' ? 'surrendered' : 'racing'
    const patch = {
      state: state as RoomPlayer['state'],
      clicks: race.clicks,
      path: race.path.map((s) => s.title),
      ...(room.settings.revealArticles ? { currentArticle: race.currentTitle } : {}),
      ...(race.finishedAt && race.startedAt ? { durationMs: race.finishedAt - race.startedAt } : {}),
    }
    const signature = JSON.stringify(patch)
    if (signature === lastSent.current) return
    lastSent.current = signature
    transport.patchPlayer(code, me, patch).catch(() => {
      if (lastSent.current === signature) lastSent.current = ''
    })
  }, [race.status, race.clicks, race.path, race.currentTitle, race.finishedAt, race.startedAt, race.challenge?.id, room, code, me, transport])

  // Record the finished live race exactly once, now that the winner is known.
  const recordedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!room || room.status !== 'finished' || !room.challenge) return
    const stamp = `${room.code}:${room.challenge.id}:${room.startsAt ?? 0}`
    if (recordedFor.current === stamp) return
    const mine = room.players.find((p) => p.id === me)
    if (!mine || mine.state === 'lobby') return
    recordedFor.current = stamp
    const ranked = [...room.players]
      .filter((p) => p.state === 'finished')
      .sort((a, b) => (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity))
    recordRace(
      {
        challengeId: room.challenge.id,
        mode: 'live',
        durationMs: mine.durationMs ?? 0,
        clicks: mine.clicks,
        // RoomPlayer carries plain titles; rebuild the PathStep shape the
        // stats layer expects. Per-step timings are not synced, so they are 0.
        path: (mine.path ?? []).map((title) => ({
          title,
          key: title.replace(/ /g, '_'),
          at: 0,
          viaBack: false,
        })),
        finishedAt: Date.now(),
        surrendered: mine.state === 'surrendered',
        clickLimit: room.settings.clickLimit,
        won: ranked[0]?.id === me,
      },
      room.challenge,
    )
  }, [room, me])

  async function runRoomAction(action: () => Promise<unknown>, onSuccess?: () => void) {
    setActionError(null)
    try {
      await action()
      onSuccess?.()
      await refresh()
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Could not update the room.')
    }
  }

  async function hostSetChallenge(challenge: Challenge) {
    await runRoomAction(
      () => transport.setChallenge(code, me, challenge),
      () => setPicking(false),
    )
  }

  async function hostStart() {
    if (!room?.challenge) return
    await runRoomAction(() => transport.startRace(code, me, COUNTDOWN_MS))
  }

  async function hostRematch(challenge: Challenge) {
    await runRoomAction(
      () => transport.rematch(code, me, challenge),
      () => {
        race.reset()
        startedRef.current = false
        setLocalStartsAt(null)
        lastSent.current = ''
      },
    )
  }

  async function hostToggleReveal() {
    if (!room) return
    await runRoomAction(() =>
      transport.setSettings(code, me, {
        ...room.settings,
        revealArticles: !room.settings.revealArticles,
      }),
    )
  }

  async function leave() {
    race.reset()
    await transport.leave(code, me).catch(() => undefined)
    navigate('/live')
  }

  if (error && !room) {
    return (
      <Page>
        <div className="py-12 max-w-md">
          <Eyebrow>Room {code}</Eyebrow>
          <h1 className="display mt-5 text-[40px] text-[var(--ink)]">That room is not open</h1>
          <p className="mt-3 text-[13.5px] text-[var(--ink-2)]">{error}</p>
          <Button variant="primary" className="mt-7" onClick={() => navigate('/live')}>
            Back to Live Race
          </Button>
        </div>
      </Page>
    )
  }

  if (!room) {
    return (
      <Page>
        <div>
          <div className="wd-skeleton h-6 w-48 mb-4" />
          <div className="wd-skeleton h-4 w-full mb-2" />
          <div className="wd-skeleton h-4 w-2/3" />
        </div>
      </Page>
    )
  }

  // ── Countdown ──────────────────────────────────────────────────────────
  if (room.status === 'countdown' && room.startsAt && localStartsAt !== room.startsAt) {
    return <Countdown startsAt={room.startsAt} challenge={room.challenge} />
  }

  // ── Racing ─────────────────────────────────────────────────────────────
  if ((room.status === 'racing' || room.status === 'countdown') && race.challenge) {
    return (
      <>
        <Race
          overlayActions={
            <Button variant="primary" className="flex-1" onClick={refresh}>
              Waiting for the others…
            </Button>
          }
        />
        <LivePositions players={players} me={me} reveal={room.settings.revealArticles} />
      </>
    )
  }

  // ── Finished ───────────────────────────────────────────────────────────
  if (room.status === 'finished') {
    return (
      <Page>
        <Results
          room={room}
          me={me}
          isHost={isHost}
          onRematch={hostRematch}
          onLeave={leave}
          error={actionError}
        />
      </Page>
    )
  }

  // ── Lobby ──────────────────────────────────────────────────────────────
  return (
    <Page>
      <Reveal as="header" className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Room code</Eyebrow>
          <div className="mt-4 flex items-end gap-4">
            <span className="font-mono text-[clamp(3rem,12vw,5.5rem)] leading-[0.85] tracking-[0.12em] text-[var(--ink)]">
              {room.code}
            </span>
            <button
              onClick={() => navigator.clipboard?.writeText(window.location.href).catch(() => undefined)}
              className="eyebrow pb-2 text-[var(--accent)] hover:underline underline-offset-4"
            >
              Copy link
            </button>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={leave}>
          Leave room
        </Button>
      </Reveal>

      <section className="mt-14">
        <div className="flex items-baseline justify-between pb-3 border-b border-[var(--ink)]">
          <span className="eyebrow">Players</span>
          <span className="eyebrow tnum">
            {String(players.length).padStart(2, '0')} / {MAX_PLAYERS}
          </span>
        </div>
        <ul>
          {players.map((p, i) => (
            <li
              key={p.id}
              className="grid grid-cols-[2rem_0.75rem_1fr_auto] items-center gap-3 py-3 border-b border-[var(--rule-soft)]"
            >
              <span className="eyebrow text-[var(--ink-3)]">{String(i + 1).padStart(2, '0')}</span>
              <span className="w-3 h-3 shrink-0" style={{ background: p.color }} />
              <span className="min-w-0 truncate display text-[19px] text-[var(--ink)]">
                {p.name}
                {p.id === me ? <span className="text-[var(--ink-3)]"> (you)</span> : null}
              </span>
              {p.isHost ? <Tag>Host</Tag> : <span />}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Challenge</h2>
        <div className="pt-6">
          {target ? (
            <div className="display text-[clamp(1.75rem,5vw,3rem)] text-[var(--ink)] flex flex-wrap items-baseline gap-x-5">
              <span>{target.start.title}</span>
              <span className="text-[var(--accent)]" aria-label="to">→</span>
              <span>{target.target.title}</span>
            </div>
          ) : (
            <p className="text-[14px] text-[var(--ink-2)]">
              {isHost ? 'Pick a challenge to get started.' : 'Waiting for the host to pick a challenge.'}
            </p>
          )}

          {isHost ? (
            <div className="mt-6 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setPicking((v) => !v)}>
                {picking ? 'Close picker' : target ? 'Change challenge' : 'Pick a challenge'}
              </Button>
              <Button size="sm" onClick={hostToggleReveal}>
                {room.settings.revealArticles ? 'Hide live articles' : 'Reveal live articles'}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {isHost && picking ? (
        <div className="mt-12">
          <ChallengePicker onSelect={hostSetChallenge} ctaLabel="Use this challenge" />
        </div>
      ) : null}

      {actionError ? (
        <p className="mt-8 text-[13px] text-[var(--accent)]" role="alert">
          {actionError}
        </p>
      ) : null}

      {isHost ? (
        <Button variant="primary" size="lg" className="mt-12 w-full" onClick={hostStart} disabled={!target}>
          Start the countdown
        </Button>
      ) : (
        <p className="mt-12 py-5 border-t border-[var(--ink)] text-[13.5px] text-[var(--ink-2)]">
          Waiting for {players.find((p) => p.isHost)?.name ?? 'the host'} to start.
        </p>
      )}
    </Page>
  )
}
function Countdown({ startsAt, challenge }: { startsAt: number; challenge: Challenge | null }) {
  const [left, setLeft] = useState(() => startsAt - Date.now())
  const lastBeep = useRef<number>(-1)

  useEffect(() => {
    const id = window.setInterval(() => setLeft(startsAt - Date.now()), 80)
    return () => window.clearInterval(id)
  }, [startsAt])

  const seconds = Math.max(0, Math.ceil(left / 1000))
  const reduced = useReducedMotion()

  useEffect(() => {
    if (seconds === lastBeep.current) return
    lastBeep.current = seconds
    if (seconds === 0) playGo()
    else if (seconds <= 3) playTick()
  }, [seconds])

  return (
    <div className="min-h-full flex flex-col bg-[var(--ink)] text-[var(--paper)]">
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 max-w-[1180px] w-full mx-auto">
        <span className="eyebrow text-[var(--paper)] opacity-60">Starting</span>
        {challenge ? (
          <p className="display display-sm mt-6 text-[clamp(1.5rem,4vw,2.5rem)] flex flex-wrap items-baseline gap-x-4">
            <span>{challenge.start.title}</span>
            <span className="text-[var(--accent)]">→</span>
            <span>{challenge.target.title}</span>
          </p>
        ) : null}
        {/* Each count lands with a little overshoot and the one before it
            recedes, so the numbers read as arriving rather than swapping. */}
        <div className="relative mt-4 h-[clamp(6rem,27vw,15rem)]">
          <AnimatePresence initial={false}>
            <m.div
              key={seconds}
              className="absolute inset-0 tnum font-mono text-[clamp(7rem,32vw,18rem)] leading-[0.8] tracking-[-0.04em] text-[var(--accent)]"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.72 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.35 }}
              transition={reduced ? REDUCED : SPRING.momentum}
            >
              {seconds === 0 ? 'GO' : seconds}
            </m.div>
          </AnimatePresence>
        </div>
      </div>
      <p className="eyebrow px-6 sm:px-12 py-6 max-w-[1180px] w-full mx-auto text-[var(--paper)] opacity-50">
        Everyone starts at the same moment
      </p>
    </div>
  )
}

/** A fixed strip showing who is still running, pinned over the article. */
function LivePositions({ players, me, reveal }: { players: RoomPlayer[]; me: string; reveal: boolean }) {
  const [open, setOpen] = useState(true)
  if (players.length <= 1) return null
  const done = players.filter((p) => p.state === 'finished').length

  return (
    <div className="chrome fixed bottom-0 right-0 z-40 max-w-[min(22rem,100vw)] border-t-2 border-l-2 border-[var(--ink)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="press eyebrow w-full flex items-center justify-between gap-6 px-4 py-2.5 text-[var(--ink)] hover:bg-[var(--paper-2)]"
      >
        <span>Field</span>
        <span className="tnum text-[var(--ink-3)]">
          {done}/{players.length} done {open ? '↓' : '↑'}
        </span>
      </button>
      {open ? (
        <ul className="border-t border-[var(--rule)]">
          {players.map((p) => (
            <li
              key={p.id}
              className="grid grid-cols-[0.6rem_1fr_auto] items-center gap-2.5 px-4 py-2 border-b border-[var(--rule-soft)] last:border-0"
            >
              <span className="w-2.5 h-2.5 shrink-0" style={{ background: p.color }} />
              <span className="min-w-0 truncate text-[12.5px] text-[var(--ink)]">
                {p.name}
                {p.id === me ? ' (you)' : ''}
                {reveal && p.currentArticle && p.state === 'racing' ? (
                  <span className="text-[var(--ink-3)]"> · {p.currentArticle}</span>
                ) : null}
              </span>
              <span className="tnum font-mono text-[11.5px] shrink-0 text-[var(--ink-3)]">
                {p.state === 'finished'
                  ? formatDuration(p.durationMs ?? 0)
                  : p.state === 'surrendered'
                    ? 'out'
                    : `${p.clicks}c`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Results({
  room,
  me,
  isHost,
  onRematch,
  onLeave,
  error,
}: {
  room: { players: RoomPlayer[]; challenge: Challenge | null; code: string }
  me: string
  isHost: boolean
  onRematch: (challenge: Challenge) => void
  onLeave: () => void
  error: string | null
}) {
  const [picking, setPicking] = useState(false)
  const players = room.players

  const ranked = useMemo(
    () =>
      [...players].sort((a, b) => {
        const aDone = a.state === 'finished'
        const bDone = b.state === 'finished'
        if (aDone !== bDone) return aDone ? -1 : 1
        return (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity)
      }),
    [players],
  )

  // With a single racer every award is trivially theirs, so they are hidden
  // until there is someone to beat.
  const awards = useMemo(() => (players.length > 1 ? computeAwards(players) : []), [players])
  const unusual = useMemo(() => mostUnusualArticle(players), [players])
  const shortest = useMemo(() => shortestRoute(players), [players])
  const winner = ranked[0]

  return (
    <>
      <header className="wd-rise">
        <Eyebrow>Race over</Eyebrow>
        <h1 className="display display-xl mt-6 text-[clamp(2.75rem,9vw,5.5rem)] text-[var(--ink)]">
          {winner ? (
            <>
              {winner.name} <span className="text-[var(--ink-3)]">takes it</span>
            </>
          ) : (
            'No winner'
          )}
        </h1>
        {room.challenge ? (
          <p className="mt-4 text-[14px] text-[var(--ink-3)]">
            {room.challenge.start.title} → {room.challenge.target.title}
          </p>
        ) : null}

        <div className="mt-11 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6">
          <Stat
            value={winner?.durationMs ? formatDuration(winner.durationMs) : '—'}
            label="Winning time"
            accent
            size="lg"
          />
          <Stat value={players.length} label="Racers" size="lg" />
          <Stat value={shortest ? (shortest.path?.length ?? 0) : '—'} label="Shortest route" size="lg" />
          <Stat
            value={players.filter((p) => p.state === 'finished').length}
            label="Finished"
            size="lg"
          />
        </div>
      </header>

      <section className="mt-16">
        <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Final rankings</h2>
        <ol>
          {ranked.map((p, i) => {
            const avg = p.durationMs && p.clicks ? p.durationMs / p.clicks : 0
            return (
              <li key={p.id} className="py-5 border-b border-[var(--rule-soft)]">
                <div className="grid grid-cols-[2rem_0.75rem_1fr_auto] items-baseline gap-3">
                  <span className={`eyebrow ${i === 0 ? 'text-[var(--accent)]' : 'text-[var(--ink-3)]'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="w-3 h-3 self-center" style={{ background: p.color }} />
                  <span className="min-w-0 truncate display text-[22px] text-[var(--ink)]">
                    {p.name}
                    {p.id === me ? <span className="text-[var(--ink-3)]"> (you)</span> : null}
                  </span>
                  <span className="tnum font-mono text-[13px] text-[var(--ink)] shrink-0">
                    {p.state === 'finished' ? formatDuration(p.durationMs ?? 0) : 'DNF'}
                  </span>
                </div>
                <div className="pl-[2.75rem] mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 eyebrow">
                  <span className="tnum">{formatClicks(p.clicks)}</span>
                  <span className="tnum">{p.path?.length ?? 0} articles</span>
                  {avg ? <span className="tnum">{formatDuration(avg)} per click</span> : null}
                </div>
                {p.path && p.path.length > 0 ? (
                  <p className="pl-[2.75rem] mt-2 text-[12.5px] leading-relaxed text-[var(--ink-3)]">
                    {p.path.join(' → ')}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      </section>

      {awards.length > 0 || unusual ? (
        <section className="mt-16">
          <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Awards</h2>
          <ul className="grid sm:grid-cols-2 gap-x-12">
            {awards.map((award) => {
              const who = players.find((p) => p.id === award.playerId)
              return (
                <li key={award.id} className="py-5 border-b border-[var(--rule-soft)]">
                  <span className="eyebrow text-[var(--accent)]">{award.label}</span>
                  <p className="display mt-2 text-[24px] text-[var(--ink)]">{who?.name ?? '—'}</p>
                  <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">{award.description}</p>
                </li>
              )
            })}
            {unusual ? (
              <li className="py-5 border-b border-[var(--rule-soft)]">
                <span className="eyebrow">Most unusual article</span>
                <p className="display mt-2 text-[24px] text-[var(--ink)]">{unusual}</p>
                <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">Visited by exactly one racer</p>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p className="mt-8 text-[13px] text-[var(--accent)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-12 flex flex-wrap gap-2">
        {isHost ? (
          <Button variant="primary" size="lg" onClick={() => setPicking((v) => !v)}>
            {picking ? 'Cancel rematch' : 'Rematch'}
          </Button>
        ) : (
          <p className="flex-1 py-3 text-[13.5px] text-[var(--ink-2)]">
            Waiting for the host to call a rematch.
          </p>
        )}
        <Button size="lg" variant="danger" onClick={onLeave}>
          Leave room
        </Button>
      </div>

      {isHost && picking ? (
        <div className="mt-12">
          <p className="mb-6 text-[13.5px] text-[var(--ink-2)]">
            A rematch always uses a new pair. Pick the next start and target.
          </p>
          <ChallengePicker onSelect={onRematch} ctaLabel="Rematch with this" />
        </div>
      ) : null}
    </>
  )
}
