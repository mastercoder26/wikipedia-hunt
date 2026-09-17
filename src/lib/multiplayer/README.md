# Multiplayer layer

Everything the UI needs is exported from `@/lib/multiplayer`:

```ts
import { getTransport, useRoom, generateRoomCode } from '@/lib/multiplayer'
```

`getTransport()` returns a `RoomTransport` (see `transport.ts`). All room rules
live in `roomLogic.ts` as pure, immutable functions shared by the client and the
serverless API, so the two can never disagree.

## Two transports

| | `localTransport` | `httpTransport` |
|---|---|---|
| Backing store | `localStorage` + `BroadcastChannel` | `/api/room/*` serverless functions |
| Reach | tabs on one machine | any device, anywhere |
| Backend needed | none | Vercel + Upstash Redis |
| Role | dev default and fallback | production |

`localTransport` falls back to the `storage` event when `BroadcastChannel` is
unavailable, and to an in-memory map when `localStorage` is blocked. Players
whose `lastSeen` is older than 30s are pruned on every read.

`getTransport()` picks `httpTransport` when `VITE_MULTIPLAYER=http`, or when a
background probe of `GET /api/room/health` succeeds. Set `VITE_MULTIPLAYER=local`
to pin the local transport and skip the probe entirely.

## Enabling real cross-device multiplayer on Vercel

1. Create an Upstash Redis database (Vercel Marketplace → Upstash, or
   upstash.com) and copy its REST credentials.
2. Set these Environment Variables on the Vercel project (Production + Preview):

   | Variable | Value |
   |---|---|
   | `UPSTASH_REDIS_REST_URL` | `https://<your-db>.upstash.io` |
   | `UPSTASH_REDIS_REST_TOKEN` | the REST token from Upstash |
   | `VITE_MULTIPLAYER` | `http` |

3. Redeploy. `GET /api/room/health` reports `{ ok: true, backend: "upstash" }`
   when the Redis path is live.

Without the two `UPSTASH_*` variables the API falls back to an in-module `Map`.
That is fine for `vercel dev`, but on Vercel each lambda instance has its own
Map, so two players can land on different instances and never see each other.
**Configure Upstash for any real deployment.**

Rooms are stored as JSON under `wikidash:room:<CODE>` with a 2-hour TTL.

## Polling

`useRoom(code, playerId)` returns `{ room, error, loading, refresh }`. It polls
every 1000ms in `lobby`/`finished`, 600ms during `countdown`/`racing`, dedupes on
`room.version`, heartbeats the local player every 5s, and stops entirely while
the tab is hidden.
