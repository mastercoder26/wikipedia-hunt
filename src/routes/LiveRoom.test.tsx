import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Challenge, RoomState } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  room: null as RoomState | null,
  raceStartedAt: 1,
  begin: vi.fn(() => Promise.resolve()),
  reset: vi.fn(),
  refresh: vi.fn(() => Promise.resolve()),
  transport: {
    join: vi.fn(() => Promise.resolve()),
    patchPlayer: vi.fn(() => Promise.resolve()),
    setChallenge: vi.fn(() => Promise.resolve()),
    setSettings: vi.fn(() => Promise.resolve()),
    startRace: vi.fn(() => Promise.resolve()),
    rematch: vi.fn(() => Promise.resolve()),
    leave: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ code: 'ABCD' }),
}))

vi.mock('@/components/Shell', () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/routes/Race', () => ({
  Race: () => <div>Race screen</div>,
}))

vi.mock('@/lib/multiplayer', () => ({
  MAX_PLAYERS: 8,
  getTransport: () => mocks.transport,
  useRoom: () => ({ room: mocks.room, error: null, loading: false, refresh: mocks.refresh }),
}))

vi.mock('@/lib/game/identity', () => ({
  currentProfile: () => ({ id: 'me', name: 'Me', color: '#000' }),
  playerId: () => 'me',
}))

vi.mock('@/lib/game/raceStore', () => ({
  useRace: () => ({
    challenge: {
      id: 'live-1',
      start: { title: 'Start', key: 'Start' },
      target: { title: 'Target', key: 'Target' },
      category: 'science',
      difficulty: 'easy',
    },
    mode: 'live',
    status: 'finished',
    startedAt: mocks.raceStartedAt,
    finishedAt: 2,
    clicks: 3,
    path: [],
    currentTitle: 'Old race',
    begin: mocks.begin,
    reset: mocks.reset,
  }),
}))

import { LiveRoom } from '@/routes/LiveRoom'

const CHALLENGE: Challenge = {
  id: 'live-1',
  start: { title: 'Start', key: 'Start' },
  target: { title: 'Target', key: 'Target' },
  category: 'science',
  difficulty: 'easy',
}

function room(status: RoomState['status'], startsAt: number | null): RoomState {
  return {
    code: 'ABCD',
    hostId: 'me',
    challenge: CHALLENGE,
    settings: { revealArticles: false },
    players: [{
      id: 'me',
      name: 'Me',
      color: '#000',
      isHost: true,
      state: status === 'lobby' ? 'lobby' : 'racing',
      clicks: 0,
      path: [],
      lastSeen: Date.now(),
    }],
    status,
    startsAt,
    version: 1,
  }
}

describe('LiveRoom race handoff', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    mocks.begin.mockClear()
    mocks.reset.mockClear()
    mocks.raceStartedAt = 1
    mocks.transport.patchPlayer.mockClear()
    mocks.transport.patchPlayer.mockResolvedValue(undefined)
    mocks.transport.startRace.mockClear()
    mocks.transport.startRace.mockResolvedValue(undefined)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts locally at startsAt without waiting for a room status poll', async () => {
    mocks.room = room('countdown', 12_000)
    await act(async () => root.render(<LiveRoom />))

    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.transport.patchPlayer).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(2_000))

    expect(mocks.begin).toHaveBeenCalledTimes(1)
    expect(mocks.begin).toHaveBeenCalledWith(CHALLENGE, 'live', {
      startedAt: 12_000,
      clickLimit: undefined,
    })
    await act(async () => root.render(<LiveRoom />))
    expect(container.textContent).toContain('Race screen')
  })

  it('resets the local race in the rematch lobby and starts the next countdown', async () => {
    mocks.room = room('racing', 9_000)
    await act(async () => root.render(<LiveRoom />))
    expect(mocks.begin).toHaveBeenCalledTimes(1)

    mocks.room = room('lobby', null)
    await act(async () => root.render(<LiveRoom />))
    expect(mocks.reset).toHaveBeenCalledTimes(1)

    mocks.room = room('countdown', 11_000)
    await act(async () => root.render(<LiveRoom />))
    await act(async () => vi.advanceTimersByTimeAsync(1_000))

    expect(mocks.begin).toHaveBeenCalledTimes(2)
  })

  it('retries an unsent progress patch after a transient transport failure', async () => {
    mocks.transport.patchPlayer.mockRejectedValueOnce(new Error('offline'))
    mocks.raceStartedAt = 9_000
    mocks.room = room('racing', 9_000)
    await act(async () => root.render(<LiveRoom />))
    expect(mocks.transport.patchPlayer).toHaveBeenCalledTimes(1)

    mocks.room = { ...mocks.room!, version: 2 }
    await act(async () => root.render(<LiveRoom />))

    expect(mocks.transport.patchPlayer).toHaveBeenCalledTimes(2)
  })

  it('handles a failed host action without an unhandled rejection', async () => {
    mocks.transport.startRace.mockRejectedValueOnce(new Error('server unavailable'))
    mocks.room = room('lobby', null)
    await act(async () => root.render(<LiveRoom />))
    const startButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Start the countdown',
    )

    await act(async () => startButton?.click())

    expect(container.textContent).toContain('server unavailable')
  })
})
