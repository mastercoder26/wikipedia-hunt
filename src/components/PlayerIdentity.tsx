import { useState } from 'react'
import { PLAYER_COLORS, currentProfile, saveProfile } from '@/lib/game/identity'

export function PlayerIdentity({ onChange }: { onChange?: (name: string, color: string) => void }) {
  const initial = currentProfile()
  const [name, setName] = useState(initial.name)
  const [color, setColor] = useState(initial.color)

  function commit(nextName: string, nextColor: string) {
    saveProfile(nextName, nextColor)
    onChange?.(nextName, nextColor)
  }

  return (
    <div className="flex flex-wrap items-end gap-8">
      <div className="flex-1 min-w-[13rem]">
        <label htmlFor="wd-name" className="block mb-2 text-[13px] text-[var(--ink-3)]">
          Username
        </label>
        <input
          id="wd-name"
          value={name}
          maxLength={16}
          onChange={(e) => {
            setName(e.target.value)
            commit(e.target.value, color)
          }}
          className="w-full h-11 px-4 rounded-full bg-[var(--raised)] border border-[var(--rule)] text-[15px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
        />
      </div>
      <div>
        <span className="block mb-2 text-[13px] text-[var(--ink-3)]">Colour</span>
        <div className="flex gap-1.5">
          {PLAYER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c)
                commit(name, c)
              }}
              aria-label={`Choose colour ${c}`}
              aria-pressed={color === c}
              className={`press w-8 h-8 rounded-full p-0.5 border-2 ${
                color === c ? 'border-[var(--ink)]' : 'border-transparent'
              }`}
            >
              <span className="block w-full h-full rounded-full" style={{ background: c }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
