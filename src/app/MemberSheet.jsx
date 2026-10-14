import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useData } from '../data/DataContext.jsx'
import { fmtMoney, money, newId } from '../data/model.js'
import { isValidDate } from '../data/dates.js'
import { confirmDialog } from '../utils/dialogs.js'
import {
  Button, Choice, DateInput, ErrorNote, Field, MoneyInput, Sheet, TextInput, toast, useAction,
} from './ui.jsx'

/** Create or edit a member. Belts of a NEW member are set here; later
 *  changes are promotions, made from the member's page. */
export default function MemberSheet({ member, initialName = '', onClose, onSaved, onDeleted }) {
  const { groups, today, saveMember, deleteMember, payments } = useData()
  const editing = Boolean(member)

  const [name, setName] = useState(member?.name ?? initialName)
  const [phone, setPhone] = useState(member?.phone ?? '')
  const [notes, setNotes] = useState(member?.notes ?? '')
  const [enrollments, setEnrollments] = useState(member?.enrollments ?? [])
  const [belts, setBelts] = useState({})   // groupId → beltId, new members only
  const { busy, error, run } = useAction()

  const selected = enrollments.map(e => e.groupId)
  const setSelected = (ids) => setEnrollments(ids.map(id =>
    enrollments.find(e => e.groupId === id) ?? { groupId: id, since: today, price: null }))
  const patch = (groupId, change) => setEnrollments(enrollments.map(e => (e.groupId === groupId ? { ...e, ...change } : e)))

  const valid = name.trim() && enrollments.length > 0 && enrollments.every(e => isValidDate(e.since))

  const save = () => run(async () => {
    const id = member?.id ?? newId()
    const cleaned = enrollments.map(e => ({ ...e, price: e.price === '' || e.price == null ? null : money(e.price) || null }))
    const promoOps = editing ? [] : cleaned.flatMap(e => {
      const g = groups.find(x => x.id === e.groupId)
      const beltId = belts[e.groupId] ?? g?.belts?.[0]?.id
      const belt = g?.belts?.find(b => b.id === beltId)
      if (!belt) return []
      const pid = newId()
      return [{ op: 'put', collection: 'promotions', id: pid, data: {
        id: pid, memberId: id, groupId: e.groupId, beltId: belt.id, beltName: belt.name,
        date: e.since, note: '', createdAt: new Date().toISOString(),
      } }]
    })
    const saved = await saveMember({ ...(member ?? {}), id, name: name.trim(), phone: phone.trim(), notes: notes.trim(), enrollments: cleaned }, promoOps)
    toast(editing ? 'Οι αλλαγές αποθηκεύτηκαν' : `Νέο μέλος: ${saved.name}`)
    onSaved?.(saved)
    onClose()
  })

  const remove = () => run(async () => {
    const count = payments.filter(p => p.memberId === member.id).length
    const ok = await confirmDialog(
      `Οριστική διαγραφή του μέλους «${member.name}»;\n\nΘα σβηστούν και οι ${count} πληρωμές του και οι ζώνες του. ` +
      'Αν απλώς σταμάτησε να έρχεται, δεν χρειάζεται διαγραφή — περνάει μόνο του «σε παύση».',
    )
    if (!ok) return
    await deleteMember(member.id)
    toast('Το μέλος διαγράφηκε')
    onDeleted?.()
    onClose()
  })

  return (
    <Sheet
      title={editing ? 'Στοιχεία μέλους' : 'Νέο μέλος'}
      onClose={onClose}
      onSave={save}
      saving={busy}
      canSave={Boolean(valid)}
      footer={editing && <Button variant="danger" icon={Trash2} onClick={remove} className="w-full">Διαγραφή μέλους</Button>}
    >
      <Field label="Ονοματεπώνυμο">
        <TextInput value={name} onChange={e => setName(e.target.value)} autoFocus={!editing} placeholder="π.χ. Παπαδόπουλος Γιώργος" />
      </Field>
      <Field label="Τηλέφωνο">
        <TextInput type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="προαιρετικό" />
      </Field>

      <Field label="Τμήματα" hint={enrollments.length === 0 ? 'Διάλεξε τουλάχιστον ένα τμήμα.' : undefined}>
        <Choice multiple value={selected} onChange={setSelected}
          options={groups.map(g => ({ value: g.id, label: g.name, color: g.color }))} />
      </Field>

      {enrollments.map(e => {
        const g = groups.find(x => x.id === e.groupId)
        if (!g) return null
        const monthly = g.plans?.find(p => p.unit === 'month' && p.count === 1)
        return (
          <div key={e.groupId} className="rounded-2xl bg-white border border-stone-200 p-4 space-y-4">
            <p className="font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: g.color }} />{g.name}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ξεκίνησε">
                <DateInput value={e.since ?? ''} onChange={ev => patch(e.groupId, { since: ev.target.value })} />
              </Field>
              {monthly && (
                <Field label="Δική του τιμή μήνα" hint={`Κανονική: ${monthly.price != null ? fmtMoney(monthly.price) : '—'}`}>
                  <MoneyInput value={e.price ?? ''} onChange={v => patch(e.groupId, { price: v })} placeholder="ίδια με το τμήμα" />
                </Field>
              )}
            </div>
            {!editing && g.belts?.length > 0 && (
              <Field label="Ζώνη">
                <Choice
                  value={belts[e.groupId] ?? g.belts[0].id}
                  onChange={v => setBelts({ ...belts, [e.groupId]: v })}
                  options={g.belts.map(b => ({ value: b.id, label: b.name, color: b.color }))}
                />
              </Field>
            )}
          </div>
        )
      })}

      <Field label="Σημειώσεις">
        <textarea className="field" rows={4} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="π.χ. τραυματισμοί, γονείς, ό,τι χρειάζεται να θυμάσαι" />
      </Field>

      <ErrorNote error={error} />
    </Sheet>
  )
}
