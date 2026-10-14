import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Users, Download } from 'lucide-react'
import { useData } from '../../data/DataContext.jsx'
import { byName, currentBelt, describeFilter, isFilterActive, matchesSearch } from '../../data/model.js'
import { fmtDay } from '../../data/dates.js'
import { alertDialog } from '../../utils/dialogs.js'
import MemberSheet from '../MemberSheet.jsx'
import { FilterBar, useFilter, useFilteredMembers } from '../filter.jsx'
import { exportExcel } from '../exportExcel.js'
import { Avatar, Button, Card, Empty, ErrorNote, PageHeader, SearchBox, StatusPill, useAction, cx } from '../ui.jsx'

export default function MembersPage() {
  const data = useData()
  const { members, groups, statuses, promotions } = data
  const navigate = useNavigate()
  const { filter } = useFilter()
  const filtered = useFilteredMembers()
  const [q, setQ] = useState('')
  const [showPaused, setShowPaused] = useState(false)
  const [adding, setAdding] = useState(false)
  const { busy, error, run } = useAction()
  const active = isFilterActive(filter)

  // Without a filter, members "σε παύση" stay out of the way (one tap shows them)
  const pausedCount = useMemo(() => members.filter(m => statuses.get(m.id)?.overall === 'paused').length, [members, statuses])
  const list = useMemo(() => filtered
    .filter(m => active || showPaused || statuses.get(m.id)?.overall !== 'paused')
    .filter(m => matchesSearch(m, q))
    .sort(byName), [filtered, active, showPaused, statuses, q])

  const exportList = () => run(async () => {
    const path = await exportExcel({ ...data, members: list, title: describeFilter(filter, groups).join(' · ') || 'Όλα τα μέλη' })
    await alertDialog(`Το Excel με ${list.length} μέλη αποθηκεύτηκε:

${path}`)
  })

  return (
    <div>
      <PageHeader title="Μέλη" subtitle={`${members.length - pausedCount} ενεργά · ${pausedCount} σε παύση`}>
        <Button icon={Download} onClick={exportList} busy={busy} disabled={list.length === 0}>Excel αυτής της λίστας</Button>
        <Button variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>Νέο μέλος</Button>
      </PageHeader>

      <div className="space-y-3 mb-5">
        <SearchBox value={q} onChange={setQ} />
        <FilterBar count={list.length} />
        {!active && pausedCount > 0 && (
          <label className="inline-flex items-center gap-2 h-10 font-semibold text-stone-600 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-ink" checked={showPaused} onChange={e => setShowPaused(e.target.checked)} />
            Δείξε και όσους είναι σε παύση ({pausedCount})
          </label>
        )}
        <ErrorNote error={error} />
      </div>

      {list.length === 0 ? (
        <Card><Empty icon={Users} title={members.length ? 'Κανένα μέλος με αυτά τα κριτήρια' : 'Δεν υπάρχουν ακόμα μέλη'}>
          {!members.length && 'Πάτα «Νέο μέλος» για να ξεκινήσεις.'}
        </Empty></Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {list.map(m => {
            const st = statuses.get(m.id)
            return (
              <button key={m.id} type="button" onClick={() => navigate(`/members/${m.id}`)}
                className="text-left bg-white rounded-2xl border border-stone-200/70 shadow-card p-4 hover:border-stone-300 active:bg-stone-50">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} color={groups.find(g => g.id === m.enrollments?.[0]?.groupId)?.color} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg truncate">{m.name}</p>
                    {m.phone && <p className="text-sm text-stone-500">{m.phone}</p>}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {(st?.items ?? []).map(it => {
                    const g = groups.find(x => x.id === it.groupId)
                    const belt = currentBelt(promotions, m.id, it.groupId)
                    const beltColor = g?.belts?.find(b => b.id === belt?.beltId)?.color
                    return (
                      <div key={it.groupId} className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-stone-700 min-w-24">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: g?.color }} />{g?.name}
                        </span>
                        {belt && <span className="w-5 h-2 rounded-sm ring-1 ring-black/10" style={{ background: beltColor }} title={belt.beltName} />}
                        <span className="flex-1" />
                        <StatusPill state={it.state}>
                          {it.until && (it.state === 'ok' || it.state === 'soon') ? `έως ${fmtDay(it.until)}` : undefined}
                        </StatusPill>
                      </div>
                    )
                  })}
                  {(st?.items ?? []).length === 0 && <p className="text-sm text-stone-500">Χωρίς τμήμα</p>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {adding && <MemberSheet initialName={q.trim()} onClose={() => setAdding(false)} onSaved={m => navigate(`/members/${m.id}`)} />}
    </div>
  )
}

export function Chip({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={cx('inline-flex items-center h-10 px-4 rounded-full font-semibold border transition-colors',
        on ? 'bg-ink text-white border-ink' : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400')}>
      {children}
    </button>
  )
}
