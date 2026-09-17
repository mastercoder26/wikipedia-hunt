import { Peer, type DataConnection, type PeerError } from 'peerjs'
import type { DataLink, Signaling } from '@/lib/multiplayer/signaling'

const OPEN_TIMEOUT_MS = 10_000

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
}

function wrapConnection(connection: DataConnection, onClose?: () => void): DataLink {
  const handlers = new Set<(payload: unknown) => void>()

  connection.on('data', (data: unknown) => {
    let payload = data
    if (typeof data === 'string') {
      try {
        payload = JSON.parse(data) as unknown
      } catch {
        return
      }
    }
    for (const handler of handlers) handler(payload)
  })

  return {
    send(payload) {
      if (!connection.open) return
      connection.send(payload)
    },
    subscribe(handler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    close() {
      handlers.clear()
      connection.close()
      onClose?.()
    },
  }
}

function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, { config: ICE }) : new Peer({ config: ICE })
    const timer = window.setTimeout(() => {
      peer.destroy()
      reject(new Error('Could not reach the matchmaking server'))
    }, OPEN_TIMEOUT_MS)

    const fail = (error: PeerError<string> | Error) => {
      window.clearTimeout(timer)
      peer.destroy()
      const type = 'type' in error ? error.type : ''
      if (type === 'unavailable-id') {
        reject(new Error('That room code is already in use'))
        return
      }
      reject(new Error(error.message || 'Could not open a peer connection'))
    }

    peer.once('open', () => {
      window.clearTimeout(timer)
      resolve(peer)
    })
    peer.once('error', fail)
  })
}

function waitForConnection(connection: DataConnection): Promise<void> {
  if (connection.open) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Room was not found. The host may have left.'))
    }, OPEN_TIMEOUT_MS)
    connection.once('open', () => {
      window.clearTimeout(timer)
      resolve()
    })
    connection.once('error', () => {
      window.clearTimeout(timer)
      reject(new Error('Room was not found. The host may have left.'))
    })
  })
}

/** PeerJS cloud for SDP/ICE, then a WebRTC data channel for the room. */
export function createPeerJsSignaling(): Signaling {
  return {
    async listen(peerId, onGuest) {
      const peer = await openPeer(peerId)
      peer.on('connection', (connection) => {
        void waitForConnection(connection).then(() => {
          onGuest(wrapConnection(connection))
        })
      })
      return () => {
        peer.destroy()
      }
    },

    async connect(peerId) {
      const peer = await openPeer()
      const connection = peer.connect(peerId, { reliable: true, serialization: 'json' })
      try {
        await waitForConnection(connection)
      } catch (error) {
        peer.destroy()
        throw error
      }
      return wrapConnection(connection, () => {
        peer.destroy()
      })
    },
  }
}
