import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Pencil, UserPlus, CheckCheck, Check, Users, Trash2 } from 'lucide-react'
import { useData } from '../../data/DataContext.jsx'
import { byName, fmtMoney, money, seminarTotals } from '../../data/model.js'
import { fmtDate, fmtDay, isValidDate } from '../../data/dates.js'
import { confirmDialog } from '../../utils/dialogs.js'
import { MemberPicker } from '../MemberPicker.jsx'
import { SeminarSheet } from './SeminarsPage.jsx'
import {
  Avatar, Button, Card, DateInput, Empty, ErrorNote, Field, MoneyInput, Sheet, toast, useAction, cx,
} from '../ui.jsx'

function AddParticipantsSheet({ seminar, onClose }) {
  const { members, groups, statuses, updateSeminar } = useData()
  const already = new Set(seminar.participants.map(p => p.memberId))
  const [picked, setPicked] = useState(() => new Set())
  const { busy, error, run } = useAction()

  const toggle = (m) => {
    const next = new Set(picked)
    next.has(m.id) ? next.delete(m.id) : next.add(m.id)
    setPicked(next)
  }
  const addGroup = (groupId) => {
    const next = new Set(picked)
    for (const m of members) {
      const active = statuses.get(m.id)?.items.some(i => i.groupId === groupId && i.state !== 'paused')
      if (active && !already.has(m.id)) next.add(m.id)
    }
    setPicked(next)
  }

  const save = () => run(async () => {
    await updateSeminar(seminar.id, s => {
      const have = new Set(s.participants.map(p => p.memberId))
      const added = [...picked].filter(id => !have.has(id)).map(memberId => ({ memberId, amount: s.price, paidOn: null }))
      return { ...s, participants: [...s.participants, ...added] }
    })
    toast(`Προστέθηκαν ${picked.size}`)
    onClose()
  })

  return (
    <Sheet title="Ποιοι συμμετέχουν" onClose={onClose} onSave={save} saving={busy} canSave={picked.size > 0}
      saveLabel={picked.size ? `Προσθήκη (${picked.size})` : 'Προσθήκη'}>
      <div className="flex flex-wrap gap-2">
        <span className="self-center font-semibold text-stone-600 mr-1">Όλο το τμήμα:</span>
        {groups.map(g => (
          <Button key={g.id} size="sm" icon={Users} onClick={() => addGroup(g.id)}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />{g.name}
          </Button>
        ))}
      </div>
      <MemberPicker autoFocus={false} selected={picked} onToggle={toggle} filter={m => !already.has(m.id)}
        emptyText="Όλα τα μέλη είναι ήδη στη λίστα" />
      <ErrorNote error={error} />
    </Sheet>
  )
}

function ParticipantSheet({ seminar, participant, onClose }) {
  const { members, today, updateSeminar } = useData()
  const member = members.find(m => m.id === participant.memberId)
  const [amount, setAmount] = useState(String(participant.amount))
  const [paid, setPaid] = useState(Boolean(participant.paidOn))
  const [paidOn, setPaidOn] = useState(participant.paidOn ?? today)
  const { busy, error, run } = useAction()

  const update = (fn) => updateSeminar(seminar.id, s => ({ ...s, participants: fn(s.participants) }))

  const save = () => run(async () => {
    await update(list => list.map(p => (p.memberId === participant.memberId
      ? { ...p, amount: money(amount), paidOn: paid ? paidOn : null } : p)))
    onClose()
  })
  const remove = () => run(async () => {
    if (!(await confirmDialog(`Αφαίρεση του/της ${member?.name ?? ''} από το «${seminar.title}»;`))) return
    await update(list => list.filter(p => p.memberId !== participant.memberId))
    onClose()
  })

  return (
    <Sheet title={member?.name ?? 'Συμμετέχων'} onClose={onClose} onSave={save} saving={busy}
      canSave={money(amount) >= 0 && (!paid || isValidDate(paidOn))}
      footer={<Button variant="danger" icon={Trash2} onClick={remove} className="w-full">Αφαίρεση από τη λίστα</Button>}>
      <Field label="Ποσό"><MoneyInput value={amount} onChange={setAmount} /></Field>
      <label className="flex items-center gap-3 h-12 font-semibold cursor-pointer">
        <input type="checkbox" className="w-6 h-6 accent-emerald-600" checked={paid} onChange={e => setPaid(e.target.checked)} />
        Πλήρωσε
      </label>
      {paid && <Field label="Ημερομηνία πληρωμής"><DateInput value={paidOn} onChange={e => setPaidOn(e.target.value)} /></Field>}
      <ErrorNote error={error} />
    </Sheet>
  )
}

export default function SeminarPage() {
  const { seminarId } = useParams()
  const { seminars, members, groups, today, updateSeminar } = useData()
  const seminar = seminars.find(s => s.id === seminarId)
  const [sheet, setSheet] = useState(null)
  const { error, run } = useAction()

  const rows = useMemo(() => {
    if (!seminar) return []
    return seminar.participants
      .map(p => ({ p, member: members.find(m => m.id === p.memberId) }))
      .filter(r => r.member)
      .sort((a, b) => Boolean(a.p.paidOn) - Boolean(b.p.paidOn) || byName(a.member, b.member))
  }, [seminar, members])

  if (!seminar) {
    return <Card><Empty title="Το σεμινάριο δεν βρέθηκε"><Link to="/seminars" className="underline">Πίσω</Link></Empty></Card>
  }
  const t = seminarTotals(seminar)

  const setPaid = (memberId, paidOn) => run(() => updateSeminar(seminar.id, s => ({
    ...s,
    participants: s.participants.map(p => (p.memberId === memberId ? { ...p, paidOn } : p)),
  })))

  const allPaid = () => run(async () => {
    const unpaid = seminar.participants.filter(p => !p.paidOn).length
    if (!(await confirmDialog(`Να σημειωθούν και οι ${unpaid} ως «πλήρωσαν» σήμερα;`))) return
    await updateSeminar(seminar.id, s => ({ ...s, participants: s.participants.map(p => (p.paidOn ? p : { ...p, paidOn: today })) }))
    toast('Όλοι πλήρωσαν')
  })

  return (
    <div className="space-y-6">
      <Link to="/seminars" className="inline-flex items-center gap-1 font-semibold text-stone-600 h-10 -ml-1 pr-3 rounded-lg hover:bg-stone-200/60">
        <ChevronLeft size={20} /> Σεμινάρια
      </Link>

      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-48">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{seminar.title}</h1>
            <p className="text-stone-500 mt-1">{fmtDate(seminar.date)} · {fmtMoney(seminar.price)} το άτομο{seminar.note ? ` · ${seminar.note}` : ''}</p>
          </div>
          <Button icon={Pencil} onClick={() => setSheet({ kind: 'edit' })}>Στοιχεία</Button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Stat label="Συμμετέχουν" value={t.count} />
          <Stat label="Εισπράχθηκαν" value={fmtMoney(t.collected)} tone="emerald" />
          <Stat label="Μένουν" value={fmtMoney(t.outstanding)} tone={t.outstanding ? 'rose' : undefined} />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={UserPlus} onClick={() => setSheet({ kind: 'add' })}>Προσθήκη συμμετεχόντων</Button>
        {t.count > t.paidCount && <Button variant="pay" icon={CheckCheck} onClick={allPaid}>Πλήρωσαν όλοι</Button>}
      </div>
      <ErrorNote error={error} />

      <Card className="divide-y divide-stone-100 overflow-hidden">
        {rows.length === 0 && <Empty icon={Users} title="Κανένας συμμετέχων ακόμα">Πάτα «Προσθήκη συμμετεχόντων».</Empty>}
        {rows.map(({ p, member }) => {
          const g = groups.find(x => x.id === member.enrollments?.[0]?.groupId)
          return (
            <div key={p.memberId} className="flex items-center gap-3 px-4 py-3">
              <button type="button" onClick={() => setSheet({ kind: 'part', participant: p })} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <Avatar name={member.name} color={g?.color} size={40} />
                <span className="min-w-0">
                  <span className="block font-bold truncate">{member.name}</span>
                  <span className="text-sm text-stone-500">{fmtMoney(p.amount)}{p.paidOn ? ` · πλήρωσε ${fmtDay(p.paidOn)}` : ''}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaid(p.memberId, p.paidOn ? null : today)}
                className={cx('h-12 px-4 rounded-xl font-semibold inline-flex items-center gap-2 border-2 min-w-36 justify-center',
                  p.paidOn ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-300 text-stone-700 hover:border-emerald-500')}
              >
                {p.paidOn ? <><Check size={18} strokeWidth={3} /> Πλήρωσε</> : 'Δεν πλήρωσε'}
              </button>
            </div>
          )
        })}
      </Card>

      {sheet?.kind === 'edit' && <SeminarSheet seminar={seminar} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'add' && <AddParticipantsSheet seminar={seminar} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'part' && <ParticipantSheet key={sheet.participant.memberId} seminar={seminar} participant={sheet.participant} onClose={() => setSheet(null)} />}
    </div>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className={cx('rounded-2xl px-4 py-3', tone === 'emerald' ? 'bg-emerald-50' : tone === 'rose' ? 'bg-rose-50' : 'bg-stone-100')}>
      <p className="text-sm text-stone-500">{label}</p>
      <p className="text-xl font-extrabold">{value}</p>
    </div>
  )
}
