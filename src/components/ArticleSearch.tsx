import { useEffect, useId, useRef, useState } from 'react'
import { searchArticles } from '@/lib/wiki'
import type { ArticleRef } from '@/lib/types'

const DEBOUNCE_MS = 220

interface Props {
  label: string
  value: ArticleRef | null
  onChange: (article: ArticleRef | null) => void
  placeholder?: string
}

/** Typeahead over Wikipedia titles. Only available outside a race. */
export function ArticleSearch({ label, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ArticleRef[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    const term = query.trim()
    const controller = new AbortController()
    if (term.length < 2) {
      // Clearing is deferred so the effect never sets state synchronously.
      const clear = window.setTimeout(() => {
        setResults([])
        setError(null)
      }, 0)
      return () => window.clearTimeout(clear)
    }
    const timer = window.setTimeout(async () => {
      setBusy(true)
      try {
        const found = await searchArticles(term, controller.signal)
        setResults(found)
        setActive(0)
        setError(found.length === 0 ? 'No articles matched.' : null)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError('Search is unavailable right now.')
        setResults([])
      } finally {
        setBusy(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function choose(article: ArticleRef) {
    onChange(article)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  if (value) {
    return (
      <div>
        <FieldLabel>{label}</FieldLabel>
        <div className="flex items-center gap-3 h-11 px-4 rounded-full border border-[var(--rule)] bg-[var(--raised)]">
          <span className="flex-1 truncate text-[15px] text-[var(--ink)]">{value.title}</span>
          <button
            onClick={() => onChange(null)}
            className="shrink-0 text-[13px] text-[var(--ink-3)] hover:text-[var(--accent)] transition-colors"
          >
            Change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative">
      <FieldLabel>{label}</FieldLabel>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && results[active]) {
            e.preventDefault()
            choose(results[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder ?? 'Search Wikipedia…'}
        className="w-full h-11 px-4 rounded-full bg-[var(--raised)] border border-[var(--rule)] text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none focus:border-[var(--ink)]"
      />
      {busy ? (
        <span className="absolute right-4 top-[38px] text-[13px] text-[var(--ink-3)]">…</span>
      ) : null}
      {open && (results.length > 0 || error) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 w-full max-h-72 overflow-auto rounded-[16px] border border-[var(--rule-soft)] bg-[var(--raised)] shadow-[var(--shadow-card)] p-1"
        >
          {error && results.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-[var(--ink-3)]">{error}</li>
          ) : null}
          {results.map((r, i) => (
            <li key={r.key}>
              <button
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
                className={`w-full text-left px-3 py-2 rounded-[10px] text-[13.5px] transition-colors ${
                  i === active ? 'bg-[var(--paper-2)] text-[var(--ink)]' : 'text-[var(--ink-2)]'
                }`}
              >
                {r.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-2 text-[13px] text-[var(--ink-3)]">{children}</label>
  )
}
