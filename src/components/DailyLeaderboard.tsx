import { useEffect, useState } from 'react'
import { formatDuration } from '@/lib/game/format'

export interface DailyEntry {
  name: string
  durationMs: number
  clicks: number
  path: string[]
}

type Board = { byTime: DailyEntry[]; byClicks: DailyEntry[] }

/**
 * Served by an optional Vercel function. When it is not deployed, say so
 * rather than showing invented standings.
 */
export function DailyLeaderboard({ dateKey }: { dateKey: string }) {
  const [board, setBoard] = useState<Board | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'offline'>('loading')
  const [tab, setTab] = useState<'byTime' | 'byClicks'>('byTime')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/daily?date=${encodeURIComponent(dateKey)}`)
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { ok: boolean; board?: Board }
        if (cancelled) return
        if (!data.ok || !data.board) throw new Error('bad payload')
        setBoard(data.board)
        setState('ready')
      } catch {
        if (!cancelled) setState('offline')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dateKey])

  if (state === 'loading') {
    return (
      <div className="pt-5">
        <div className="wd-skeleton h-4 w-40 mb-3" />
        <div className="wd-skeleton h-4 w-full mb-2" />
        <div className="wd-skeleton h-4 w-[85%]" />
      </div>
    )
  }

  if (state === 'offline' || !board) {
    return (
      <p className="text-[14px] text-[var(--ink-3)]">Not available on this deployment.</p>
    )
  }

  const rows = board[tab]

  return (
    <div>
      <div className="flex gap-6 pt-4 pb-3">
        {(
          [
            ['byTime', 'Fastest time'],
            ['byClicks', 'Fewest clicks'],
          ] as ['byTime' | 'byClicks', string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`eyebrow pb-0.5 border-b transition-colors ${
              tab === id
                ? 'text-[var(--ink)] border-[var(--accent)]'
                : 'border-transparent hover:text-[var(--ink)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-[13.5px] text-[var(--ink-3)]">No validated runs posted yet today.</p>
      ) : (
        <ol>
          {rows.map((entry, i) => (
            <li
              key={`${entry.name}-${i}`}
              className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-3 py-3 border-b border-[var(--rule-soft)]"
            >
              <span className={`eyebrow ${i === 0 ? 'text-[var(--accent)]' : 'text-[var(--ink-3)]'}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="display display-sm text-[17px] text-[var(--ink)] truncate">{entry.name}</span>
              <span className="tnum font-mono text-[12.5px] text-[var(--ink-2)] shrink-0">
                {tab === 'byTime'
                  ? `${formatDuration(entry.durationMs)} · ${entry.clicks}c`
                  : `${entry.clicks}c · ${formatDuration(entry.durationMs)}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
