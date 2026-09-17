# WikiDash

Race from one Wikipedia article to another using only the links inside the page.

`Beagle → Dog → United States → NASA → Apollo 11`

## Modes

| Mode | What it is |
| --- | --- |
| Solo Dash | Pick a pair and race your own record for it. |
| Live Race | Up to 8 players in a private room on one shared countdown. |
| Daily Dash | One pair a day for everyone, ranked by time and by clicks. |

Click Limit is a modifier on Solo Dash and Live Race: no limit, 10, 7 or 5 clicks.
Speedrun is how Live Race already ranks, with clicks as a tiebreak and an award.

## Running it

```bash
npm install && npm run dev
```

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and build |
| `npm run typecheck` | App and serverless functions |
| `npm run test` | Vitest, 76 tests |
| `npm run lint` | oxlint |

## Deploying to Vercel

`vercel.json` sets the Vite preset and the SPA rewrite. Everything under `api/` deploys as
serverless functions. Import the repo and deploy. Solo and Daily need no configuration.

Cross-device Live Race and the global Daily leaderboard need an [Upstash Redis](https://upstash.com)
database and two environment variables:

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Without them the app still works. Live Race falls back to a `BroadcastChannel` transport, which
races players in tabs of the same browser but not across devices, and the Daily leaderboard says it
is unavailable rather than showing invented standings. Local daily records, streaks and share cards
are unaffected.

Set `VITE_MULTIPLAYER` to `local` or `http` to pin the transport and skip the auto-detect probe.

## How it works

Article content comes from the public Wikipedia Action API (`action=parse`) with `origin=*`, so
there is no proxy and no API key. `src/lib/wiki/sanitize.ts` rewrites the HTML before it reaches
the page:

- In-article links become inert anchors carrying `data-wiki-key`. One delegated click listener
  routes them through the race state machine.
- External links, namespaced links (`File:`, `Special:`, `Wikipedia:`), red links and citation
  anchors become plain spans. The text survives so the article still reads, but they do nothing.
- `target`, `rel`, every `on*` handler, `action`, `formaction`, `ping`, `srcdoc` and `url()` in
  inline styles are stripped. `base`, `form`, `iframe`, `object`, `embed` and `area` are removed.
  Middle-click and right-click are suppressed inside the article, so nothing escapes to a new tab.
- Reference lists, edit links, navboxes and inline `[1]` markers are removed. Infoboxes and
  hatnotes are kept, because they carry a lot of links.

Finish detection compares the resolved canonical title, so landing on a redirect to the target ends
the race. Back is allowed and costs a click.

A live race runs on trust past that point: nothing in a browser can stop someone opening Wikipedia
in another window. Daily submissions are checked, though. Every consecutive pair in a submitted
route is verified against Wikipedia's link graph before it reaches the leaderboard.

Races, records, streaks and your profile live in `localStorage` under `wikidash:v1`. There is no
account system, and nothing leaves the browser unless you post a daily result.

## Layout

```
src/
  components/     UI primitives, article reader, challenge picker, HUD
  routes/         Home, Play, Race, Results, Daily, Stats, LiveHome, LiveRoom
  lib/
    wiki/         Wikipedia API client and HTML sanitizer
    game/         race state machine, storage, stats, awards, formatting, route finder
    multiplayer/  room transports, pure room logic, useRoom hook
  data/           119 curated challenges across 7 categories, Daily Dash generator
api/              Vercel serverless: room API and daily leaderboard
```

Every start and target title in the catalog was checked against the live Wikipedia API. No missing
pages, no redirects, no disambiguation pages.

## Design

Grayscale surfaces, serif display type and one accent colour that only marks what you can act on.
Links keep Wikipedia's blue and visited-purple, because in this game link colour is information.
Dark mode follows the system and can be toggled. Reduced motion is respected.

## Credit

Article content is from Wikipedia, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
WikiDash is not affiliated with or endorsed by the Wikimedia Foundation.
