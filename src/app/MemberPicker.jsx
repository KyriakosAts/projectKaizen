import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useData } from '../data/DataContext.jsx'
import { byName, matchesSearch } from '../data/model.js'
import { Avatar, SearchBox, StatusPill, cx } from './ui.jsx'

/**
 * Searchable member list. Single mode: tap a member → onPick(member).
 * Multi mode: `selected` (Set of ids) + onToggle(member).
 */
export function MemberPicker({ onPick, selected, onToggle, filter, autoFocus = true, emptyText = 'Κανένα μέλος' }) {
  const { members, statuses, groups } = useData()
  const [q, setQ] = useState('')
  const multi = Boolean(onToggle)

  const list = useMemo(() => {
    const base = members.filter(m => (!filter || filter(m)) && matchesSearch(m, q))
    // Active members first, then the rest; alphabetical inside each
    return base.sort((a, b) => {
      const pa = statuses.get(a.id)?.overall === 'paused'
      const pb = statuses.get(b.id)?.overall === 'paused'
      return pa - pb || byName(a, b)
    })
  }, [members, statuses, filter, q])

  const groupColor = (m) => groups.find(g => g.id === m.enrollments?.[0]?.groupId)?.color

  return (
    <div className="space-y-3">
      <SearchBox value={q} onChange={setQ} autoFocus={autoFocus} />
      <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
        {list.length === 0 && <p className="p-5 text-center text-stone-500">{emptyText}</p>}
        {list.slice(0, 200).map(m => {
          const on = multi && selected?.has(m.id)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => (multi ? onToggle(m) : onPick(m))}
              className={cx('w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 active:bg-stone-100', on && 'bg-emerald-50 hover:bg-emerald-50')}
            >
              {multi && (
                <span className={cx('w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0',
                  on ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-300')}>
                  {on && <Check size={18} strokeWidth={3} />}
                </span>
              )}
              <Avatar name={m.name} color={groupColor(m)} size={40} />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">{m.name}</span>
                <span className="block text-sm text-stone-500 truncate">
                  {(m.enrollments ?? []).map(e => groups.find(g => g.id === e.groupId)?.name).filter(Boolean).join(' · ') || 'Χωρίς τμήμα'}
                </span>
              </span>
              <StatusPill state={statuses.get(m.id)?.overall ?? 'paused'} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
