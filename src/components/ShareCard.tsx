import { useState } from 'react'

export function ShareCard({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // A cancelled share sheet or a blocked clipboard needs no message.
      // The text is on screen to select by hand.
    }
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--rule-soft)] bg-[var(--raised)] overflow-hidden shadow-[var(--shadow-card)]">
      <pre className="p-5 text-[12.5px] leading-[1.75] text-[var(--ink)] whitespace-pre-wrap break-words font-mono m-0">
        {text}
      </pre>
      <button
        onClick={share}
        className="press w-full py-3.5 border-t border-[var(--rule-soft)] text-[13.5px] font-medium text-[var(--ink)] hover:bg-[var(--paper-2)]"
      >
        {copied ? 'Copied' : 'Copy result'}
      </button>
    </div>
  )
}
