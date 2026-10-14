import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, GraduationCap, ChevronRight, Trash2 } from 'lucide-react'
import { useData } from '../../data/DataContext.jsx'
import { fmtMoney, money, seminarTotals } from '../../data/model.js'
import { fmtDate, isValidDate } from '../../data/dates.js'
import { confirmDialog } from '../../utils/dialogs.js'
import {
  Button, Card, DateInput, Empty, ErrorNote, Field, MoneyInput, PageHeader, Sheet, TextInput, toast, useAction,
} from '../ui.jsx'

/** Create or edit the seminar itself (participants are managed on its page). */
export function SeminarSheet({ seminar, onClose, onSaved }) {
  const { today, saveSeminar, updateSeminar, deleteSeminar } = useData()
  const [title, setTitle] = useState(seminar?.title ?? '')
  const [date, setDate] = useState(seminar?.date ?? today)
  const [price, setPrice] = useState(seminar ? String(seminar.price) : '')
  const [note, setNote] = useState(seminar?.note ?? '')
  const { busy, error, run } = useAction()
  const navigate = useNavigate()

  const save = () => run(async () => {
    const newPrice = money(price)
    const fields = { title: title.trim(), date, price: newPrice, note: note.trim() }
    if (seminar) {
      // Participants who still owe follow a price change; paid ones keep what they paid
      await updateSeminar(seminar.id, s => ({
        ...s,
        ...fields,
        participants: s.participants.map(p => (!p.paidOn && money(p.amount) === money(s.price) ? { ...p, amount: newPrice } : p)),
      }))
      toast('Αποθηκεύτηκε')
    } else {
      const s = await saveSeminar(fields)
      toast('Το σεμινάριο δημιουργήθηκε')
      onSaved?.(s)
    }
    onClose()
  })

  const remove = () => run(async () => {
    const t = seminarTotals(seminar)
    if (!(await confirmDialog(`Διαγραφή του «${seminar.title}»;${t.collected ? `\n\nΘα χαθούν και οι εισπράξεις του (${fmtMoney(t.collected)}) από τα στατιστικά.` : ''}`))) return
    await deleteSeminar(seminar.id)
    onClose()
    navigate('/seminars')
  })

  return (
    <Sheet
      title={seminar ? 'Στοιχεία σεμιναρίου' : 'Νέο σεμινάριο ή έξτρα'}
      onClose={onClose}
      onSave={save}
      saving={busy}
      canSave={Boolean(title.trim() && isValidDate(date) && money(price) >= 0 && price !== '')}
      footer={seminar && <Button variant="danger" icon={Trash2} onClick={remove} className="w-full">Διαγραφή σεμιναρίου</Button>}
    >
      <Field label="Τίτλος"><TextInput value={title} onChange={e => setTitle(e.target.value)} autoFocus={!seminar} placeholder="π.χ. Σεμινάριο BJJ με τον …" /></Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Ημερομηνία"><DateInput value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Τιμή ανά άτομο"><MoneyInput value={price} onChange={setPrice} /></Field>
      </div>
      <Field label="Σημείωση (προαιρετικά)"><TextInput value={note} onChange={e => setNote(e.target.value)} /></Field>
      <ErrorNote error={error} />
    </Sheet>
  )
}

export default function SeminarsPage() {
  const { seminars } = useData()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const list = useMemo(() => [...seminars].sort((a, b) => b.date.localeCompare(a.date)), [seminars])

  return (
    <div>
      <PageHeader title="Σεμινάρια & έξτρα" subtitle="Φτιάξε το μία φορά, διάλεξε ποιοι συμμετέχουν, σημείωσε ποιος πλήρωσε.">
        <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Νέο σεμινάριο</Button>
      </PageHeader>

      {list.length === 0 ? (
        <Card><Empty icon={GraduationCap} title="Δεν υπάρχουν σεμινάρια">Για σεμινάρια, εξετάσεις ζώνης, στολές ή ό,τι άλλο χρεώνεται σε πολλούς μαζί.</Empty></Card>
      ) : (
        <Card className="divide-y divide-stone-100 overflow-hidden">
          {list.map(s => {
            const t = seminarTotals(s)
            return (
              <button key={s.id} type="button" onClick={() => navigate(`/seminars/${s.id}`)}
                className="w-full flex flex-wrap items-center gap-4 px-5 py-4 text-left hover:bg-stone-50">
                <GraduationCap className="text-stone-400" />
                <span className="flex-1 min-w-48">
                  <span className="block font-bold text-lg">{s.title}</span>
                  <span className="text-stone-500">{fmtDate(s.date)} · {fmtMoney(s.price)} το άτομο</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold">{t.paidCount}/{t.count} πλήρωσαν</span>
                  <span className={t.outstanding ? 'text-rose-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                    {t.outstanding ? `μένουν ${fmtMoney(t.outstanding)}` : t.count ? 'εξοφλήθηκε' : 'χωρίς συμμετέχοντες'}
                  </span>
                </span>
                <ChevronRight className="text-stone-300" />
              </button>
            )
          })}
        </Card>
      )}

      {creating && <SeminarSheet onClose={() => setCreating(false)} onSaved={s => navigate(`/seminars/${s.id}`)} />}
    </div>
  )
}
