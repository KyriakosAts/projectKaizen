import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Banknote, Pencil, Phone, Award, Receipt, GraduationCap, StickyNote, MessageCircle } from 'lucide-react'
import { useData } from '../../data/DataContext.jsx'
import { currentBelt, fmtMoney, nextBelt, planPrice } from '../../data/model.js'
import { fmtDate, fmtDay, fmtRelative } from '../../data/dates.js'
import PaymentSheet from '../PaymentSheet.jsx'
import MemberSheet from '../MemberSheet.jsx'
import PromotionSheet from '../PromotionSheet.jsx'
import ReminderSheet from '../ReminderSheet.jsx'
import { Avatar, BeltTag, Button, Card, Empty, SectionTitle, StatusPill } from '../ui.jsx'

function standingText(it) {
  if (it.state === 'ok' || it.state === 'soon') return `Πληρωμένος έως ${fmtDate(it.until)} (${fmtRelative(it.days)})`
  if (it.state === 'expired') return `Έληξε ${fmtRelative(-it.days)} (${fmtDate(it.until)})`
  if (it.state === 'unpaid') return 'Δεν έχει πληρώσει ακόμα'
  return it.until ? `Τελευταία κάλυψη έως ${fmtDate(it.until)}` : 'Δεν έχει πληρώσει ποτέ'
}

export default function MemberPage() {
  const { memberId } = useParams()
  const navigate = useNavigate()
  const { members, groups, payments, promotions, seminars, statuses } = useData()
  const member = members.find(m => m.id === memberId)
  const [sheet, setSheet] = useState(null)   // { kind, ...props }

  const myPayments = useMemo(() => payments.filter(p => p.memberId === memberId)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? '')), [payments, memberId])
  const myPromotions = useMemo(() => promotions.filter(p => p.memberId === memberId)
    .sort((a, b) => b.date.localeCompare(a.date)), [promotions, memberId])
  const mySeminars = useMemo(() => seminars.filter(s => (s.participants ?? []).some(p => p.memberId === memberId))
    .sort((a, b) => b.date.localeCompare(a.date)), [seminars, memberId])

  if (!member) {
    return <Card><Empty title="Το μέλος δεν βρέθηκε"><Link to="/members" className="underline">Πίσω στα μέλη</Link></Empty></Card>
  }

  const status = statuses.get(member.id)
  const firstGroup = groups.find(g => g.id === member.enrollments?.[0]?.groupId)
  const total = myPayments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-6">
      <Link to="/members" className="inline-flex items-center gap-1 font-semibold text-stone-600 h-10 -ml-1 pr-3 rounded-lg hover:bg-stone-200/60">
        <ChevronLeft size={20} /> Μέλη
      </Link>

      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={member.name} color={firstGroup?.color} size={64} />
          <div className="flex-1 min-w-48">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{member.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <StatusPill state={status?.overall ?? 'paused'} />
              {member.phone && (
                <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-stone-600 h-9 px-2 rounded-lg hover:bg-stone-100">
                  <Phone size={16} /> {member.phone}
                </a>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {member.phone && <Button icon={MessageCircle} onClick={() => setSheet({ kind: 'remind' })}>Υπενθύμιση</Button>}
            <Button icon={Pencil} onClick={() => setSheet({ kind: 'member' })}>Στοιχεία</Button>
            <Button variant="pay" size="lg" icon={Banknote} onClick={() => setSheet({ kind: 'pay' })}>Πληρωμή</Button>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {(status?.items ?? []).map(it => {
          const g = groups.find(x => x.id === it.groupId)
          const enrollment = member.enrollments.find(e => e.groupId === it.groupId)
          const monthly = g?.plans?.find(p => p.unit === 'month' && p.count === 1)
          const belt = currentBelt(promotions, member.id, it.groupId)
          const beltDef = g?.belts?.find(b => b.id === belt?.beltId)
          const next = g?.belts?.length ? nextBelt(g, belt?.beltId) : null
          return (
            <Card key={it.groupId} className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ background: g?.color }} />{g?.name ?? '—'}
                </h2>
                <StatusPill state={it.state} />
              </div>
              <p className="font-semibold text-stone-700">{standingText(it)}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-stone-500">Ξεκίνησε</dt><dd className="font-semibold">{fmtDate(enrollment?.since) || '—'}</dd></div>
                <div><dt className="text-stone-500">Τιμή μήνα</dt><dd className="font-semibold">
                  {monthly ? fmtMoney(planPrice(monthly, enrollment) ?? 0) : '—'}{enrollment?.price != null && ' (δική του)'}
                </dd></div>
              </dl>
              {g?.belts?.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-stone-100">
                  <span className="text-sm text-stone-500">Ζώνη</span>
                  {belt ? <BeltTag name={belt.beltName} color={beltDef?.color} /> : <span className="text-stone-500">—</span>}
                  <span className="flex-1" />
                  {next && (
                    <Button size="sm" icon={Award} onClick={() => setSheet({ kind: 'promo', groupId: it.groupId })}>
                      Προαγωγή σε {next.name}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )
        })}
        {(status?.items ?? []).length === 0 && (
          <Card className="p-5"><p className="text-stone-600">Δεν είναι σε κανένα τμήμα. Πάτα «Στοιχεία» για να το προσθέσεις.</p></Card>
        )}
      </div>

      <section>
        <SectionTitle count={myPayments.length} action={<span className="text-stone-500 font-semibold">Σύνολο {fmtMoney(total)}</span>}>Πληρωμές</SectionTitle>
        <Card className="overflow-hidden">
          {myPayments.length === 0 && <Empty icon={Receipt} title="Καμία πληρωμή ακόμα" />}
          <div className="divide-y divide-stone-100">
            {myPayments.map(p => {
              const g = groups.find(x => x.id === p.groupId)
              return (
                <button key={p.id} type="button" onClick={() => setSheet({ kind: 'pay', payment: p })}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-stone-50">
                  <span className="w-24 shrink-0 font-semibold">{fmtDate(p.date)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: g?.color }} />
                      {g?.name} · {p.label}
                    </span>
                    <span className="block text-sm text-stone-500 truncate">
                      {p.from ? `${fmtDay(p.from)} – ${fmtDate(p.to)}` : 'χωρίς διάρκεια'}{p.note ? ` · ${p.note}` : ''}
                    </span>
                  </span>
                  <span className="font-bold text-lg">{fmtMoney(p.amount)}</span>
                </button>
              )
            })}
          </div>
        </Card>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {myPromotions.length > 0 && (
          <section>
            <SectionTitle>Ιστορικό ζωνών</SectionTitle>
            <Card className="divide-y divide-stone-100 overflow-hidden">
              {myPromotions.map(p => {
                const g = groups.find(x => x.id === p.groupId)
                return (
                  <button key={p.id} type="button" onClick={() => setSheet({ kind: 'promo', promotion: p })}
                    className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-stone-50">
                    <span className="w-24 shrink-0 font-semibold">{fmtDate(p.date)}</span>
                    <BeltTag name={p.beltName} color={g?.belts?.find(b => b.id === p.beltId)?.color} />
                    <span className="text-sm text-stone-500 truncate">{g?.name}{p.note ? ` · ${p.note}` : ''}</span>
                  </button>
                )
              })}
            </Card>
          </section>
        )}

        {mySeminars.length > 0 && (
          <section>
            <SectionTitle>Σεμινάρια</SectionTitle>
            <Card className="divide-y divide-stone-100 overflow-hidden">
              {mySeminars.map(s => {
                const part = s.participants.find(p => p.memberId === member.id)
                return (
                  <button key={s.id} type="button" onClick={() => navigate(`/seminars/${s.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                    <GraduationCap size={20} className="text-stone-400" />
                    <span className="flex-1 min-w-0 font-semibold truncate">{s.title} <span className="text-stone-500 font-normal">· {fmtDate(s.date)}</span></span>
                    <StatusPill state={part?.paidOn ? 'ok' : 'expired'}>{part?.paidOn ? 'Πλήρωσε' : `Χρωστά ${fmtMoney(part?.amount)}`}</StatusPill>
                  </button>
                )
              })}
            </Card>
          </section>
        )}
      </div>

      <section>
        <SectionTitle action={<Button size="sm" variant="ghost" icon={Pencil} onClick={() => setSheet({ kind: 'member' })}>Αλλαγή</Button>}>Σημειώσεις</SectionTitle>
        <Card className="p-5">
          {member.notes
            ? <p className="whitespace-pre-line leading-relaxed">{member.notes}</p>
            : <p className="text-stone-500 flex items-center gap-2"><StickyNote size={18} /> Καμία σημείωση</p>}
        </Card>
      </section>

      {sheet?.kind === 'pay' && <PaymentSheet key={sheet.payment?.id ?? 'new'} memberId={member.id} payment={sheet.payment} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'remind' && <ReminderSheet member={member} groupId={(status?.items ?? []).find(i => i.state !== 'ok')?.groupId} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'member' && <MemberSheet member={member} onClose={() => setSheet(null)} onDeleted={() => navigate('/members')} />}
      {sheet?.kind === 'promo' && <PromotionSheet key={sheet.promotion?.id ?? sheet.groupId} member={member} groupId={sheet.groupId} promotion={sheet.promotion} onClose={() => setSheet(null)} />}
    </div>
  )
}
