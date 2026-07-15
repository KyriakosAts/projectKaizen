import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { subMonths, addMonths, format, parse, differenceInMonths, eachMonthOfInterval, startOfMonth } from 'date-fns'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
  ResponsiveContainer,
} from 'recharts'
import {
  Users, AlertCircle, TrendingUp, UserPlus, ArrowRight, Plus, Layers,
  Clock, Zap, CheckCircle2, X, Check,
} from 'lucide-react'

import { useData }     from '../contexts/DataContext'
import { useServices } from '../contexts/ServicesContext'
import { useTheme, ACCENT_PALETTES } from '../contexts/ThemeContext'
import StatCard from '../components/ui/StatCard'
import Card, { CardHeader } from '../components/ui/Card'
import { StatusBadge, ServiceBadge } from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import MemberModal from '../components/MemberModal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import {
  formatCurrency, formatMonth, currentMonthStr, toDate,
  CATEGORY_LABELS, CATEGORY_COLORS, CATEGORIES,
} from '../utils/helpers'
// CATEGORIES kept for the Members-by-Sport pie chart (built-in sports only)

// ── Pending payment row with inline Mark Paid ──────────────────────────────────
function PendingRow({ payment, member, onMarkPaid, onCreateAndPay, showMonth }) {
  const [busy, setBusy] = useState(false)
  const isVirtual = payment.id?.startsWith('virtual_')
  async function handle() {
    setBusy(true)
    try {
      if (isVirtual) await onCreateAndPay(member, payment.month)
      else await onMarkPaid(payment.id)
    } finally { setBusy(false) }
  }
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50/60 transition-colors">
      <Avatar name={member.name} size="sm" />
      <div className="flex-1 min-w-0">
        <Link to={`/members/${member.id}`} className="text-sm font-medium text-gray-900 hover:text-primary-600 truncate block">
          {member.name}
        </Link>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {showMonth && (
            <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {formatMonth(payment.month)}
            </span>
          )}
          {(member.categories ?? []).map(c => <ServiceBadge key={c} serviceId={c} />)}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <StatusBadge status={payment.status} />
          <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(payment.amount)}</p>
        </div>
        <button
          onClick={handle}
          disabled={busy}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-50"
        >
          {busy ? '…' : <><CheckCircle2 size={11} /> {isVirtual ? 'Log & Pay' : 'Pay'}</>}
        </button>
      </div>
    </div>
  )
}

// ── Bulk Pay Modal ─────────────────────────────────────────────────────────────
function BulkPayModal({ unpaidRows, onMarkPaid, onCreateAndPay, onClose, label }) {
  const { services } = useServices()
  const [selected, setSelected] = useState(() => new Set(unpaidRows.map(r => r.payment.id)))
  const [processing, setProcessing] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [confirmStep, setConfirmStep] = useState(false)
  const [bulkError, setBulkError] = useState('')

  function toggleRow(paymentId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(paymentId)) next.delete(paymentId)
      else next.add(paymentId)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === unpaidRows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(unpaidRows.map(r => r.payment.id)))
    }
  }

  const selectedRows = unpaidRows.filter(r => selected.has(r.payment.id))
  const totalAmount = selectedRows.reduce((s, r) => s + (r.payment.amount ?? 0), 0)

  async function handleSubmit() {
    if (selectedRows.length === 0) return
    if (!confirmStep) { setConfirmStep(true); return }
    setProcessing(true)
    setCompleted(0)
    setConfirmStep(false)
    setBulkError('')
    let done = 0
    try {
      for (const row of selectedRows) {
        if (row.payment.id?.startsWith('virtual_')) {
          await onCreateAndPay(row.member, row.payment.month)
        } else {
          await onMarkPaid(row.payment.id)
        }
        done++
        setCompleted(c => c + 1)
      }
      onClose()
    } catch (err) {
      setBulkError(
        `Stopped after ${done} of ${selectedRows.length}: ${typeof err === 'string' ? err : err.message ?? 'Unknown error'}. ` +
        'Payments already marked stay marked — reselect the rest and retry.'
      )
    } finally {
      setProcessing(false)
    }
  }

  const progress = processing ? Math.round((completed / selectedRows.length) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Bulk Payment — {label}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{unpaidRows.length} unpaid members</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={processing}
          >
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
          {/* Select all */}
          <div
            className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={toggleAll}
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              selected.size === unpaidRows.length ? 'bg-primary-500 border-primary-500' : 'border-gray-300'
            }`}>
              {selected.size === unpaidRows.length && <CheckCircle2 size={10} className="text-white" />}
            </div>
            <span className="text-xs font-semibold text-gray-600">Select all</span>
          </div>

          {unpaidRows.map(({ payment, member }) => {
            const isSelected = selected.has(payment.id)
            return (
              <div
                key={payment.id}
                className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${isSelected ? 'bg-primary-50/40' : ''}`}
                onClick={() => toggleRow(payment.id)}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? 'bg-primary-500 border-primary-500' : 'border-gray-300'
                }`}>
                  {isSelected && <CheckCircle2 size={10} className="text-white" />}
                </div>
                <Avatar name={member.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{member.name}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {(member.categories ?? []).map(cat => {
                      const svc = services.find(s => s.id === cat)
                      return (
                        <span
                          key={cat}
                          className="text-xs px-1.5 py-px rounded-md font-medium bg-gray-100 text-gray-600"
                        >
                          {svc?.name ?? cat}
                        </span>
                      )
                    })}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-gray-900">{formatCurrency(payment.amount)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                    payment.status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress bar (shown while processing) */}
        {processing && (
          <div className="px-5 py-2 border-t border-gray-100 bg-gray-50">
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-primary-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">{completed} / {selectedRows.length} processed</p>
          </div>
        )}

        {/* Error banner */}
        {bulkError && (
          <div className="px-5 py-2.5 border-t border-red-100 bg-red-50">
            <p className="text-xs text-red-700">{bulkError}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50">
          <div>
            {confirmStep ? (
              <p className="text-xs font-semibold text-amber-700">
                Pay {selected.size} member{selected.size !== 1 ? 's' : ''} · {formatCurrency(totalAmount)}?
              </p>
            ) : (
              <p className="text-xs font-medium text-gray-600">
                {selected.size} member{selected.size !== 1 ? 's' : ''} selected
                {selected.size > 0 && <span className="text-gray-900 font-bold"> · {formatCurrency(totalAmount)}</span>}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {confirmStep ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setConfirmStep(false)} disabled={processing}>
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  loading={processing}
                  disabled={selected.size === 0}
                >
                  <CheckCircle2 size={12} /> Confirm &amp; Pay
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={onClose} disabled={processing}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  loading={processing}
                  disabled={selected.size === 0}
                >
                  <Zap size={12} /> Mark {selected.size} Paid
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label, prefix = '' }) => {
  if (!active || !payload?.length) return null
  const isDark = document.documentElement.classList.contains('dark')
  return (
    <div className={`rounded-xl shadow-lg px-3 py-2 text-xs border ${
      isDark
        ? 'bg-gray-800 border-gray-700 text-gray-200'
        : 'bg-white border-gray-200 text-gray-700'
    }`}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: {prefix}{p.value}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { members, payments, loading, addMember, markPaymentPaid, addPayment } = useData()
  const { activeCategory } = useOutletContext() ?? {}
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkPay,  setShowBulkPay]  = useState(false)
  const [dashRange,    setDashRange]    = useState('6mo')  // '6mo' | '1yr' | 'all'
  const [revenueFilter, setRevenueFilter] = useState('all') // 'all' | 'regular' | 'events'

  const { accent } = useTheme()
  const accentHex = ACCENT_PALETTES[accent]?.hex ?? '#f97316'

  // Must be declared before useMemos that reference getMemberFee
  const { services, getMemberFee } = useServices()

  const currentMonth = currentMonthStr()
  const today = new Date()

  // Filter members by global sport filter
  const filteredMembers = useMemo(() =>
    activeCategory
      ? members.filter(m => (m.categories ?? []).includes(activeCategory))
      : members,
    [members, activeCategory]
  )

  const stats = useMemo(() => {
    const activeMembers = filteredMembers.filter(m => m.status === 'active')
    const memberIds = new Set(activeMembers.map(m => m.id))
    const monthPayments = payments.filter(p => p.month === currentMonth && memberIds.has(p.memberId))
    const unpaid = monthPayments.filter(p => p.status !== 'paid')

    const newThisMonth = filteredMembers.filter(m => {
      const d = toDate(m.joinDate)
      return d && format(d, 'yyyy-MM') === currentMonth
    })

    return {
      totalActive: activeMembers.length,
      unpaidCount: unpaid.length,
      newCount:    newThisMonth.length,
    }
  }, [filteredMembers, payments, currentMonth])

  // Revenue bar chart — driven by dashRange
  const revenueData = useMemo(() => {
    let monthList
    if (dashRange === 'all') {
      const allPaid = payments.filter(p => p.status === 'paid')
      const earliest = allPaid.reduce((min, p) => p.month < min ? p.month : min, currentMonth)
      const startDate = startOfMonth(parse(earliest, 'yyyy-MM', new Date()))
      monthList = eachMonthOfInterval({ start: startDate, end: new Date() }).map(d => format(d, 'yyyy-MM'))
    } else {
      const count = dashRange === '1yr' ? 12 : 6
      monthList = Array.from({ length: count }, (_, i) => format(subMonths(new Date(), count - 1 - i), 'yyyy-MM'))
    }
    return monthList.map(month => {
      let paid = payments.filter(p => p.month === month && p.status === 'paid')
      if (revenueFilter === 'events')  paid = paid.filter(p => p.note?.includes('(event)'))
      if (revenueFilter === 'regular') paid = paid.filter(p => !p.note?.includes('(event)'))
      const rev = paid.reduce((s, p) => s + (p.amount ?? 0), 0)
      return {
        month: format(parse(month, 'yyyy-MM', new Date()), monthList.length > 12 ? 'MMM yy' : dashRange === '1yr' ? 'MMM yy' : 'MMM'),
        revenue: rev,
      }
    })
  }, [payments, revenueFilter, dashRange, currentMonth])

  // Member growth line chart — driven by dashRange
  const growthData = useMemo(() => {
    let monthList
    if (dashRange === 'all') {
      const earliest = filteredMembers.reduce((min, m) => {
        const d = toDate(m.joinDate)
        if (!d) return min
        const s = format(d, 'yyyy-MM')
        return s < min ? s : min
      }, currentMonth)
      const startDate = startOfMonth(parse(earliest, 'yyyy-MM', new Date()))
      monthList = eachMonthOfInterval({ start: startDate, end: new Date() }).map(d => format(d, 'yyyy-MM'))
    } else {
      const count = dashRange === '1yr' ? 12 : 6
      monthList = Array.from({ length: count }, (_, i) => format(subMonths(new Date(), count - 1 - i), 'yyyy-MM'))
    }
    return monthList.map(month => {
      const cnt = filteredMembers.filter(m => {
        const d = toDate(m.joinDate)
        return d && format(d, 'yyyy-MM') <= month
      }).length
      return {
        month: format(parse(month, 'yyyy-MM', new Date()), monthList.length > 12 ? 'MMM yy' : dashRange === '1yr' ? 'MMM yy' : 'MMM'),
        members: cnt,
      }
    })
  }, [filteredMembers, dashRange, currentMonth])

  // Pie chart: members per category
  const categoryData = useMemo(() => {
    const active = members.filter(m => m.status === 'active')
    return CATEGORIES
      .map(cat => ({
        name:  CATEGORY_LABELS[cat],
        value: active.filter(m => (m.categories ?? []).includes(cat)).length,
        color: CATEGORY_COLORS[cat].dot,
        cat,
      }))
      .filter(d => d.value > 0)
  }, [members])

  // Pending payments — month mode (6mo/1yr) shows current month; all-time shows all unpaid
  const recentUnpaid = useMemo(() => {
    const activeMembers = filteredMembers.filter(m => m.status === 'active')

    if (dashRange !== 'all') {
      const activeIds = new Set(activeMembers.map(m => m.id))
      return payments
        .filter(p => p.status !== 'paid' && activeIds.has(p.memberId) && p.month === currentMonth)
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 8)
        .map(p => ({ payment: p, member: members.find(m => m.id === p.memberId) }))
        .filter(x => x.member)
    }

    // All time: generate an implied unpaid entry for every month since each member's join date
    const result = []
    for (const member of activeMembers) {
      const joinDate = toDate(member.joinDate)
      if (!joinDate) continue
      const joinMonth = format(joinDate, 'yyyy-MM')
      let d = parse(joinMonth, 'yyyy-MM', new Date())
      while (format(d, 'yyyy-MM') <= currentMonth) {
        const monthStr = format(d, 'yyyy-MM')
        const payment = payments.find(p => p.memberId === member.id && p.month === monthStr)
        if (!payment || payment.status !== 'paid') {
          result.push({
            payment: payment ?? {
              id: `virtual_${member.id}_${monthStr}`,
              memberId: member.id,
              month: monthStr,
              amount: getMemberFee(member) || 0,
              status: 'unpaid',
            },
            member,
          })
        }
        d = addMonths(d, 1)
      }
    }

    return result
      .sort((a, b) => b.payment.month.localeCompare(a.payment.month))
      .slice(0, 50)
  }, [payments, filteredMembers, members, currentMonth, dashRange, getMemberFee])


  // Per-sport revenue — range driven by dashRange
  const sportRevData = useMemo(() => {
    let rangeMonths
    if (dashRange === 'all') {
      rangeMonths = null // null = all time, no month filter
    } else {
      const count = dashRange === '1yr' ? 12 : 6
      const set = new Set(Array.from({ length: count }, (_, i) => format(subMonths(new Date(), count - 1 - i), 'yyyy-MM')))
      rangeMonths = set
    }
    return services.filter(s => s.active).map(svc => {
      const catMembers   = members.filter(m => (m.categories ?? []).includes(svc.id))
      const exclusiveIds = new Set(catMembers.filter(m => (m.categories ?? []).length === 1).map(m => m.id))
      const sharedIds    = new Set(catMembers.filter(m => (m.categories ?? []).length > 1).map(m => m.id))
      const allCatIds    = new Set(catMembers.map(m => m.id))
      const rangePayments = payments.filter(p =>
        p.status === 'paid' &&
        allCatIds.has(p.memberId) &&
        (rangeMonths === null || rangeMonths.has(p.month))
      )
      const exclusiveRev = rangePayments.filter(p => exclusiveIds.has(p.memberId)).reduce((s, p) => s + (p.amount ?? 0), 0)
      const sharedRev    = rangePayments.filter(p => sharedIds.has(p.memberId)).reduce((s, p) => s + (p.amount ?? 0), 0)
      return {
        id:          svc.id,
        name:        svc.name,
        color:       svc.color,
        revenue:     exclusiveRev + sharedRev,
        exclusiveRev,
        sharedRev,
        paidCount:   rangePayments.length,
      }
    })
  }, [services, members, payments, dashRange])

  // Retention analytics
  const retentionData = useMemo(() => {
    const activeMembers = members.filter(m => m.status === 'active')
    const tenures = activeMembers.map(m => {
      const joined = toDate(m.joinDate)
      if (!joined) return 0
      return Math.max(0, differenceInMonths(today, joined))
    })

    const avgTenure = tenures.length > 0
      ? Math.round(tenures.reduce((s, t) => s + t, 0) / tenures.length)
      : 0

    // Churn risk: active members with 2+ unpaid months in last 3 months
    const last3Months = Array.from({ length: 3 }, (_, i) =>
      format(subMonths(new Date(), i + 1), 'yyyy-MM')
    )
    const churnRisk = activeMembers.filter(member => {
      const joinMonth = (() => { const d = toDate(member.joinDate); return d ? format(d, 'yyyy-MM') : null })()
      const unpaidCount = last3Months.filter(month => {
        if (joinMonth && month < joinMonth) return false
        const p = payments.find(p => p.memberId === member.id && p.month === month)
        return !p || p.status !== 'paid'
      }).length
      return unpaidCount >= 2
    }).length

    // Tenure buckets
    const buckets = [
      { label: '0-6mo',  min: 0,   max: 6 },
      { label: '6-12mo', min: 6,   max: 12 },
      { label: '1-2yr',  min: 12,  max: 24 },
      { label: '2-3yr',  min: 24,  max: 36 },
      { label: '3yr+',   min: 36,  max: Infinity },
    ]
    const bucketData = buckets.map(b => ({
      label: b.label,
      count: tenures.filter(t => t >= b.min && t < b.max).length,
    }))

    return { avgTenure, churnRisk, bucketData }
  }, [members, payments, today])

  // All unpaid rows for BulkPayModal — month mode (6mo/1yr) or all-time
  const allUnpaidRows = useMemo(() => {
    const activeMembers = filteredMembers.filter(m => m.status === 'active')
    if (dashRange !== 'all') {
      const activeIds = new Set(activeMembers.map(m => m.id))
      return payments
        .filter(p => p.month === currentMonth && p.status !== 'paid' && activeIds.has(p.memberId))
        .map(p => ({ payment: p, member: members.find(m => m.id === p.memberId) }))
        .filter(x => x.member)
    }
    // All-time: generate virtual entries for every unpaid month since each member's join date
    const result = []
    for (const member of activeMembers) {
      const joinDate = toDate(member.joinDate)
      if (!joinDate) continue
      const joinMonth = format(joinDate, 'yyyy-MM')
      let d = parse(joinMonth, 'yyyy-MM', new Date())
      while (format(d, 'yyyy-MM') <= currentMonth) {
        const monthStr = format(d, 'yyyy-MM')
        const payment = payments.find(p => p.memberId === member.id && p.month === monthStr)
        if (!payment || payment.status !== 'paid') {
          result.push({
            payment: payment ?? {
              id: `virtual_${member.id}_${monthStr}`,
              memberId: member.id,
              month: monthStr,
              amount: getMemberFee(member) || 0,
              status: 'unpaid',
            },
            member,
          })
        }
        d = addMonths(d, 1)
      }
    }
    return result.sort((a, b) => b.payment.month.localeCompare(a.payment.month))
  }, [payments, filteredMembers, members, currentMonth, dashRange, getMemberFee])

  async function handleCreateAndPay(member, month) {
    const amount = getMemberFee(member) || 0
    await addPayment({
      memberId: member.id,
      month,
      amount,
      status:   'paid',
      paidAt:   new Date().toISOString(),
    })
  }

  if (loading) return <PageLoader />

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Stat cards + action cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Active Members"
          value={stats.totalActive}
          sub={activeCategory ? CATEGORY_LABELS[activeCategory] : 'All sports'}
          icon={Users}
          iconBg="bg-primary-50"
          iconColor="text-primary-600"
        />
        <div className="relative">
          <StatCard
            label="Unpaid This Month"
            value={stats.unpaidCount}
            sub={formatMonth(currentMonth)}
            icon={AlertCircle}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            valueColor={stats.unpaidCount > 0 ? 'text-red-600' : 'text-gray-900'}
          />
          {stats.unpaidCount > 0 && (
            <div className="absolute bottom-3 right-4">
              <button
                onClick={() => setShowBulkPay(true)}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                <Zap size={11} /> Bulk Pay
              </button>
            </div>
          )}
        </div>
        {/* Add Member */}
        <div
          className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl p-5 flex items-center justify-between shadow-lg shadow-primary-200/50 cursor-pointer hover:from-primary-700 hover:to-primary-800 transition-all"
          onClick={() => setShowAddModal(true)}
        >
          <div>
            <p className="text-xl font-bold text-white">Add Member</p>
            <p className="text-xs text-primary-200 mt-0.5">Register a new athlete</p>
          </div>
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <UserPlus size={20} className="text-white" />
          </div>
        </div>
        {/* Add Service */}
        <Link
          to="/services"
          className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl p-5 flex items-center justify-between shadow-lg cursor-pointer hover:from-slate-800 hover:to-slate-900 transition-all"
        >
          <div>
            <p className="text-xl font-bold text-white">Services</p>
            <p className="text-xs text-slate-400 mt-0.5">Manage &amp; configure</p>
          </div>
          <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Layers size={20} className="text-white" />
          </div>
        </Link>
      </div>

      {/* ── Global range selector ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</span>
        <div className="flex items-center bg-gray-100 rounded-xl p-0.5 gap-0.5">
          {[{ v: '6mo', l: '6 Months' }, { v: '1yr', l: '1 Year' }, { v: 'all', l: 'All Time' }].map(o => (
            <button
              key={o.v}
              onClick={() => setDashRange(o.v)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                dashRange === o.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Member Growth */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Member Growth"
            subtitle={dashRange === 'all' ? 'All time — cumulative enrollments' : `Cumulative enrollments (last ${dashRange === '1yr' ? '12' : '6'} months)`}
          />
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="members"
                name="Members"
                stroke={accentHex}
                strokeWidth={2.5}
                dot={{ r: 4, fill: accentHex, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie chart: members by sport */}
        <Card>
          <CardHeader title="Members by Sport" subtitle="Active members distribution" />
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [value, name]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ fontSize: 11, color: '#64748b' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts row 2: Revenue */}
      <Card>
        <CardHeader
          title="Revenue Trend"
          subtitle={dashRange === 'all' ? 'All time — collected' : `Collected payments — last ${dashRange === '1yr' ? '12' : '6'} months`}
          action={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Type filter — All / Regular / Events */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                {[
                  { v: 'all',     l: 'All' },
                  { v: 'regular', l: 'Regular' },
                  { v: 'events',  l: 'Events' },
                ].map(o => (
                  <button
                    key={o.v}
                    onClick={() => setRevenueFilter(o.v)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      revenueFilter === o.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
              <Link to="/payments" className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
                Full report <ArrowRight size={11} />
              </Link>
            </div>
          }
        />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={revenueData} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
            <Tooltip content={<CustomTooltip prefix="€" />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
            <Bar dataKey="revenue" name="Revenue" fill={accentHex} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Revenue by Sport — dynamic, with exclusive/shared breakdown */}
      <Card>
        <CardHeader title="Revenue by Sport" subtitle={dashRange === 'all' ? 'All time — collected' : dashRange === '1yr' ? 'Last 12 months — collected' : `Last 6 months — collected`} />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {sportRevData.map(s => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50"
            >
              <div className="w-2 h-10 rounded-full shrink-0" style={{ background: s.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500">{s.name}</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(s.revenue)}</p>
                <p className="text-xs text-gray-400">{s.paidCount} paid</p>
                {s.sharedRev > 0 && (
                  <div className="flex gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-gray-400" title="Revenue from single-service members only">
                      excl. {formatCurrency(s.exclusiveRev)}
                    </span>
                    <span className="text-[10px] text-amber-500" title="Revenue from members enrolled in 2+ services (counted in each of their services)">
                      · shared {formatCurrency(s.sharedRev)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {sportRevData.some(s => s.sharedRev > 0) && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <span className="text-amber-500 text-sm mt-0.5">ℹ</span>
            <p className="text-xs text-amber-700">
              <span className="font-semibold">Multi-service members</span> have their payment counted in each enrolled service ("shared" amount above). The numbers per service include this shared revenue.
            </p>
          </div>
        )}
      </Card>

      {/* Member Retention */}
      <Card>
        <CardHeader title="Member Retention" subtitle="Tenure and churn risk analysis" />
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="p-4 bg-emerald-50 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Avg Tenure</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{retentionData.avgTenure} <span className="text-sm font-medium">months</span></p>
            <p className="text-xs text-emerald-600 mt-0.5">active members</p>
          </div>
          <div className="p-4 bg-red-50 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={14} className="text-red-500" />
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Churn Risk</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{retentionData.churnRisk} <span className="text-sm font-medium">members</span></p>
            <p className="text-xs text-red-500 mt-0.5">2+ unpaid months</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Members by Tenure</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={retentionData.bucketData} barSize={36} margin={{ top: 20, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
                formatter={v => [v, 'Members']}
              />
              <Bar dataKey="count" name="Members" fill={accentHex} radius={[5, 5, 0, 0]}>
                <LabelList
                  dataKey="count"
                  position="top"
                  style={{ fontSize: 14, fontWeight: 700, fill: '#334155' }}
                  formatter={v => v > 0 ? v : ''}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Pending payments */}
      <Card padding={false}>
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Pending Payments</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {dashRange === 'all' ? 'All time — all unpaid' : formatMonth(currentMonth)}
            </p>
          </div>

          {allUnpaidRows.length > 0 && (
            <button
              onClick={() => setShowBulkPay(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-100 hover:bg-primary-200 rounded-lg transition-colors"
            >
              <Zap size={12} /> Bulk Pay ({allUnpaidRows.length})
            </button>
          )}
          <Link
            to="/payments"
            className="text-xs font-medium text-gray-500 hover:text-primary-600 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {recentUnpaid.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400 font-medium">
              {dashRange !== 'all' ? 'All payments collected this month!' : 'No pending payments!'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentUnpaid.map(({ payment, member }) => (
              <PendingRow
                key={payment.id}
                payment={payment}
                member={member}
                onMarkPaid={markPaymentPaid}
                onCreateAndPay={handleCreateAndPay}
                showMonth={dashRange === 'all'}
              />
            ))}
          </div>
        )}

      </Card>

      {/* Add Member Modal */}
      {showAddModal && (
        <MemberModal
          member={null}
          onClose={() => setShowAddModal(false)}
          onSave={addMember}
        />
      )}

      {/* Bulk Pay Modal */}
      {showBulkPay && (
        <BulkPayModal
          unpaidRows={allUnpaidRows}
          onMarkPaid={markPaymentPaid}
          onCreateAndPay={handleCreateAndPay}
          onClose={() => setShowBulkPay(false)}
          label={dashRange !== 'all' ? formatMonth(currentMonth) : 'All Time'}
        />
      )}
    </div>
  )
}
