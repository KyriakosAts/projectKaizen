import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useData } from '../data/DataContext.jsx'
import { currentBelt, nextBelt } from '../data/model.js'
import { fmtDate, isValidDate } from '../data/dates.js'
import { confirmDialog } from '../utils/dialogs.js'
import { Button, Choice, DateInput, ErrorNote, Field, Sheet, TextInput, toast, useAction } from './ui.jsx'

/** New promotion (pre-selects the next belt) or edit/delete of one. */
export default function PromotionSheet({ member, groupId, promotion, onClose }) {
  const { groups, promotions, today, savePromotion, deletePromotion } = useData()
  const group = groups.find(g => g.id === (promotion?.groupId ?? groupId))
  const cur = currentBelt(promotions, member.id, group?.id)
  const [beltId, setBeltId] = useState(promotion?.beltId ?? nextBelt(group, cur?.beltId)?.id ?? cur?.beltId ?? null)
  const [date, setDate] = useState(promotion?.date ?? today)
  const [note, setNote] = useState(promotion?.note ?? '')
  const { busy, error, run } = useAction()

  const belt = group?.belts?.find(b => b.id === beltId)

  const save = () => run(async () => {
    await savePromotion({ ...(promotion ?? {}), memberId: member.id, groupId: group.id, beltId, beltName: belt.name, date, note: note.trim() })
    toast(promotion ? 'Η ζώνη άλλαξε' : `${member.name}: ${belt.name} ζώνη`)
    onClose()
  })

  const remove = () => run(async () => {
    if (!(await confirmDialog(`Διαγραφή της εγγραφής «${promotion.beltName}» (${fmtDate(promotion.date)});`))) return
    await deletePromotion(promotion.id)
    onClose()
  })

  return (
    <Sheet
      title={promotion ? 'Αλλαγή ζώνης' : `Προαγωγή · ${group?.name ?? ''}`}
      onClose={onClose}
      onSave={save}
      saving={busy}
      canSave={Boolean(belt && isValidDate(date))}
      footer={promotion && <Button variant="danger" icon={Trash2} onClick={remove} className="w-full">Διαγραφή εγγραφής</Button>}
    >
      <p className="text-lg"><b>{member.name}</b>{cur && !promotion && <span className="text-stone-500"> · τώρα: {cur.beltName}</span>}</p>
      <Field label="Νέα ζώνη">
        <Choice value={beltId} onChange={setBeltId} options={(group?.belts ?? []).map(b => ({ value: b.id, label: b.name, color: b.color }))} />
      </Field>
      <Field label="Ημερομηνία"><DateInput value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Σημείωση (προαιρετικά)"><TextInput value={note} onChange={e => setNote(e.target.value)} placeholder="π.χ. εξετάσεις Οκτωβρίου" /></Field>
      <ErrorNote error={error} />
    </Sheet>
  )
}
