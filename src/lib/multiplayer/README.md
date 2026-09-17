# Multiplayer layer

Everything the UI needs is exported from `@/lib/multiplayer`:

```ts
import { getTransport, useRoom, generateRoomCode } from '@/lib/multiplayer'
```

`getTransport()` returns a `RoomTransport` (see `transport.ts`). Room rules live
in `roomLogic.ts` as pure, immutable functions. The WebRTC host applies them;
guests send actions over a data channel.

## Transports

| | `webrtcTransport` | `localTransport` | `httpTransport` |
|---|---|---|---|
| Backing store | Host tab, WebRTC data channel | `localStorage` + `BroadcastChannel` | `/api/room/*` |
| Reach | any device, while the host tab is open | tabs on one machine | any device with Redis |
| Backend needed | PeerJS signaling (free) + STUN | none | Vercel + Upstash Redis |
| Role | default | `VITE_MULTIPLAYER=local` | `VITE_MULTIPLAYER=http` |

The host creates a 4-character code. That code is the PeerJS peer id
(`wikidash-ABCD`). Joiners open a data channel to the host. If the host closes
the tab, the room ends.

Players whose `lastSeen` is older than 30s are pruned on every host read.

## Polling

`useRoom(code, playerId)` returns `{ room, error, loading, refresh }`. It polls
every 1000ms in `lobby`/`finished`, 600ms during `countdown`/`racing`, dedupes on
`room.version`, heartbeats the local player every 5s, and stops entirely while
the tab is hidden.
