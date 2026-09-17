# AGENTS.md

## Writing rules for anything a player reads

Interface copy, headings, empty states, button labels, README, commit messages.

**Never use an em dash.** Use a full stop, a comma, or two sentences. The only
acceptable `—` in the codebase is the placeholder glyph in a stat tile that has
no value yet.

**Say the thing once.** No rule-of-three lists ("No search bar. No address bar.
No new tabs."), no restating a point in a second clause for rhythm.

**Cut these constructions:**

- "not just X, but Y" / "it's not X, it's Y"
- "ultimately", "simply", "seamlessly", "powerful", "robust", "delve"
- "Let's", "Whether you're...", "Ready to...?"
- rhetorical questions in body copy
- a cute one-liner where a plain sentence belongs ("Good luck.", "Be first.",
  "these can be brutal.")
- hedging adverbs stacked on a claim ("genuinely", "really", "actually")

**Prefer the shorter, flatter sentence.** If a sentence exists to sound good
rather than to tell the player something they need, delete it.

**Labels are nouns or verbs, not sentences.** "Start race", not "Ready to start
your race?".

**Explain a constraint once, where it applies.** Do not repeat the fair-play
rules on four screens.

## Visual rules

Soft, minimal and dark by default. Concretely:

- **Dark is the default theme.** Light is opt-in through `data-theme="light"`,
  set before first paint by the inline script in `index.html`.
- **Rounded and raised, not ruled.** Surfaces use `--radius` with
  `--shadow-card`; buttons, tags and inputs are `rounded-full`. Hairlines are
  for dividers inside a surface, never as the main structure.
- **Chrome floats.** The nav and the race HUD are translucent pills sitting
  over the page (`.chrome`), not bars that own a band of the screen.
- **Type does the work.** One tight grotesque (Inter). `.display-xl` for page
  titles, `.display-lg` for figures, `.display-sm` for row and card headings.
  Mono only for numbers that are data: timers, click counts, room codes.
- **One accent**, and it means something: the target, the active state, a
  personal best. The primary button is ink, not the accent.
- **Say less.** A screen gets a title and, at most, one line of support. If a
  sentence only restates the title, cut it. Labels are quiet grey, not tracked
  uppercase micro-type.
- **Images are Wikipedia's own lead images**, and only where they carry
  meaning: the daily pair, the start and target on results. Never decoration
  for its own sake, and always with a typographic fallback, since plenty of
  articles have no image.

## Motion

Springs, not durations. Presets live in `src/lib/motion.ts` and are expressed
in Apple's two designer parameters (bounce + response), never in
mass/stiffness/damping.

- **`SPRING.ui` (bounce 0) is the default.** Critically damped, no overshoot.
- **Bounce is only for motion a gesture set going** — a flick, a release, a
  countdown digit landing. Overshoot on something that merely appeared reads
  as decoration.
- **Press feedback is on pointer-down, not on click.** That is the `.press`
  class; every button gets it. Waiting for the click to land reads as lag.
- **Animations must be interruptible**, so animate from the current on-screen
  value. Never use CSS transitions or `@keyframes` for anything a user can
  grab mid-flight.
- **Surfaces materialize**: blur, scale and opacity move together, so a panel
  arrives as a material rather than fading in.
- **Enter and exit along the same path.** If it rose in, it settles back down.
- **Animate only `transform`, `opacity` and `filter`.**
- **Reduced motion is a gentler equivalent, not silence.** Keep the fade, drop
  the travel and the overshoot. Every animated component checks
  `useReducedMotion()`. `prefers-reduced-transparency` and `prefers-contrast`
  turn the translucent chrome solid.

## Code

- Immutable updates. Never mutate an existing object.
- Type imports use `import type`. `verbatimModuleSyntax` and `noUnusedLocals`
  are on.
- `@/` maps to `src/`.
- Comments explain why, not what. Delete a comment that restates the line.
- Run `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`
  before calling anything done.
