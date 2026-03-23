import { useState } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, Calendar, Pencil, CheckCircle2, Plus, XCircle } from 'lucide-react'
import { format, addMonths, parse } from 'date-fns'

import { useData } from '../contexts/DataContext'
import { useMemberPayments } from '../hooks/usePayments'
import { useServices } from '../contexts/ServicesContext'
import { ServiceBadge, StatusBadge } from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Card, { CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'
import MemberModal from '../components/MemberModal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import {
  BELT_COLORS, BELT_LABELS, CATEGORY_LABELS,
  getMemberBelts, formatDate, formatCurrency, formatMonth,
  toDate, currentMonthStr,
} from '../utils/helpers'
import MemberStatsCard  from '../components/MemberStatsCard'
import MemberNotesCard  from '../components/MemberNotesCard'
import BeltHistoryCard  from '../components/BeltHistoryCard'

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={13} className="text-gray-500" />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-sm text-gray-800 font-medium">{value}</p>
      </div>
    </div>
  )
}

// ── Monthly Payment History Card ───────────────────────────────────────────────
function PaymentMonthlyCard({ member, payments, markPaymentPaid, markPaymentUnpaid, addPayment, getMemberFee, serviceFilter }) {
  const [busy, setBusy] = useState({})
  const [bulkBusy, setBulkBusy] = useState(false)
  const [selectedMonths, setSelectedMonths] = useState(() => new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const currentMonth = currentMonthStr()

  // Build month list from service start date (if filter active) or join date to today
  const joinDate = toDate(member.joinDate)
  const effectiveStartDate = serviceFilter
    ? (toDate(member.serviceDates?.[serviceFilter]) ?? joinDate)
    : joinDate
  const months = []
  if (effectiveStartDate) {
    const joinMonth = format(effectiveStartDate, 'yyyy-MM')
    let d = parse(joinMonth, 'yyyy-MM', new Date())
    while (format(d, 'yyyy-MM') <= currentMonth) {
      months.push(format(d, 'yyyy-MM'))
      d = addMonths(d, 1)
    }
    months.reverse()
  }

  const unpaidMonths = months.filter(m => {
    const p = payments.find(x => x.month === m)
    return !p || p.status !== 'paid'
  })

  function toggleMonth(month) {
    setSelectedMonths(prev => {
      const next = new Set(prev)
      if (next.has(month)) next.delete(month); else next.add(month)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedMonths(prev =>
      prev.size === unpaidMonths.length ? new Set() : new Set(unpaidMonths)
    )
  }

  const monthsToPay = selectedMonths.size > 0 ? Array.from(selectedMonths) : unpaidMonths
  const totalToPay = monthsToPay.reduce((sum, month) => {
    const p = payments.find(x => x.month === month)
    return sum + (p ? p.amount : getMemberFee(member) || 0)
  }, 0)

  async function handleBulkPayConfirmed() {
    setConfirmOpen(false)
    setBulkBusy(true)
    try {
      for (const month of monthsToPay) {
        const p = payments.find(x => x.month === month)
        if (!p) {
          await addPayment({
            memberId: member.id,
            month,
            amount: getMemberFee(member) || 0,
            status: 'paid',
            paidAt: new Date().toISOString(),
          })
        } else if (p.status !== 'paid') {
          await markPaymentPaid(p.id)
        }
      }
      setSelectedMonths(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleAction(month, payment) {
    setBusy(b => ({ ...b, [month]: true }))
    try {
      if (!payment) {
        await addPayment({
          memberId: member.id,
          month,
          amount: getMemberFee(member) || 0,
          status: 'paid',
          paidAt: new Date().toISOString(),
        })
      } else if (payment.status !== 'paid') {
        await markPaymentPaid(payment.id)
      } else {
        await markPaymentUnpaid(payment.id)
      }
    } finally {
      setBusy(b => ({ ...b, [month]: false }))
    }
  }

  function getPaymentFor(p) {
    if (!p?.note) return null
    if (p.note.includes('(event)')) return p.note.replace(' (event)', '')
    return p.note
  }

  if (months.length === 0) {
    return (
      <Card padding={false} className="lg:col-span-2">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Payment History</h3>
        </div>
        <p className="px-5 py-8 text-center text-sm text-gray-400">No join date set — cannot compute payment months.</p>
      </Card>
    )
  }

  return (
    <Card padding={false} className="lg:col-span-2">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">Payment History</h3>
          <p className="text-xs text-gray-400 mt-0.5">All months since joining</p>
        </div>
        {unpaidMonths.length > 0 && (
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={bulkBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <CheckCircle2 size={12} />
            {bulkBusy ? 'Processing…'
              : selectedMonths.size > 0
                ? `Pay Selected (${selectedMonths.size})`
                : `Pay All Unpaid (${unpaidMonths.length})`}
          </button>
        )}
        <span className="text-xs text-gray-400">{months.length} months</span>
      </div>

      {/* Confirmation overlay */}
      {confirmOpen && (
        <div className="mx-4 my-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-semibold text-amber-800 mb-1">
            Confirm payment for {monthsToPay.length} month{monthsToPay.length !== 1 ? 's' : ''} · {formatCurrency(totalToPay)}
          </p>
          <p className="text-xs text-amber-600 mb-2">
            {selectedMonths.size > 0
              ? monthsToPay.map(m => formatMonth(m)).join(', ')
              : 'All unpaid months'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleBulkPayConfirmed}
              className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              Confirm &amp; Pay
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
            <tr>
              <th className="px-3 py-2.5 text-left w-8">
                {unpaidMonths.length > 0 && (
                  <input
                    type="checkbox"
                    checked={selectedMonths.size === unpaidMonths.length && unpaidMonths.length > 0}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded border-gray-300 accent-emerald-600 cursor-pointer"
                    title="Select all unpaid"
                  />
                )}
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Month</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">For</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Amount</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Paid On</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {months.map(month => {
              const p = payments.find(x => x.month === month)
              const status = p?.status ?? 'unpaid'
              const isBusy = !!busy[month]
              const fee = getMemberFee(member) || 0
              const isSelected = selectedMonths.has(month)
              const forLabel = getPaymentFor(p)
              const isEvent = p?.note?.includes('(event)')
              return (
                <tr key={month} className={`hover:bg-gray-50/60 transition-colors ${status === 'paid' ? '' : isSelected ? 'bg-emerald-50/40' : 'bg-red-50/20'}`}>
                  <td className="px-3 py-2.5">
                    {status !== 'paid' && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMonth(month)}
                        className="w-3.5 h-3.5 rounded border-gray-300 accent-emerald-600 cursor-pointer"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">{formatMonth(month)}</td>
                  <td className="px-3 py-2.5">
                    {forLabel ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md ${
                        isEvent ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isEvent && '★ '}{forLabel}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Monthly Fee</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {p ? formatCurrency(p.amount) : (
                      <span className="text-gray-400">{formatCurrency(fee)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {p ? (
                      <StatusBadge status={p.status} />
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                        <XCircle size={10} /> unpaid
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 hidden sm:table-cell">
                    {p?.paidAt ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-emerald-500" />
                        {formatDate(p.paidAt)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {status === 'paid' ? (
                      <button
                        onClick={() => handleAction(month, p)}
                        disabled={isBusy}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                      >
                        {isBusy ? '…' : 'Undo'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(month, p)}
                        disabled={isBusy}
                        className="flex items-center gap-1 ml-auto px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {isBusy ? '…' : <><CheckCircle2 size={11} /> {p ? 'Mark Paid' : 'Log & Pay'}</>}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function MemberProfile() {
  const { memberId } = useParams()
  const navigate = useNavigate()
  const { members, loading, updateMember, beltHistory, addBeltPromotion, memberNotes, addMemberNote, deleteMemberNote, markPaymentPaid, markPaymentUnpaid, addPayment, attendance } = useData()
  const { payments, stats } = useMemberPayments(memberId)
  const { getMemberFee, getService, services } = useServices()

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false)
  const { activeCategory } = useOutletContext() ?? {}

  const member = members.find(m => m.id === memberId)

  if (loading) return <PageLoader />

  if (!member) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400 mb-4">Member not found.</p>
        <Button variant="secondary" onClick={() => navigate('/members')}>
          <ArrowLeft size={13} /> Back to Members
        </Button>
      </div>
    )
  }

  const belts = getMemberBelts(member, services)

  async function handleSave(data) {
    await updateMember(member.id, data)
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft size={13} /> Back
      </button>

      {/* Header card */}
      <Card>
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar name={member.name} size="xl" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{member.name}</h1>
              <StatusBadge status={member.status} />
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {(member.categories ?? []).map(c => (
                <ServiceBadge key={c} serviceId={c} />
              ))}
            </div>

            {/* Multi-belt display */}
            {belts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {belts.map(({ category, belt }) => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-gray-300"
                      style={{ background: BELT_COLORS[belt] }}
                    />
                    {CATEGORY_LABELS[category]}: {BELT_LABELS[belt]}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400 mt-2">
              Member since {formatDate(member.joinDate)}
            </p>
          </div>

          {/* Edit button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowEdit(true)}
          >
            <Pencil size={12} /> Edit
          </Button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-400 mt-0.5">Months tracked</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.paidCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Months paid</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-600">{formatCurrency(stats.revenue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total collected</p>
          </div>
        </div>

        {/* Effective monthly fee */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Monthly Fee</p>
            <p className="text-base font-bold text-gray-900">{formatCurrency(getMemberFee(member))}</p>
          </div>
          {member.customFee != null && member.customFee > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-lg">
              Custom rate
            </span>
          )}
          {!(member.customFee != null && member.customFee > 0) && (
            <span className="text-xs text-gray-400">
              {(member.categories ?? []).map(c => getService(c)?.name).join(' + ')}
            </span>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Contact info */}
        <Card className="lg:col-span-1">
          <CardHeader title="Contact Info" />
          <InfoRow icon={Phone}    label="Phone"     value={member.phone} />
          <InfoRow icon={Mail}     label="Email"     value={member.email} />
          <InfoRow icon={Calendar} label="Join Date" value={formatDate(member.joinDate)} />
        </Card>

        {/* Monthly Payment History */}
        <PaymentMonthlyCard
          member={member}
          payments={payments}
          markPaymentPaid={markPaymentPaid}
          markPaymentUnpaid={markPaymentUnpaid}
          addPayment={addPayment}
          getMemberFee={getMemberFee}
          serviceFilter={activeCategory}
        />
      </div>

      {/* Stats card */}
      <MemberStatsCard
        member={member}
        payments={payments}
        attendance={attendance}
        services={services}
        beltHistory={beltHistory}
        serviceFilter={activeCategory}
      />

      {/* Notes timeline card */}
      <MemberNotesCard
        member={member}
        memberNotes={memberNotes}
        addMemberNote={addMemberNote}
        deleteMemberNote={deleteMemberNote}
        attendance={attendance}
        services={services}
      />

      {/* Belt Promotion History card */}
      <BeltHistoryCard
        member={member}
        beltHistory={beltHistory}
        addBeltPromotion={addBeltPromotion}
        services={services}
        attendance={attendance}
        externalServiceFilter={activeCategory}
      />

      {/* Edit modal */}
      {showEdit && (
        <MemberModal
          member={member}
          onClose={() => setShowEdit(false)}
          onSave={handleSave}
          addBeltPromotion={addBeltPromotion}
          existingBeltHistory={beltHistory}
        />
      )}
    </div>
  )
}
