/**
 * One member filter for the whole app: set it in Μέλη and the payments grid
 * and the Excel export show the same people. Kept for the session only.
 */

import { createContext, useContext, useMemo, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { useData } from '../data/DataContext.jsx'
import {
  EMPTY_FILTER, STATUS, describeFilter, filterMembers, filterPresets, isFilterActive,
} from '../data/model.js'
import { Button, Choice, DateInput, Field, Sheet, cx } from './ui.jsx'

const KEY = 'dojo.filter'
const FilterContext = createContext(null)

function load() {
  try { return { ...EMPTY_FILTER, ...JSON.parse(sessionStorage.getItem(KEY) ?? '{}') } } catch { return EMPTY_FILTER }
}

export function FilterProvider({ children }) {
  const [filter, setState] = useState(load)
  const setFilter = (f) => {
    setState(f)
    try { sessionStorage.setItem(KEY, JSON.stringify(f)) } catch { /* ignore */ }
  }
  return <FilterContext.Provider value={{ filter, setFilter }}>{children}</FilterContext.Provider>
}

export function useFilter() {
  return useContext(FilterContext)
}

/** Members passing the shared filter (all members when it is empty). */
export function useFilteredMembers() {
  const { members, payments, promotions, seminars, settings, today } = useData()
  const { filter } = useFilter()
  return useMemo(
    () => filterMembers(members, { payments, promotions, seminars, settings, today }, filter),
    [members, payments, promotions, seminars, settings, today, filter],
  )
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Preset chips + "Φίλτρα" button + the active criteria. */
export function FilterBar({ count }) {
  const { groups, today } = useData()
  const { filter, setFilter } = useFilter()
  const [open, setOpen] = useState(false)
  const active = isFilterActive(filter)
  const labels = describeFilter(filter, groups)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {filterPresets(today).map(p => {
          const on = same(filter, p.filter)
          return (
            <button key={p.id} type="button" onClick={() => setFilter(on ? EMPTY_FILTER : p.filter)}
              className={cx('inline-flex items-center h-10 px-4 rounded-full font-semibold border transition-colors',
                on ? 'bg-ink text-white border-ink' : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400')}>
              {p.label}
            </button>
          )
        })}
        <Button size="sm" icon={SlidersHorizontal} onClick={() => setOpen(true)} className="rounded-full">
          Φίλτρα{active ? ` (${labels.length})` : ''}
        </Button>
      </div>
      {active && (
        <div className="flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2">
          <span className="font-semibold text-amber-900">{count != null ? `${count} μέλη:` : 'Φίλτρο:'}</span>
          {labels.map(l => <span key={l} className="px-3 py-1 rounded-full bg-white border border-amber-200 text-sm font-semibold">{l}</span>)}
          <span className="flex-1" />
          <button type="button" onClick={() => setFilter(EMPTY_FILTER)} className="inline-flex items-center gap-1 h-9 px-3 rounded-lg font-semibold text-amber-900 hover:bg-amber-100">
            <X size={16} /> Καθαρισμός
          </button>
        </div>
      )}
      {open && <FilterSheet onClose={() => setOpen(false)} />}
    </div>
  )
}

const MONTH_CHOICES = [
  { value: 0, label: 'Όλοι' },
  { value: 1, label: '1 μήνα' },
  { value: 2, label: '2 μήνες' },
  { value: 3, label: '3 μήνες' },
  { value: 6, label: '6 μήνες' },
]

function FilterSheet({ onClose }) {
  const { members, payments, promotions, seminars, settings, today, groups } = useData()
  const { filter, setFilter } = useFilter()
  const [f, setF] = useState(filter)
  const patch = (change) => setF({ ...f, ...change })
  const count = useMemo(
    () => filterMembers(members, { payments, promotions, seminars, settings, today }, f).length,
    [members, payments, promotions, seminars, settings, today, f],
  )

  return (
    <Sheet title="Φίλτρα" onClose={onClose} onSave={() => { setFilter(f); onClose() }} saveLabel={`Εμφάνιση ${count}`} wide
      footer={<Button variant="ghost" icon={X} onClick={() => setF(EMPTY_FILTER)} className="w-full">Καθαρισμός όλων</Button>}>
      <Field label="Τμήμα">
        <Choice multiple value={f.groups} onChange={v => patch({ groups: v })}
          options={groups.map(g => ({ value: g.id, label: g.name, color: g.color }))} />
      </Field>

      <Field label="Κατάσταση συνδρομής">
        <Choice multiple value={f.states} onChange={v => patch({ states: v })}
          options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} />
      </Field>

      <Field label="Δεν έχουν πληρώσει εδώ και">
        <Choice value={f.notPaidMonths ?? 0} onChange={v => patch({ notPaidMonths: v || null })} options={MONTH_CHOICES} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Πλήρωσαν από"><DateInput value={f.paidFrom} onChange={e => patch({ paidFrom: e.target.value })} /></Field>
        <Field label="έως"><DateInput value={f.paidTo} onChange={e => patch({ paidTo: e.target.value })} /></Field>
      </div>

      {groups.filter(g => g.belts?.length).map(g => (
        <Field key={g.id} label={`Ζώνη · ${g.name}`}>
          <Choice multiple value={f.belts} onChange={v => patch({ belts: v })}
            options={g.belts.map(b => ({ value: `${g.id}:${b.id}`, label: b.name, color: b.color }))} />
        </Field>
      ))}

      <Field label="Ξεκίνησαν από" hint={f.joinedFrom ? undefined : 'π.χ. 1η του μήνα για τους νέους'}>
        <DateInput value={f.joinedFrom} onChange={e => patch({ joinedFrom: e.target.value })} />
      </Field>

      <Field label="Άλλα">
        <Choice multiple
          value={[f.customPrice && 'price', f.owesSeminar && 'seminar'].filter(Boolean)}
          onChange={v => patch({ customPrice: v.includes('price'), owesSeminar: v.includes('seminar') })}
          options={[{ value: 'price', label: 'Με δική τους τιμή' }, { value: 'seminar', label: 'Χρωστάνε σεμινάριο' }]} />
      </Field>
    </Sheet>
  )
}
