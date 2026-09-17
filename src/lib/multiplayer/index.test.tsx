import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomState } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  get: vi.fn<(code: string) => Promise<RoomState | null>>(),
}))

vi.mock('@/lib/multiplayer/localTransport', () => ({
  localTransport: {
    get: mocks.get,
    patchPlayer: vi.fn(() => Promise.reject(new Error('not joined'))),
  },
}))

vi.mock('@/lib/multiplayer/httpTransport', () => ({
  httpTransport: {},
  probeApi: vi.fn(() => Promise.resolve(false)),
}))

import { useRoom } from '@/lib/multiplayer'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function room(code: string): RoomState {
  return {
    code,
    hostId: 'host',
    challenge: null,
    settings: { revealArticles: false },
    players: [],
    status: 'lobby',
    startsAt: null,
    version: 1,
  }
}

describe('useRoom', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  function Harness({ code }: { code: string }) {
    const { room: currentRoom } = useRoom(code, null)
    return <span>{currentRoom?.code ?? ''}</span>
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    mocks.get.mockReset()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('ignores a fetch from the previous room after the code changes', async () => {
    const first = deferred<RoomState | null>()
    mocks.get.mockImplementation((code) =>
      code === 'AAAA' ? first.promise : Promise.resolve(room('BBBB')),
    )

    await act(async () => root.render(<Harness code="AAAA" />))
    await act(async () => root.render(<Harness code="BBBB" />))
    expect(container.textContent).toBe('BBBB')

    await act(async () => first.resolve(room('AAAA')))

    expect(container.textContent).toBe('BBBB')
  })
})
