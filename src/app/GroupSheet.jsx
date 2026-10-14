import { useState } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react'
import { useData } from '../data/DataContext.jsx'
import { money, newId } from '../data/model.js'
import { PALETTE } from '../data/defaults.js'
import { confirmDialog } from '../utils/dialogs.js'
import { Button, ErrorNote, Field, IconButton, MoneyInput, Sheet, TextInput, toast, useAction, cx } from './ui.jsx'

const UNITS = [
  { value: 'day', label: 'ημέρες' },
  { value: 'week', label: 'εβδομάδες' },
  { value: 'month', label: 'μήνες' },
]

const BELT_COLORS = ['#e5e7eb', '#facc15', '#fb923c', '#22c55e', '#3b82f6', '#9333ea', '#92400e', '#111827', '#ef4444', '#6b7280']

function Swatches({ colors, value, onChange, size = 40 }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={c}
          className={cx('rounded-full ring-1 ring-black/10', value === c && 'outline outline-[3px] outline-offset-2 outline-ink')}
          style={{ width: size, height: size, background: c }} />
      ))}
    </div>
  )
}

/** Edit a group: name, colour, what a payment can cover (plans + prices),
 *  and the belt ladder. All of it applies immediately — no new app build. */
export default function GroupSheet({ group, onClose }) {
  const { groups, saveGroup, deleteGroup } = useData()
  const [name, setName] = useState(group?.name ?? '')
  const [color, setColor] = useState(group?.color ?? PALETTE[groups.length % PALETTE.length])
  const [plans, setPlans] = useState(() => (group?.plans ?? [
    { id: 'month', label: 'Μήνας', unit: 'month', count: 1, price: null },
  ]).map(p => ({ ...p, price: p.price == null ? '' : String(p.price) })))
  const [belts, setBelts] = useState(group?.belts ?? [])
  const [colorFor, setColorFor] = useState(null)   // belt id whose colour is being picked
  const { busy, error, run } = useAction()

  const patchPlan = (i, change) => setPlans(plans.map((p, j) => (i === j ? { ...p, ...change } : p)))
  const patchBelt = (i, change) => setBelts(belts.map((b, j) => (i === j ? { ...b, ...change } : b)))
  const moveBelt = (i, d) => {
    const next = [...belts]
    const [b] = next.splice(i, 1)
    next.splice(i + d, 0, b)
    setBelts(next)
  }

  const valid = name.trim() && plans.length > 0
    && plans.every(p => p.label.trim() && Number(p.count) >= 1)
    && belts.every(b => b.name.trim())

  const save = () => run(async () => {
    await saveGroup({
      ...(group ?? {}),
      name: name.trim(),
      color,
      plans: plans.map(p => ({
        id: p.id, label: p.label.trim(), unit: p.unit, count: Math.round(Number(p.count)),
        price: p.price === '' ? null : money(p.price),
      })),
      belts: belts.map(b => ({ ...b, name: b.name.trim() })),
    })
    toast('Το τμήμα αποθηκεύτηκε')
    onClose()
  })

  const remove = () => run(async () => {
    if (!(await confirmDialog(`Διαγραφή του τμήματος «${group.name}»;`))) return
    await deleteGroup(group.id)
    onClose()
  })

  return (
    <Sheet
      title={group ? group.name : 'Νέο τμήμα'}
      onClose={onClose}
      onSave={save}
      saving={busy}
      canSave={Boolean(valid)}
      wide
      footer={group && <Button variant="danger" icon={Trash2} onClick={remove} className="w-full">Διαγραφή τμήματος</Button>}
    >
      <Field label="Όνομα"><TextInput value={name} onChange={e => setName(e.target.value)} autoFocus={!group} placeholder="π.χ. Kickboxing" /></Field>
      <Field label="Χρώμα"><Swatches colors={PALETTE} value={color} onChange={setColor} /></Field>

      <section className="space-y-3">
        <div>
          <h3 className="font-bold text-lg">Πακέτα & τιμές</h3>
          <p className="text-sm text-stone-500">Τι μπορεί να πληρώσει κάποιος σε αυτό το τμήμα. Άδεια τιμή = γράφεται τη στιγμή της πληρωμής.</p>
        </div>
        {plans.map((p, i) => (
          <div key={p.id} className="flex flex-wrap items-end gap-3 bg-white rounded-2xl border border-stone-200 p-3">
            <Field label="Όνομα" className="flex-1 min-w-40">
              <TextInput value={p.label} onChange={e => patchPlan(i, { label: e.target.value })} />
            </Field>
            <Field label="Διάρκεια" className="w-48">
              <div className="flex gap-2">
                <input className="field w-16 px-2 text-center" inputMode="numeric" value={p.count}
                  onChange={e => patchPlan(i, { count: e.target.value.replace(/\D/g, '') })} />
                <select className="field flex-1 px-2" value={p.unit} onChange={e => patchPlan(i, { unit: e.target.value })}>
                  {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Τιμή" className="w-32"><MoneyInput value={p.price} onChange={v => patchPlan(i, { price: v })} /></Field>
            <IconButton icon={X} label="Αφαίρεση πακέτου" onClick={() => setPlans(plans.filter((_, j) => j !== i))} disabled={plans.length === 1} className="disabled:opacity-30" />
          </div>
        ))}
        <Button size="sm" icon={Plus} onClick={() => setPlans([...plans, { id: newId(), label: '', unit: 'month', count: 1, price: '' }])}>Νέο πακέτο</Button>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-bold text-lg">Ζώνες</h3>
          <p className="text-sm text-stone-500">Με τη σειρά, από την πρώτη στην τελευταία. Χωρίς ζώνες, το τμήμα απλώς δεν έχει προαγωγές.</p>
        </div>
        {belts.map((b, i) => (
          <div key={b.id} className="bg-white rounded-2xl border border-stone-200 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setColorFor(colorFor === b.id ? null : b.id)} aria-label="Χρώμα ζώνης"
                className="w-12 h-12 rounded-xl ring-1 ring-black/10 shrink-0" style={{ background: b.color }} />
              <TextInput value={b.name} onChange={e => patchBelt(i, { name: e.target.value })} />
              <IconButton icon={ArrowUp} label="Πάνω" onClick={() => moveBelt(i, -1)} disabled={i === 0} className="disabled:opacity-30" />
              <IconButton icon={ArrowDown} label="Κάτω" onClick={() => moveBelt(i, 1)} disabled={i === belts.length - 1} className="disabled:opacity-30" />
              <IconButton icon={X} label="Αφαίρεση ζώνης" onClick={() => setBelts(belts.filter((_, j) => j !== i))} />
            </div>
            {colorFor === b.id && <Swatches colors={BELT_COLORS} value={b.color} onChange={c => { patchBelt(i, { color: c }); setColorFor(null) }} size={36} />}
          </div>
        ))}
        <Button size="sm" icon={Plus} onClick={() => setBelts([...belts, { id: newId(), name: '', color: '#e5e7eb' }])}>Νέα ζώνη</Button>
      </section>

      <ErrorNote error={error} />
    </Sheet>
  )
}
