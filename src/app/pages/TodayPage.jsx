import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banknote, PartyPopper, GraduationCap, ChevronRight, UserPlus, MessageCircle } from 'lucide-react'
import { useData } from '../../data/DataContext.jsx'
import { attentionList, byName, fmtMoney, matchesSearch, openSeminars, seminarTotals } from '../../data/model.js'
import { fmtDate, fmtDay, fmtRelative, fmtWeekday } from '../../data/dates.js'
import PaymentSheet from '../PaymentSheet.jsx'
import MemberSheet from '../MemberSheet.jsx'
import ReminderSheet from '../ReminderSheet.jsx'
import { Avatar, Button, Card, Empty, GroupTag, IconButton, SearchBox, SectionTitle, StatusPill, STATUS_STYLE, cx } from '../ui.jsx'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Καλημέρα'
  if (h < 18) return 'Καλησπέρα'
  return 'Καλό βράδυ'
}

function whenText(row) {
  if (row.state === 'expired') return `Έληξε ${fmtRelative(-row.days)} · ${fmtDate(row.until)}`
  if (row.state === 'soon') return row.days === 0 ? `Λήγει σήμερα · ${fmtDate(row.until)}` : `Λήγει ${fmtRelative(row.days)} · ${fmtDate(row.until)}`
  if (row.state === 'unpaid') return row.days === 0 ? 'Γράφτηκε σήμερα' : `Γράφτηκε ${fmtRelative(-row.days)}`
  return ''
}

function AttentionRow({ row, group, onPay, onRemind }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cx('w-1.5 self-stretch rounded-full', STATUS_STYLE[row.state].bar)} />
      <button type="button" onClick={() => navigate(`/members/${row.member.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <Avatar name={row.member.name} color={group?.color} />
        <span className="min-w-0">
          <span className="block font-bold text-lg leading-tight truncate">{row.member.name}</span>
          <span className="flex flex-wrap items-center gap-x-3 text-stone-500">
            <GroupTag group={group} className="text-stone-500" />
            <span>{whenText(row)}</span>
          </span>
        </span>
      </button>
      {row.member.phone && <IconButton icon={MessageCircle} label="Υπενθύμιση" onClick={onRemind} className="hidden sm:inline-flex" />}
      <Button variant="pay" icon={Banknote} onClick={onPay}>Πληρωμή</Button>
    </div>
  )
}

const FIRST_ROWS = 8

function AttentionSection({ title, rows, groups, onPay, onRemind }) {
  const [all, setAll] = useState(false)
  if (rows.length === 0) return null
  const shown = all ? rows : rows.slice(0, FIRST_ROWS)
  return (
    <section>
      <SectionTitle count={rows.length}>{title}</SectionTitle>
      <Card className="divide-y divide-stone-100 overflow-hidden">
        {shown.map(r => (
          <AttentionRow key={`${r.member.id}|${r.groupId}`} row={r} group={groups.find(g => g.id === r.groupId)}
            onPay={() => onPay({ memberId: r.member.id, groupId: r.groupId })}
            onRemind={() => onRemind({ member: r.member, groupId: r.groupId })} />
        ))}
        {rows.length > FIRST_ROWS && (
          <button type="button" onClick={() => setAll(!all)} className="w-full h-14 font-semibold text-stone-600 hover:bg-stone-50">
            {all ? 'Λιγότεροι' : `Δείξε όλους (${rows.length})`}
          </button>
        )}
      </Card>
    </section>
  )
}

export default function TodayPage() {
  const { members, payments, seminars, groups, settings, statuses, today } = useData()
  const [q, setQ] = useState('')
  const [pay, setPay] = useState(null)        // { memberId, groupId } | { payment }
  const [adding, setAdding] = useState(false)
  const [remind, setRemind] = useState(null)   // { member, groupId }
  const navigate = useNavigate()

  const lists = useMemo(() => attentionList(members, payments, settings, today), [members, payments, settings, today])
  const todays = useMemo(() => payments.filter(p => p.date === today).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')), [payments, today])
  const todayTotal = todays.reduce((s, p) => s + p.amount, 0)
  const open = useMemo(() => openSeminars(seminars).slice(0, 3), [seminars])
  const results = useMemo(() => (q.trim() ? members.filter(m => matchesSearch(m, q)).sort(byName).slice(0, 30) : []), [members, q])
  const memberName = (id) => members.find(m => m.id === id)?.name ?? '—'
  const nothingToDo = lists.expired.length + lists.soon.length + lists.unpaid.length === 0

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-stone-500 font-medium">{fmtWeekday(today)}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">{greeting()}</h1>
        </div>
        <div className="flex gap-3">
          <div className="text-right">
            <p className="text-sm text-stone-500">Εισπράξεις σήμερα</p>
            <p className="text-2xl font-extrabold">{fmtMoney(todayTotal)}</p>
          </div>
        </div>
      </header>

      <div className="space-y-3">
        <SearchBox big value={q} onChange={setQ} placeholder="Βρες μέλος — γράψε όνομα ή τηλέφωνο" />
        {q.trim() && (
          <Card className="divide-y divide-stone-100 overflow-hidden">
            {results.length === 0 && (
              <div className="p-5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-stone-500">Δεν βρέθηκε «{q}».</span>
                <Button icon={UserPlus} onClick={() => setAdding(true)}>Νέο μέλος</Button>
              </div>
            )}
            {results.map(m => {
              const st = statuses.get(m.id)
              const g = groups.find(x => x.id === m.enrollments?.[0]?.groupId)
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => navigate(`/members/${m.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <Avatar name={m.name} color={g?.color} />
                    <span className="min-w-0">
                      <span className="block font-bold text-lg truncate">{m.name}</span>
                      <span className="text-stone-500">{(m.enrollments ?? []).map(e => groups.find(x => x.id === e.groupId)?.name).filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                  <StatusPill state={st?.overall ?? 'paused'} className="hidden sm:inline-flex" />
                  <Button variant="pay" icon={Banknote} onClick={() => setPay({ memberId: m.id })}>Πληρωμή</Button>
                </div>
              )
            })}
          </Card>
        )}
      </div>

      {!q.trim() && (
        <>
          {nothingToDo && (
            <Card><Empty icon={PartyPopper} title="Όλοι είναι ενήμεροι">Καμία συνδρομή δεν έληξε και καμία δεν λήγει τις επόμενες {settings.warnDays} μέρες.</Empty></Card>
          )}
          <AttentionSection title="Έληξαν" rows={lists.expired} groups={groups} onPay={setPay} onRemind={setRemind} />
          <AttentionSection title={`Λήγουν (${settings.warnDays} μέρες)`} rows={lists.soon} groups={groups} onPay={setPay} onRemind={setRemind} />
          <AttentionSection title="Νέα μέλη χωρίς πληρωμή" rows={lists.unpaid} groups={groups} onPay={setPay} onRemind={setRemind} />

          {open.length > 0 && (
            <section>
              <SectionTitle action={<Link to="/seminars" className="font-semibold text-stone-600 px-2 py-2">Όλα</Link>}>Σεμινάρια με εκκρεμότητες</SectionTitle>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {open.map(s => {
                  const t = seminarTotals(s)
                  return (
                    <Link key={s.id} to={`/seminars/${s.id}`}>
                      <Card className="p-4 hover:border-stone-300 h-full">
                        <div className="flex items-start gap-3">
                          <GraduationCap className="text-stone-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate">{s.title}</p>
                            <p className="text-sm text-stone-500">{fmtDate(s.date)}</p>
                          </div>
                          <ChevronRight className="text-stone-300" />
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-stone-100 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${t.count ? (t.paidCount / t.count) * 100 : 0}%` }} />
                        </div>
                        <p className="mt-2 text-sm font-semibold text-stone-600">{t.paidCount}/{t.count} πλήρωσαν · μένουν {fmtMoney(t.outstanding)}</p>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {todays.length > 0 && (
            <section>
              <SectionTitle count={todays.length}>Πληρωμές σήμερα</SectionTitle>
              <Card className="divide-y divide-stone-100 overflow-hidden">
                {todays.map(p => {
                  const g = groups.find(x => x.id === p.groupId)
                  return (
                    <button key={p.id} type="button" onClick={() => setPay({ payment: p })}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold truncate">{memberName(p.memberId)}</span>
                        <span className="text-sm text-stone-500">
                          {g?.name} · {p.label}{p.from ? ` · έως ${fmtDay(p.to)}` : ''}
                        </span>
                      </span>
                      <span className="font-bold text-lg">{fmtMoney(p.amount)}</span>
                    </button>
                  )
                })}
              </Card>
              <p className="text-sm text-stone-500 mt-2 px-1">Πάτα μια πληρωμή για να τη διορθώσεις ή να τη σβήσεις.</p>
            </section>
          )}
        </>
      )}

      {pay && <PaymentSheet key={pay.payment?.id ?? `${pay.memberId}|${pay.groupId}`} {...pay} onClose={() => setPay(null)} />}
      {remind && <ReminderSheet key={remind.member.id} {...remind} onClose={() => setRemind(null)} />}
      {adding && <MemberSheet initialName={q.trim()} onClose={() => setAdding(false)} onSaved={m => { setQ(''); navigate(`/members/${m.id}`) }} />}
    </div>
  )
}
