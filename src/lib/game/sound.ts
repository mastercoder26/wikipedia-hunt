/**
 * WebAudio blips for the countdown and the finish. Oscillators rather than
 * audio files, so there is nothing to load. Muted via `wikidash:sound`.
 */
const KEY = 'wikidash:sound'
let ctx: AudioContext | null = null

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // Private mode: the preference will not persist.
  }
}

function tone(freq: number, startOffset: number, duration: number, gainPeak = 0.12) {
  if (!soundEnabled()) return
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    const t0 = ctx.currentTime + startOffset
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t0)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  } catch {
    // Sound must never break a race.
  }
}

/** One of the three pre-start beeps. */
export function playTick() {
  tone(660, 0, 0.09)
}

/** The "go" on zero. */
export function playGo() {
  tone(990, 0, 0.22, 0.16)
}

/** Reaching the target. */
export function playFinish() {
  tone(587.33, 0, 0.14)
  tone(739.99, 0.1, 0.14)
  tone(987.77, 0.2, 0.34, 0.15)
}
