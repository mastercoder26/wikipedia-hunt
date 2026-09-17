import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '@/components/Shell'
import { Reveal } from '@/components/Reveal'
import { Button, Eyebrow } from '@/components/ui'
import { PlayerIdentity } from '@/components/PlayerIdentity'
import { getReadyTransport, isValidRoomCode, normalizeRoomCode } from '@/lib/multiplayer'
import { currentProfile } from '@/lib/game/identity'

export function LiveHome() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setBusy('create')
    setError(null)
    try {
      const transport = await getReadyTransport()
      const room = await transport.create(currentProfile(), { revealArticles: false })
      navigate(`/live/${room.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open a room.')
    } finally {
      setBusy(null)
    }
  }

  async function join() {
    const clean = normalizeRoomCode(code)
    if (!isValidRoomCode(clean)) {
      setError('Room codes are four characters.')
      return
    }
    setBusy('join')
    setError(null)
    try {
      const transport = await getReadyTransport()
      await transport.join(clean, currentProfile())
      navigate(`/live/${clean}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join that room.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Page wide>
      <Reveal as="header">
        <Eyebrow>Multiplayer</Eyebrow>
        <h1 className="display display-xl mt-4 text-[clamp(2.75rem,8vw,5rem)] text-[var(--ink)]">
          Live Race
        </h1>
        <p className="mt-5 max-w-[42ch] text-[15px] leading-[1.6] text-[var(--ink-2)]">
          Eight players, one countdown, one target.
        </p>
      </Reveal>

      <section className="mt-14">
        <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">You</h2>
        <div className="pt-6">
          <PlayerIdentity />
        </div>
      </section>

      <div className="mt-14 grid gap-12 sm:grid-cols-2 sm:gap-16 [&>section]:min-w-0">
        <section>
          <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Create</h2>
          <Button variant="primary" size="lg" className="w-full" onClick={create} disabled={busy !== null}>
            {busy === 'create' ? 'Opening' : 'Create private room'}
          </Button>
        </section>

        <section>
          <h2 className="display display-sm text-[17px] text-[var(--ink)] mb-5">Join</h2>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              placeholder="ABCD"
              maxLength={4}
              aria-label="Room code"
              className="flex-1 min-w-0 h-12 px-4 rounded-full border border-[var(--rule)] bg-[var(--raised)] font-mono text-[18px] tracking-[0.3em] indent-[0.3em] uppercase text-center text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none focus:border-[var(--ink)]"
            />
            <Button size="lg" onClick={join} disabled={busy !== null || code.length < 4}>
              {busy === 'join' ? 'Joining' : 'Join'}
            </Button>
          </div>
        </section>
      </div>

      {error ? (
        <p className="mt-8 text-[13px] text-[var(--accent)]" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-14 max-w-[54ch] text-[13px] leading-relaxed text-[var(--ink-3)]">
        A live race runs on trust. The site blocks search, external links and new tabs, but it cannot see
        another browser window.
      </p>
    </Page>
  )
}
