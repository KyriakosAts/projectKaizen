import { useEffect, useMemo, useState } from 'react'
import { Trash2, CalendarRange, UserPlus, X } from 'lucide-react'
import { useData } from '../data/DataContext.jsx'
import { coverageEnd, fmtMoney, money, periodStart, planPrice, relatives } from '../data/model.js'
import { fmtDate, fmtDay, isValidDate } from '../data/dates.js'
import { confirmDialog } from '../utils/dialogs.js'
import { MemberPicker } from './MemberPicker.jsx'
import {
  Avatar, Button, Choice, DateInput, ErrorNote, Field, IconButton, MoneyInput, Sheet, TextInput, toast, useAction, cx,
} from './ui.jsx'

const OTHER = '__other'

/** The plan a member's group offers that matches `planId`, else its first plan. */
function planFor(group, planId) {
  return group?.plans?.find(p => p.id === planId) ?? group?.plans?.[0] ?? null
}

/**
 * Period for one payment. mode: 'continue' (day after current coverage),
 * 'today' (the payment date), 'custom' (from/to typed by hand).
 */
function periodFor(payments, memberId, group, plan, date, mode, custom) {
  if (!group || !plan || !isValidDate(date)) return null
  if (mode === 'custom') return custom
  const { continueFrom } = periodStart(payments, memberId, group.id, plan, date)
  const from = mode === 'continue' && continueFrom ? continueFrom : date
  return { from, to: coverageEnd(from, plan) }
}

/**
 * New payment (optionally for a given member/group/date) or edit of one.
 * The period starts, by default, where the member's last one ended — so they
 * keep their usual date. If they were away, one tap on «Από σήμερα» (or a
 * date) starts it later and the absence is never charged.
 */
export default function PaymentSheet({ memberId: initialMember, groupId: initialGroup, date: initialDate, payment, onClose }) {
  const { members, groups, payments, today, savePayments, savePayment, deletePayment, deletePayments } = useData()
  const editing = Boolean(payment)

  const [memberId, setMemberId] = useState(payment?.memberId ?? initialMember ?? null)
  const member = members.find(m => m.id === memberId) ?? null
  const enrollments = member?.enrollments ?? []

  const [groupId, setGroupId] = useState(payment?.groupId ?? initialGroup ?? null)
  const group = groups.find(g => g.id === groupId) ?? null
  const enrollment = enrollments.find(e => e.groupId === groupId)

  const [planId, setPlanId] = useState(payment ? (payment.planId ?? OTHER) : null)
  const plan = group?.plans?.find(p => p.id === planId) ?? null

  const [amount, setAmount] = useState(payment ? String(payment.amount) : '')
  const [amountTouched, setAmountTouched] = useState(editing)
  const [date, setDate] = useState(payment?.date ?? initialDate ?? today)
  const [note, setNote] = useState(payment?.note ?? '')
  const [label, setLabel] = useState(payment && !payment.planId ? payment.label ?? '' : '')
  // Editing keeps the stored period until something is changed on purpose
  const [mode, setMode] = useState(editing && payment.from ? 'custom' : null)
  const [custom, setCustom] = useState({ from: payment?.from ?? '', to: payment?.to ?? '' })
  const [extras, setExtras] = useState([])   // family: [{ memberId, groupId, amount }]
  const [picking, setPicking] = useState(false)
  const { busy, error, run } = useAction()

  const others = useMemo(() => payments.filter(p => p.id !== payment?.id), [payments, payment])
  const start = useMemo(() => (member && group && plan && isValidDate(date)
    ? periodStart(others, member.id, group.id, plan, date) : null), [others, member, group, plan, date])

  // Pick the only group automatically; default plan = the group's first
  useEffect(() => {
    if (member && !groupId && enrollments.length === 1) setGroupId(enrollments[0].groupId)
  }, [member, groupId, enrollments])
  useEffect(() => {
    if (group && !planId && group.plans?.length) setPlanId(group.plans[0].id)
  }, [group, planId])

  // Price follows the plan until typed by hand
  useEffect(() => {
    if (amountTouched || !plan) return
    const p = planPrice(plan, enrollment)
    setAmount(p != null ? String(p) : '')
  }, [plan, enrollment, amountTouched])

  // Default start: continue, unless that would already be over
  const effectiveMode = mode ?? (start?.defaultFrom === start?.continueFrom && start?.continueFrom ? 'continue' : 'today')
  const period = planId === OTHER ? null
    : periodFor(others, member?.id, group, plan, date, effectiveMode, custom)

  // Family members ride on the same plan id, date and start mode
  const extraRows = extras.map(x => {
    const m = members.find(mm => mm.id === x.memberId)
    const g = groups.find(gg => gg.id === x.groupId)
    const p = planFor(g, planId)
    const e = m?.enrollments?.find(en => en.groupId === x.groupId)
    const per = planId === OTHER ? null
      : periodFor(payments, x.memberId, g, p, date, effectiveMode === 'custom' ? 'today' : effectiveMode, null)
    return { ...x, member: m, group: g, plan: p, enrollment: e, period: per }
  }).filter(r => r.member && r.group)

  const amountValue = money(amount)
  const validPeriod = (p) => p && isValidDate(p.from) && isValidDate(p.to) && p.from <= p.to
  const canSave = member && group && planId && amountValue > 0 && isValidDate(date)
    && (planId === OTHER || validPeriod(period))
    && extraRows.every(r => money(r.amount) > 0 && (planId === OTHER || validPeriod(r.period)))

  const suggestions = useMemo(() => (member && !editing
    ? relatives(members, member).filter(m => !extras.some(x => x.memberId === m.id) && m.enrollments?.length)
    : []), [members, member, editing, extras])

  function addExtra(m) {
    const g = groups.find(gg => gg.id === (m.enrollments.find(e => e.groupId === groupId)?.groupId ?? m.enrollments[0]?.groupId))
    const p = planFor(g, planId)
    const e = m.enrollments.find(en => en.groupId === g?.id)
    const price = p ? planPrice(p, e) : null
    setExtras([...extras, { memberId: m.id, groupId: g?.id, amount: price != null ? String(price) : '' }])
    setPicking(false)
  }

  const record = (memberId2, group2, plan2, amount2, period2, noteText) => {
    const isOther = planId === OTHER
    return {
      memberId: memberId2,
      groupId: group2.id,
      date,
      amount: money(amount2),
      planId: isOther ? null : plan2.id,
      label: isOther ? (label.trim() || 'Άλλο') : plan2.label,
      from: isOther ? null : period2.from,
      to: isOther ? null : period2.to,
      note: noteText,
    }
  }

  const save = () => run(async () => {
    if (editing) {
      await savePayment({ ...payment, ...record(member.id, group, plan, amount, period, note.trim()) })
      toast(`Η πληρωμή άλλαξε · ${member.name}`)
      onClose()
      return
    }
    // Each payment notes who else it was paid together with
    const everyone = [member, ...extraRows.map(r => r.member)]
    const noteFor = (m) => [note.trim(), extraRows.length
      ? `μαζί με ${everyone.filter(x => x.id !== m.id).map(x => x.name).join(', ')}` : ''].filter(Boolean).join(' · ')
    const list = [
      record(member.id, group, plan, amount, period, noteFor(member)),
      ...extraRows.map(r => record(r.member.id, r.group, r.plan, r.amount, r.period, noteFor(r.member))),
    ]
    const saved = await savePayments(list)
    const total = saved.reduce((s, p) => s + p.amount, 0)
    const who = saved.length > 1 ? `${saved.length} άτομα` : member.name
    toast(`Πληρωμή ${fmtMoney(total)} · ${who}`, {
      label: 'Αναίρεση',
      onClick: () => deletePayments(saved.map(p => p.id)).then(() => toast('Η πληρωμή αναιρέθηκε')),
    })
    onClose()
  })

  const remove = () => run(async () => {
    if (!(await confirmDialog(`Διαγραφή της πληρωμής ${fmtMoney(payment.amount)} της ${fmtDate(payment.date)};`))) return
    await deletePayment(payment.id)
    toast('Η πληρωμή διαγράφηκε')
    onClose()
  })

  // Step 1: choose a member
  if (!member) {
    return (
      <Sheet title="Νέα πληρωμή" onClose={onClose}>
        <p className="text-stone-600 font-medium">Ποιος πληρώνει;</p>
        <MemberPicker onPick={m => { setMemberId(m.id); setGroupId(null); setPlanId(null); setAmountTouched(false) }} />
      </Sheet>
    )
  }

  if (picking) {
    return (
      <Sheet title="Πληρώνει και για…" onClose={() => setPicking(false)}>
        <MemberPicker onPick={addExtra}
          filter={m => m.id !== member.id && !extras.some(x => x.memberId === m.id) && m.enrollments?.length > 0} />
      </Sheet>
    )
  }

  const planOptions = [
    ...(group?.plans ?? []).map(p => {
      const price = planPrice(p, enrollment)
      return { value: p.id, label: p.label, sub: price != null ? fmtMoney(price) : 'ποσό με το χέρι' }
    }),
    { value: OTHER, label: 'Άλλο', sub: 'χωρίς διάρκεια' },
  ]

  const startOptions = []
  if (start?.continueFrom) startOptions.push({ value: 'continue', label: `Συνέχεια από ${fmtDay(start.continueFrom)}`, sub: 'κρατάει την ημερομηνία του' })
  startOptions.push({ value: 'today', label: date === today ? `Από σήμερα ${fmtDay(date)}` : `Από ${fmtDay(date)}`, sub: start?.continueFrom ? 'αν έλειπε' : 'πρώτη πληρωμή' })
  startOptions.push({ value: 'custom', label: 'Άλλη ημερομηνία', sub: 'διαλέγεις εσύ' })

  const grandTotal = amountValue + extraRows.reduce((s, r) => s + money(r.amount), 0)

  return (
    <Sheet
      title={editing ? 'Αλλαγή πληρωμής' : 'Νέα πληρωμή'}
      onClose={onClose}
      onSave={save}
      saving={busy}
      canSave={Boolean(canSave)}
      saveLabel={extraRows.length ? `Αποθήκευση · ${fmtMoney(grandTotal)}` : 'Αποθήκευση'}
      footer={editing && <Button variant="danger" icon={Trash2} onClick={remove} className="w-full">Διαγραφή πληρωμής</Button>}
    >
      <div className="flex items-center gap-3 bg-white rounded-2xl border border-stone-200 p-3">
        <Avatar name={member.name} color={group?.color} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg truncate">{member.name}</p>
          <p className="text-sm text-stone-500">{[enrollments.length === 1 && group?.name, member.phone].filter(Boolean).join(' · ')}</p>
        </div>
        {!editing && !initialMember && (
          <Button variant="ghost" size="sm" onClick={() => { setMemberId(null); setExtras([]) }}>Αλλαγή</Button>
        )}
      </div>

      {enrollments.length === 0 ? (
        <ErrorNote error="Το μέλος δεν είναι γραμμένο σε κανένα τμήμα. Πρόσθεσε τμήμα από την καρτέλα του." />
      ) : enrollments.length > 1 && (
        <Field label="Τμήμα">
          <Choice
            value={groupId}
            onChange={v => { setGroupId(v); setPlanId(null); setMode(null); setAmountTouched(false) }}
            options={enrollments.map(e => {
              const g = groups.find(x => x.id === e.groupId)
              return { value: e.groupId, label: g?.name ?? '—', color: g?.color }
            })}
          />
        </Field>
      )}

      {group && (
        <Field label="Τι πληρώνει">
          <Choice value={planId} onChange={v => { setPlanId(v); setAmountTouched(false); if (mode !== 'custom') setMode(null) }} options={planOptions} />
        </Field>
      )}

      {planId === OTHER && (
        <Field label="Περιγραφή">
          <TextInput value={label} onChange={e => setLabel(e.target.value)} placeholder="π.χ. Στολή, Εξέταση ζώνης" />
        </Field>
      )}

      {group && planId && (
        <Field label="Ποσό">
          <MoneyInput value={amount} onChange={v => { setAmount(v); setAmountTouched(true) }} />
        </Field>
      )}

      {group && plan && planId !== OTHER && (
        <Field label="Μετράει από">
          <Choice value={effectiveMode} onChange={v => {
            if (v === 'custom') setCustom(period ?? { from: date, to: date })
            setMode(v)
          }} options={startOptions} />
        </Field>
      )}

      {period && effectiveMode !== 'custom' && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <CalendarRange className="text-emerald-700 shrink-0" />
          <p className="font-bold text-emerald-900">Καλύπτει {fmtDay(period.from)} – {fmtDate(period.to)}</p>
        </div>
      )}
      {effectiveMode === 'custom' && planId !== OTHER && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Καλύπτει από">
            <DateInput value={custom.from} onChange={e => {
              const from = e.target.value
              setCustom({ from, to: plan && isValidDate(from) ? coverageEnd(from, plan) : custom.to })
            }} />
          </Field>
          <Field label="έως"><DateInput value={custom.to} onChange={e => setCustom({ ...custom, to: e.target.value })} /></Field>
        </div>
      )}

      {!editing && group && planId && (
        <section className="space-y-2">
          <p className="text-sm font-semibold text-stone-700">Πληρώνει και για άλλον; <span className="font-normal text-stone-500">(π.χ. αδέρφια)</span></p>
          {extraRows.map(r => (
            <div key={r.memberId} className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-stone-200 p-3">
              <Avatar name={r.member.name} color={r.group.color} size={36} />
              <div className="flex-1 min-w-40">
                <p className="font-semibold truncate">{r.member.name}</p>
                <p className="text-sm text-stone-500">
                  {r.group.name}{r.period ? ` · ${fmtDay(r.period.from)} – ${fmtDate(r.period.to)}` : ''}
                </p>
              </div>
              <div className="w-32">
                <MoneyInput value={r.amount} onChange={v => setExtras(extras.map(x => (x.memberId === r.memberId ? { ...x, amount: v } : x)))} />
              </div>
              <IconButton icon={X} label="Αφαίρεση" onClick={() => setExtras(extras.filter(x => x.memberId !== r.memberId))} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 4).map(m => (
              <Button key={m.id} size="sm" icon={UserPlus} onClick={() => addExtra(m)}>{m.name}</Button>
            ))}
            <Button size="sm" variant="ghost" icon={UserPlus} onClick={() => setPicking(true)}>Άλλο μέλος…</Button>
          </div>
        </section>
      )}

      {group && planId && (
        <div className={cx('grid grid-cols-1 sm:grid-cols-2 gap-4')}>
          <Field label="Ημερομηνία πληρωμής" hint={date === today ? 'σήμερα' : undefined}>
            <DateInput value={date} onChange={e => setDate(e.target.value)} />
          </Field>
          <Field label="Σημείωση (προαιρετικά)">
            <TextInput value={note} onChange={e => setNote(e.target.value)} placeholder="π.χ. πλήρωσε με κάρτα" />
          </Field>
        </div>
      )}

      <ErrorNote error={error} />
    </Sheet>
  )
}

