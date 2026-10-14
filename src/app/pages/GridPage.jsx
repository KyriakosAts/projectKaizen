import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Table2, Check } from 'lucide-react'
import { useData } from '../../data/DataContext.jsx'
import { fmtMoney, isFilterActive, paymentGrid } from '../../data/model.js'
import { addMonthKeys, fmtDay, fmtMonthShort, monthOf, monthRange } from '../../data/dates.js'
import PaymentSheet from '../PaymentSheet.jsx'
import { Chip } from './MembersPage.jsx'
import { FilterBar, useFilter, useFilteredMembers } from '../filter.jsx'
import { Card, Empty, IconButton, PageHeader, cx } from '../ui.jsx'

function read(key, fallback) {
  try { return sessionStorage.getItem(key) ?? fallback } catch { return fallback }
}
function write(key, value) {
  try { sessionStorage.setItem(key, value) } catch { /* ignore */ }
}

/**
 * "Ποιος πλήρωσε ποιον μήνα" — like the paper/spreadsheet register.
 * A cell shows the money paid in that month and the day it was paid; a soft
 * green cell means "covered by an earlier payment". Empty is just empty:
 * a month someone didn't come is never shown as owed.
 */
export default function GridPage() {
  const { groups, payments, statuses, today } = useData()
  const members = useFilteredMembers()
  const filterOn = isFilterActive(useFilter().filter)
  const navigate = useNavigate()
  const thisMonth = monthOf(today)
  const [groupId, setGroupState] = useState(() => read('grid.group', groups[0]?.id ?? ''))
  const [lastMonth, setLastMonth] = useState(thisMonth)
  const [showPaused, setShowPaused] = useState(false)
  const [sheet, setSheet] = useState(null)
  const setGroup = (v) => { setGroupState(v); write('grid.group', v) }

  const group = groups.find(g => g.id === groupId) ?? groups[0]
  const months = useMemo(() => monthRange(lastMonth, 12), [lastMonth])

  const rows = useMemo(() => {
    if (!group) return []
    return paymentGrid(members, payments, group.id, months).filter(r => {
      if (filterOn || showPaused || r.inWindow) return true
      const it = statuses.get(r.member.id)?.items.find(i => i.groupId === group.id)
      return it && it.state !== 'paused'
    })
  }, [members, payments, group, months, showPaused, statuses, filterOn])

  const totals = months.map((_, i) => rows.reduce((s, r) => s + r.cells[i].total, 0))

  // Open on the most recent months (on a portrait tablet the oldest would fill the screen)
  const scroller = useRef(null)
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [group?.id, lastMonth, rows.length > 0])

  function openCell(member, cell) {
    if (cell.payments.length > 0) setSheet({ payment: cell.payments[cell.payments.length - 1] })
    else setSheet({ memberId: member.id, groupId: group.id, date: cell.month === thisMonth ? today : `${cell.month}-01` })
  }

  if (!group) {
    return <Card><Empty icon={Table2} title="Δεν υπάρχουν τμήματα">Πρόσθεσε τμήματα από τις Ρυθμίσεις.</Empty></Card>
  }

  return (
    <div>
      <PageHeader title="Πληρωμές" subtitle="Ποιος πλήρωσε ποιον μήνα. Πάτα ένα κελί για πληρωμή ή διόρθωση." />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {groups.map(g => (
          <Chip key={g.id} on={g.id === group.id} onClick={() => setGroup(g.id)}>
            <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ background: g.color }} />{g.name}
          </Chip>
        ))}
        <span className="flex-1" />
        {!filterOn && (
          <label className="inline-flex items-center gap-2 h-10 px-3 font-semibold text-stone-600 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-ink" checked={showPaused} onChange={e => setShowPaused(e.target.checked)} />
            και όσοι είναι σε παύση
          </label>
        )}
        <div className="flex items-center bg-white border border-stone-300 rounded-xl">
          <IconButton icon={ChevronLeft} label="Προηγούμενοι μήνες" onClick={() => setLastMonth(addMonthKeys(lastMonth, -6))} />
          <span className="px-2 font-semibold min-w-36 text-center">{fmtMonthShort(months[0], true)} – {fmtMonthShort(lastMonth, true)}</span>
          <IconButton icon={ChevronRight} label="Επόμενοι μήνες" onClick={() => setLastMonth(addMonthKeys(lastMonth, 6))} disabled={lastMonth >= thisMonth} className="disabled:opacity-30" />
        </div>
      </div>

      <div className="mb-4"><FilterBar count={rows.length} /></div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <Empty icon={Table2} title={`Κανένα μέλος στο ${group.name}`} />
        ) : (
          <div ref={scroller} className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="sticky left-0 z-10 bg-stone-50 text-left font-semibold text-stone-600 px-4 py-3 min-w-56">Μέλος</th>
                  {months.map(m => (
                    <th key={m} className={cx('font-semibold text-stone-600 px-1 py-3 min-w-[72px]', m === thisMonth && 'bg-amber-50 text-ink')}>
                      {fmtMonthShort(m, m.endsWith('-01') || m === months[0])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.member.id} className="border-b border-stone-100">
                    <th className="sticky left-0 z-10 bg-white text-left px-4 py-2 font-semibold max-w-64">
                      <button type="button" onClick={() => navigate(`/members/${r.member.id}`)} className="truncate block w-full text-left hover:underline">
                        {r.member.name}
                      </button>
                    </th>
                    {r.cells.map(c => (
                      <td key={c.month} className={cx('p-1 text-center', c.month === thisMonth && 'bg-amber-50/60')}>
                        <button
                          type="button"
                          onClick={() => openCell(r.member, c)}
                          disabled={c.month > thisMonth}
                          className={cx(
                            'w-full h-14 rounded-xl flex flex-col items-center justify-center leading-tight transition-colors',
                            c.payments.length ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                              : c.covered ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              : 'hover:bg-stone-100 text-stone-300',
                          )}
                        >
                          {c.payments.length > 0 ? (
                            <>
                              <span className="font-bold">{fmtMoney(c.total)}</span>
                              <span className="text-xs font-semibold opacity-80">
                                {c.payments.length > 1 ? `${c.payments.length}×` : fmtDay(c.payments[0].date)}
                              </span>
                            </>
                          ) : c.covered ? <Check size={18} /> : <span className="text-lg">·</span>}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-stone-50">
                  <th className="sticky left-0 z-10 bg-stone-50 text-left px-4 py-3 font-bold">Σύνολο</th>
                  {totals.map((t, i) => (
                    <td key={months[i]} className="text-center font-bold text-sm px-1 py-3">{t ? fmtMoney(t) : ''}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-5 mt-3 px-1 text-sm text-stone-600">
        <span className="inline-flex items-center gap-2"><span className="w-5 h-5 rounded-md bg-emerald-100" /> πλήρωσε (ποσό · ημέρα)</span>
        <span className="inline-flex items-center gap-2"><span className="w-5 h-5 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600"><Check size={12} /></span> καλύπτεται από προηγούμενη πληρωμή</span>
        <span className="inline-flex items-center gap-2"><span className="w-5 h-5 rounded-md bg-amber-50" /> τρέχων μήνας</span>
      </div>

      {sheet && <PaymentSheet key={sheet.payment?.id ?? `${sheet.memberId}|${sheet.date}`} {...sheet} onClose={() => setSheet(null)} />}
    </div>
  )
}
