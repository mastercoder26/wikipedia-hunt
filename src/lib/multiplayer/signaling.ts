/** Bidirectional JSON pipe. WebRTC data channels and the in-test bus both fit. */
export interface DataLink {
  send(payload: unknown): void
  subscribe(handler: (payload: unknown) => void): () => void
  close(): void
}

export interface Signaling {
  listen(peerId: string, onGuest: (link: DataLink) => void): Promise<() => void>
  connect(peerId: string): Promise<DataLink>
}

function pairLinks(): { host: DataLink; guest: DataLink } {
  const hostHandlers = new Set<(payload: unknown) => void>()
  const guestHandlers = new Set<(payload: unknown) => void>()
  let closed = false

  function make(
    outgoing: Set<(payload: unknown) => void>,
    incoming: Set<(payload: unknown) => void>,
  ): DataLink {
    return {
      send(payload) {
        if (closed) return
        queueMicrotask(() => {
          for (const handler of outgoing) handler(payload)
        })
      },
      subscribe(handler) {
        incoming.add(handler)
        return () => {
          incoming.delete(handler)
        }
      },
      close() {
        closed = true
        hostHandlers.clear()
        guestHandlers.clear()
      },
    }
  }

  return {
    host: make(guestHandlers, hostHandlers),
    guest: make(hostHandlers, guestHandlers),
  }
}

/** Same-process signaling for tests. No network, no PeerJS. */
export function createMemorySignaling(): Signaling {
  const hosts = new Map<string, (link: DataLink) => void>()

  return {
    async listen(peerId, onGuest) {
      if (hosts.has(peerId)) {
        throw new Error('That room code is already in use')
      }
      hosts.set(peerId, onGuest)
      return () => {
        hosts.delete(peerId)
      }
    },

    async connect(peerId) {
      const onGuest = hosts.get(peerId)
      if (!onGuest) {
        throw new Error('Room was not found. The host may have left.')
      }
      const { host, guest } = pairLinks()
      onGuest(host)
      return guest
    },
  }
}
