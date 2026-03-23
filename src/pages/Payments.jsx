import { useState, useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, TrendingUp,
  Percent, Printer, Zap, X, Check,
} from 'lucide-react'
import { subMonths, addMonths, parse, format, getYear, eachMonthOfInterval, startOfMonth } from 'date-fns'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

import { useData }     from '../contexts/DataContext'
import { useServices } from '../contexts/ServicesContext'
import { usePayments } from '../hooks/usePayments'
import { ServiceBadge, StatusBadge } from '../components/ui/Badge'
import Button           from '../components/ui/Button'
import Card, { CardHeader } from '../components/ui/Card'
import Avatar           from '../components/ui/Avatar'
import { PageLoader }   from '../components/ui/LoadingSpinner'
import {
  formatMonth, formatCurrency, formatDate, currentMonthStr, toDate,
} from '../utils/helpers'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Print Preview Modal ────────────────────────────────────────────────────────
function PrintPreviewModal({ rows, allTimeMode, currentMonth, services, onClose }) {
  function doPrint() {
    const content = document.getElementById('print-preview-content')
    const win = window.open('', '_blank', 'width=900,height=700')
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payments — ${allTimeMode ? 'All Time' : formatMonth(currentMonth)}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
            h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
            .subtitle { font-size: 11px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
            td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
            tr:last-child td { border-bottom: none; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
            .paid { background: #d1fae5; color: #065f46; }
            .unpaid { background: #fee2e2; color: #991b1b; }
            .stats { display: flex; gap: 24px; margin-bottom: 20px; padding: 12px 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
            .stat-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
            .stat-value { font-size: 16px; font-weight: bold; color: #111; margin-top: 2px; }
            @media print { body { padding: 12px; } }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const paid    = rows.filter(r => r.payment?.status === 'paid').length
  const unpaid  = rows.filter(r => r.payment?.status === 'unpaid').length
  const revenue = rows.filter(r => r.payment?.status === 'paid').reduce((s, r) => s + Number(r.payment.amount ?? 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Print Preview</h2>
            <p className="text-xs text-gray-400 mt-0.5">{allTimeMode ? 'All Time' : formatMonth(currentMonth)} · {rows.length} members</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={doPrint} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors">
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable preview */}
        <div className="overflow-y-auto flex-1 p-6">
          <div id="print-preview-content" className="bg-white">
            {/* Print title */}
            <h1 className="text-xl font-bold text-gray-900">
              Dojo Patras — Payments
            </h1>
            <p className="text-xs text-gray-400 mb-5">
              {allTimeMode ? 'All Time' : formatMonth(currentMonth)} · Generated {new Date().toLocaleDateString()}
            </p>

            {/* Stats summary */}
            <div className="flex gap-6 mb-5 p-3 bg-gray-50 rounded-xl border border-gray-100">
              {[
                { label: 'Revenue',  value: formatCurrency(revenue) },
                { label: 'Paid',     value: paid },
                { label: 'Unpaid',   value: unpaid },
                { label: 'Rate',     value: `${rows.length ? Math.round((paid / rows.length) * 100) : 0}%` },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">{s.label}</p>
                  <p className="text-lg font-bold text-gray-900">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                  {allTimeMode && <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Month</th>}
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Paid On</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const { member, payment } = row
                  const rowMonth = payment?.month ?? row.impliedMonth
                  const isPaid = payment?.status === 'paid'
                  return (
                    <tr key={`${member.id}_${rowMonth}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900">{member.name}</td>
                      {allTimeMode && <td className="px-3 py-2 text-gray-500">{formatMonth(rowMonth)}</td>}
                      <td className="px-3 py-2 font-semibold text-gray-700">{payment ? formatCurrency(payment.amount) : '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {payment?.status ?? 'No record'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-400">{payment?.paidAt ? formatDate(payment.paidAt) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Month picker popover ─────────────────────────────────────────────────────────
function MonthPickerPopover({ value, onChange, onClose }) {
  const todayYear = new Date().getFullYear()
  const todayMonth = currentMonthStr()
  const [pickerYear, setPickerYear] = useState(() => parseInt(value.slice(0, 4), 10))

  function select(month) {
    if (month > todayMonth) return
    onChange(month)
    onClose()
  }

  return (
    <div
      className="absolute left-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4"
      style={{ minWidth: 240 }}
      onClick={e => e.stopPropagation()}
    >
      {/* Year navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setPickerYear(y => Math.max(2020, y - 1))}
          disabled={pickerYear <= 2020}
          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-bold text-gray-900">{pickerYear}</span>
        <button
          onClick={() => setPickerYear(y => Math.min(todayYear, y + 1))}
          disabled={pickerYear >= todayYear}
          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      {/* Month grid */}
      <div className="grid grid-cols-4 gap-1">
        {MONTH_NAMES.map((name, idx) => {
          const monthStr = `${pickerYear}-${String(idx + 1).padStart(2, '0')}`
          const isSelected = monthStr === value
          const isFuture = monthStr > todayMonth
          const isToday = monthStr === todayMonth
          return (
            <button
              key={name}
              disabled={isFuture}
              onClick={() => select(monthStr)}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-primary-600 text-white shadow-sm'
                  : isFuture
                    ? 'text-gray-300 cursor-default'
                    : isToday
                      ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-300'
                      : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Month navigator ─────────────────────────────────────────────────────────────
function MonthNav({ value, onChange, allTimeMode, onToggleAllTime, revenueRange, onRangeChange }) {
  const [showPicker, setShowPicker] = useState(false)
  const parsed = parse(value, 'yyyy-MM', new Date())
  const isCurrentMonth = value === currentMonthStr()

  // Which segment is active
  const activeKey = allTimeMode ? 'all' : revenueRange ?? null

  const SEGMENTS = [
    { key: null,   label: 'Monthly'   },
    { key: '6mo',  label: '6 Months'  },
    { key: '1yr',  label: '1 Year'    },
    { key: 'all',  label: 'All Time'  },
  ]

  function handleSegment(key) {
    if (key === 'all') {
      if (!allTimeMode) onToggleAllTime()
      onRangeChange(null)
    } else {
      if (allTimeMode) onToggleAllTime()
      onRangeChange(key) // null = monthly, '6mo', '1yr'
    }
  }

  const isMonthly = !allTimeMode && !revenueRange

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Left section — fixed width so the layout never shifts */}
      <div className="flex items-center" style={{ minWidth: '13rem' }}>
        {/* Prev arrow — invisible (not hidden) when not in monthly mode to hold space */}
        <button
          onClick={() => onChange(format(subMonths(parsed, 1), 'yyyy-MM'))}
          className={`w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors ${isMonthly ? '' : 'invisible'}`}
          tabIndex={isMonthly ? 0 : -1}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Label area */}
        <div className="flex-1 text-center relative">
          {isMonthly ? (
            /* Clickable month label with popover */
            <>
              <button
                onClick={() => setShowPicker(p => !p)}
                className="text-base font-bold text-gray-900 w-full px-1 py-1.5 rounded-xl hover:bg-gray-100 transition-all cursor-pointer"
              >
                {formatMonth(value)}
              </button>
              {showPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
                  <MonthPickerPopover
                    value={value}
                    onChange={onChange}
                    onClose={() => setShowPicker(false)}
                  />
                </>
              )}
            </>
          ) : (
            /* Range / all-time label */
            <span className="text-base font-bold text-gray-900 px-1 py-1.5">
              {allTimeMode ? 'All Time' : revenueRange === '1yr' ? 'Last 12 Months' : 'Last 6 Months'}
            </span>
          )}
        </div>

        {/* Next arrow — invisible when not in monthly mode */}
        <button
          onClick={() => {
            const next = format(addMonths(parsed, 1), 'yyyy-MM')
            if (next <= currentMonthStr()) onChange(next)
          }}
          disabled={isCurrentMonth}
          className={`w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 ${isMonthly ? '' : 'invisible'}`}
          tabIndex={isMonthly ? 0 : -1}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-gray-200" />

      {/* Single segmented control — 4 options, fixed total width */}
      <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
        {SEGMENTS.map(seg => (
          <button
            key={String(seg.key)}
            onClick={() => handleSegment(seg.key)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeKey === seg.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {seg.label}
          </button>
        ))}
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
        <p key={i} style={{ color: p.fill || p.stroke || p.color }}>
          {p.name}: {prefix}{p.value}
        </p>
      ))}
    </div>
  )
}

// ── Bulk pay modal ──────────────────────────────────────────────────────────────
function BulkPayModal({ rows, onMarkPaid, onCreateAndPay, onClose, currentMonth, allTimeMode }) {
  const { services, getMemberFee } = useServices()
  // Include null-payment rows (all-time mode virtual entries) as unpaid
  const unpaidRows = rows
    .filter(r => !r.payment || r.payment.status !== 'paid')
    .map(r => ({
      ...r,
      _id: r.payment?.id ?? `virtual_${r.member.id}_${r.impliedMonth}`,
      _isVirtual: !r.payment,
    }))
  const [selected, setSelected] = useState(() => new Set(unpaidRows.map(r => r._id)))
  const [processing, setProcessing] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [confirmStep, setConfirmStep] = useState(false)

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(selected.size === unpaidRows.length
      ? new Set()
      : new Set(unpaidRows.map(r => r._id)))
  }

  const selectedRows = unpaidRows.filter(r => selected.has(r._id))
  const totalAmount  = selectedRows.reduce((s, r) => s + (r.payment?.amount ?? getMemberFee(r.member) ?? 0), 0)
  const progress     = processing && selectedRows.length > 0
    ? Math.round((completed / selectedRows.length) * 100) : 0

  async function handleSubmit() {
    if (selectedRows.length === 0) return
    if (!confirmStep) { setConfirmStep(true); return }
    setProcessing(true); setCompleted(0); setConfirmStep(false)
    for (const row of selectedRows) {
      if (row._isVirtual) {
        await onCreateAndPay(row.member, row.impliedMonth)
      } else {
        await onMarkPaid(row.payment.id)
      }
      setCompleted(c => c + 1)
    }
    setProcessing(false); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center">
                <Zap size={15} className="text-primary-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">Bulk Payment</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 ml-10">
              {allTimeMode ? 'All time' : formatMonth(currentMonth)} · {unpaidRows.length} unpaid record{unpaidRows.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} disabled={processing} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <X size={16} />
          </button>
        </div>

        {/* Select all row */}
        <div
          className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50/80 transition-colors select-none"
          onClick={toggleAll}
        >
          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
            selected.size === unpaidRows.length && unpaidRows.length > 0
              ? 'bg-primary-500 border-primary-500'
              : 'border-gray-300'
          }`}>
            {selected.size === unpaidRows.length && unpaidRows.length > 0 && (
              <Check size={11} className="text-white" strokeWidth={3} />
            )}
          </div>
          <span className="text-xs font-semibold text-gray-600">
            Select all ({unpaidRows.length})
          </span>
          {selected.size > 0 && selected.size < unpaidRows.length && (
            <span className="text-xs text-gray-400 ml-auto">{selected.size} selected</span>
          )}
        </div>

        {/* Member list */}
        <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
          {unpaidRows.map((row) => {
            const { payment, member, _id, _isVirtual, impliedMonth } = row
            const isSelected = selected.has(_id)
            const amount = payment?.amount ?? 0
            const status = payment?.status ?? 'unpaid'
            const displayMonth = payment?.month ?? impliedMonth
            return (
              <div
                key={_id}
                className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors border-b border-gray-50 last:border-b-0 ${
                  isSelected ? 'bg-primary-50/50 hover:bg-primary-50' : 'hover:bg-gray-50/80'
                }`}
                onClick={() => toggle(_id)}
              >
                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? 'bg-primary-500 border-primary-500' : 'border-gray-200'
                }`}>
                  {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
                <Avatar name={member.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{member.name}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {allTimeMode && displayMonth && (
                      <span className="text-[10px] px-1.5 py-px rounded font-medium bg-gray-100 text-gray-500">
                        {formatMonth(displayMonth)}
                      </span>
                    )}
                    {(member.categories ?? []).map(c => {
                      const svc = services.find(s => s.id === c)
                      return (
                        <span
                          key={c}
                          className="text-[10px] px-1.5 py-px rounded font-medium bg-gray-100 text-gray-600"
                          style={svc ? { backgroundColor: svc.color + '20', color: svc.color } : {}}
                        >
                          {svc?.name ?? c}
                        </span>
                      )
                    })}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">
                    {formatCurrency(_isVirtual ? (getMemberFee(member) ?? 0) : amount)}
                  </p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {_isVirtual ? 'unpaid' : status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        {processing && (
          <div className="px-5 py-2.5 bg-primary-50 border-t border-primary-100">
            <div className="w-full bg-primary-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-primary-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-primary-600 mt-1 text-center font-medium">
              Processing {completed} / {selectedRows.length}…
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/60">
          <div>
            {confirmStep ? (
              <p className="text-xs font-semibold text-amber-700">
                Pay {selected.size} record{selected.size !== 1 ? 's' : ''} · {formatCurrency(totalAmount)}?
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  {selected.size} record{selected.size !== 1 ? 's' : ''} selected
                </p>
                {selected.size > 0 && (
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(totalAmount)}</p>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            {confirmStep ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setConfirmStep(false)} disabled={processing}>Back</Button>
                <Button size="sm" onClick={handleSubmit} loading={processing} disabled={selected.size === 0} className="min-w-[120px]">
                  <CheckCircle2 size={12} /> Confirm &amp; Pay
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={onClose} disabled={processing}>Cancel</Button>
                <Button size="sm" onClick={handleSubmit} loading={processing} disabled={selected.size === 0} className="min-w-[120px]">
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

// ── Main page ────────────────────────────────────────────────────────────────────
export default function Payments() {
  const [currentMonth, setCurrentMonth] = useState(currentMonthStr)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading2,      setLoading2]      = useState({})
  const [showBulkPay,   setShowBulkPay]   = useState(false)
  const [showPrintPrev, setShowPrintPrev] = useState(false)
  const [allTimeMode,   setAllTimeMode]   = useState(false)
  const [revenueFilter, setRevenueFilter] = useState('all')
  const [revenueRange,  setRevenueRange]  = useState('6mo')
  const { activeCategory, memberSearch = '' } = useOutletContext() ?? {}

  const { members, payments, loading, markPaymentPaid, markPaymentUnpaid, addPayment } = useData()
  const { services, getMemberFee } = useServices()
  const { allMonthPayments, stats } = usePayments(currentMonth, '')

  const filteredMembers = useMemo(() =>
    activeCategory
      ? members.filter(m => (m.categories ?? []).includes(activeCategory))
      : members,
    [members, activeCategory]
  )

  const rows = useMemo(() => {
    if (allTimeMode) {
      // All-time: generate an implied row for every month from each member's join date to today
      const result = []
      for (const member of filteredMembers) {
        const joinDate = toDate(member.joinDate)
        if (!joinDate) {
          // No join date: only show existing records
          payments.filter(p => p.memberId === member.id).forEach(p => {
            if (!statusFilter || p.status === statusFilter)
              result.push({ member, payment: p, impliedMonth: p.month })
          })
          continue
        }
        const joinMonth = format(joinDate, 'yyyy-MM')
        let d = parse(joinMonth, 'yyyy-MM', new Date())
        while (format(d, 'yyyy-MM') <= currentMonth) {
          const monthStr = format(d, 'yyyy-MM')
          const payment = payments.find(p => p.memberId === member.id && p.month === monthStr)
          const effectiveStatus = payment?.status ?? 'unpaid'
          if (!statusFilter || effectiveStatus === statusFilter)
            result.push({ member, payment: payment ?? null, impliedMonth: monthStr })
          d = addMonths(d, 1)
        }
      }
      return result.sort((a, b) => {
        const aM = a.payment?.month ?? a.impliedMonth
        const bM = b.payment?.month ?? b.impliedMonth
        return bM.localeCompare(aM) || a.member.name.localeCompare(b.member.name)
      })
    }
    const active = filteredMembers.filter(m => m.status === 'active')
    return active
      .map(member => ({
        member,
        payment: allMonthPayments.find(p => p.memberId === member.id) ?? null,
        impliedMonth: currentMonth,
      }))
      .filter(({ payment }) => !statusFilter || payment?.status === statusFilter)
      .sort((a, b) => {
        const ord = { unpaid: 0, late: 1, paid: 2 }
        return (ord[a.payment?.status] ?? 3) - (ord[b.payment?.status] ?? 3) ||
               a.member.name.localeCompare(b.member.name)
      })
  }, [filteredMembers, allMonthPayments, statusFilter, allTimeMode, payments, currentMonth])

  // Apply member name search on top of rows
  const filteredRows = useMemo(() =>
    memberSearch.trim()
      ? rows.filter(r => r.member.name.toLowerCase().includes(memberSearch.toLowerCase()))
      : rows,
    [rows, memberSearch]
  )

  // Revenue trend — all-time when allTimeMode, otherwise 6 or 12 months
  const revenueData = useMemo(() => {
    let monthList
    if (allTimeMode) {
      const allPaid = payments.filter(p => p.status === 'paid')
      const earliest = allPaid.reduce((min, p) => p.month < min ? p.month : min, currentMonth)
      const startDate = startOfMonth(parse(earliest, 'yyyy-MM', new Date()))
      monthList = eachMonthOfInterval({ start: startDate, end: new Date() }).map(d => format(d, 'yyyy-MM'))
    } else if (revenueRange) {
      const count = revenueRange === '1yr' ? 12 : 6
      monthList = Array.from({ length: count }, (_, i) => format(subMonths(new Date(), count - 1 - i), 'yyyy-MM'))
    } else {
      // Single month mode — show only the selected month
      monthList = [currentMonth]
    }
    return monthList.map(month => {
      let paid = payments.filter(p => p.month === month && p.status === 'paid')
      if (activeCategory) paid = paid.filter(p => {
        const m = members.find(x => x.id === p.memberId)
        return m && (m.categories ?? []).includes(activeCategory)
      })
      if (revenueFilter === 'events')  paid = paid.filter(p => p.note?.includes('(event)'))
      if (revenueFilter === 'regular') paid = paid.filter(p => !p.note?.includes('(event)'))
      const rev = paid.reduce((s, p) => s + (p.amount ?? 0), 0)
      return { month: format(parse(month, 'yyyy-MM', new Date()), monthList.length > 12 ? 'MMM yy' : revenueRange === '1yr' ? 'MMM yy' : 'MMM'), revenue: rev }
    })
  }, [payments, members, activeCategory, revenueFilter, revenueRange, allTimeMode, currentMonth])

  // Paid vs unpaid donut — use filteredRows so it reflects search
  const pieData = useMemo(() => [
    { name: 'Paid',   value: filteredRows.filter(r => r.payment?.status === 'paid').length,   color: '#22c55e' },
    { name: 'Unpaid', value: filteredRows.filter(r => r.payment?.status === 'unpaid').length, color: '#ef4444' },
    { name: 'Late',   value: filteredRows.filter(r => r.payment?.status === 'late').length,   color: '#f59e0b' },
  ].filter(d => d.value > 0), [filteredRows])

  // Months set for the selected range (null = all time, single month when no range)
  const rangeMonthsSet = useMemo(() => {
    if (allTimeMode) return null
    if (!revenueRange) return new Set([currentMonth])
    const count = revenueRange === '1yr' ? 12 : 6
    return new Set(Array.from({ length: count }, (_, i) =>
      format(subMonths(new Date(), count - 1 - i), 'yyyy-MM')
    ))
  }, [allTimeMode, revenueRange, currentMonth])

  // Revenue by sport — respects allTimeMode and 6M/1Y range
  const sportRevData = useMemo(() =>
    services.filter(s => s.active).map(svc => {
      const catMembers     = members.filter(m => (m.categories ?? []).includes(svc.id))
      const exclusiveIds   = new Set(catMembers.filter(m => (m.categories ?? []).length === 1).map(m => m.id))
      const sharedIds      = new Set(catMembers.filter(m => (m.categories ?? []).length > 1).map(m => m.id))
      const allCatIds      = new Set(catMembers.map(m => m.id))
      const sourcePayments = payments.filter(p =>
        p.status === 'paid' &&
        allCatIds.has(p.memberId) &&
        (rangeMonthsSet === null || rangeMonthsSet.has(p.month))
      )
      const exclusiveRev   = sourcePayments.filter(p => exclusiveIds.has(p.memberId)).reduce((s, p) => s + (p.amount ?? 0), 0)
      const sharedRev      = sourcePayments.filter(p => sharedIds.has(p.memberId)).reduce((s, p) => s + (p.amount ?? 0), 0)
      const revenue        = exclusiveRev + sharedRev
      return { sport: svc.name, revenue, exclusiveRev, sharedRev, color: svc.color, id: svc.id }
    }),
    [services, members, payments, rangeMonthsSet]
  )

  // Pie chart data — respects 6M/1Y range (not when allTimeMode)
  const rangePieData = useMemo(() => {
    if (allTimeMode) return null // allTimeMode uses filteredRows-based pieData
    const memberIds = new Set(filteredMembers.map(m => m.id))
    const rangePays = payments.filter(p =>
      memberIds.has(p.memberId) &&
      (rangeMonthsSet === null || rangeMonthsSet.has(p.month))
    )
    return [
      { name: 'Paid',   value: rangePays.filter(p => p.status === 'paid').length,   color: '#22c55e' },
      { name: 'Unpaid', value: rangePays.filter(p => p.status !== 'paid').length, color: '#ef4444' },
    ].filter(d => d.value > 0)
  }, [allTimeMode, payments, filteredMembers, rangeMonthsSet])

  const collectionRate = filteredRows.length > 0
    ? Math.round((filteredRows.filter(r => r.payment?.status === 'paid').length / filteredRows.length) * 100)
    : 0

  async function handleMarkPaid(paymentId) {
    setLoading2(p => ({ ...p, [paymentId]: true }))
    try { await markPaymentPaid(paymentId) }
    finally { setLoading2(p => ({ ...p, [paymentId]: false })) }
  }
  async function handleMarkUnpaid(paymentId) {
    setLoading2(p => ({ ...p, [paymentId]: true }))
    try { await markPaymentUnpaid(paymentId) }
    finally { setLoading2(p => ({ ...p, [paymentId]: false })) }
  }

  // Create a payment record (at the member's fee) and immediately mark it paid
  async function handleCreateAndPay(member, month = currentMonth) {
    const key = `new_${member.id}_${month}`
    setLoading2(p => ({ ...p, [key]: true }))
    try {
      const amount = getMemberFee(member) || 0
      const id = await addPayment({
        memberId: member.id,
        month,
        amount,
        status:   'paid',
        paidAt:   new Date().toISOString(),
      })
      // addPayment already sets status='paid', nothing more to do
      void id
    } finally {
      setLoading2(p => ({ ...p, [key]: false }))
    }
  }

  const displayRevenue = filteredRows.filter(r => r.payment?.status === 'paid').reduce((s, r) => s + (r.payment?.amount ?? 0), 0)
  const displayPaid    = filteredRows.filter(r => r.payment?.status === 'paid').length
  const displayUnpaid  = filteredRows.filter(r => !r.payment || r.payment.status !== 'paid').length

  if (loading) return <PageLoader />

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Month nav + status filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <MonthNav
          value={currentMonth}
          onChange={m => { setCurrentMonth(m); setAllTimeMode(false); setRevenueRange(null) }}
          allTimeMode={allTimeMode}
          onToggleAllTime={() => setAllTimeMode(p => !p)}
          revenueRange={allTimeMode ? null : revenueRange}
          onRangeChange={v => { setRevenueRange(v); if (v) setAllTimeMode(false) }}
        />
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-0.5">
          {[
            { v: '',       l: 'All' },
            { v: 'paid',   l: 'Paid' },
            { v: 'unpaid', l: 'Unpaid' },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => setStatusFilter(o.v)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === o.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <p className="text-xs text-gray-400">
          {filteredRows.length}{filteredRows.length !== rows.length ? ` / ${rows.length}` : ''} members
        </p>
        <button
          onClick={() => setShowPrintPrev(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Printer size={13} /> Print Preview
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: TrendingUp, bg: 'bg-primary-50', iconClass: 'text-primary-600', label: 'Revenue', value: formatCurrency(displayRevenue), sub: allTimeMode ? 'all time' : formatMonth(currentMonth) },
          { icon: CheckCircle2, bg: 'bg-emerald-50', iconClass: 'text-emerald-600', label: 'Paid', value: displayPaid, sub: 'members' },
          { icon: XCircle, bg: 'bg-red-50', iconClass: 'text-red-500', label: 'Unpaid', value: displayUnpaid, sub: 'members', valueClass: displayUnpaid > 0 ? 'text-red-600' : 'text-gray-900' },
          { icon: Percent, bg: 'bg-amber-50', iconClass: 'text-amber-600', label: 'Rate', value: `${collectionRate}%`, sub: 'collection rate', valueClass: collectionRate >= 80 ? 'text-emerald-600' : collectionRate >= 50 ? 'text-amber-600' : 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 ${card.bg} rounded-lg flex items-center justify-center`}>
                <card.icon size={14} className={card.iconClass} />
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{card.label}</p>
            </div>
            <p className={`text-2xl font-bold ${card.valueClass ?? 'text-gray-900'}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue Trend"
            subtitle={allTimeMode ? 'All time (collected)' : revenueRange ? `Last ${revenueRange === '1yr' ? '12' : '6'} months (collected)` : `${formatMonth(currentMonth)} (collected)`}
            action={
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* View mode indicator pill */}
                <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {allTimeMode ? 'All Time' : revenueRange === '1yr' ? 'Last 12M' : revenueRange === '6mo' ? 'Last 6M' : formatMonth(currentMonth)}
                </span>
                <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                  {['all', 'regular', 'events'].map(f => (
                    <button
                      key={f}
                      onClick={() => setRevenueFilter(f)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all capitalize ${
                        revenueFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            }
          />
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={revenueData} barSize={30}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
              <Tooltip content={<CustomTooltip prefix="€" />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="revenue" name="Revenue" fill="#ea580c" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <CardHeader
            title={allTimeMode ? 'All Time' : revenueRange === '1yr' ? 'Last 12 Months' : revenueRange === '6mo' ? 'Last 6 Months' : formatMonth(currentMonth)}
            subtitle={allTimeMode ? 'All payments' : revenueRange === '1yr' ? 'Last 12 months' : revenueRange === '6mo' ? 'Last 6 months' : formatMonth(currentMonth)}
          />
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              {(() => { const d = rangePieData ?? pieData; return (
                <Pie data={d} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {d.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              )})()}

              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: document.documentElement.classList.contains('dark') ? '1px solid #374151' : '1px solid #e2e8f0',
                  fontSize: 12,
                  backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
                  color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#111827',
                }}
              />
              <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Revenue by sport — dynamic with exclusive/shared breakdown */}
      <Card>
        <CardHeader title="Revenue by Sport" subtitle={allTimeMode ? 'All time — collected' : revenueRange === '1yr' ? 'Last 12 months — collected' : revenueRange === '6mo' ? 'Last 6 months — collected' : `${formatMonth(currentMonth)} — collected`} />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {sportRevData.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
              <div className="w-2 h-10 rounded-full shrink-0" style={{ background: s.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500">{s.sport}</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(s.revenue)}</p>
                {s.sharedRev > 0 && (
                  <div className="flex gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-gray-400" title="Revenue from single-service members">
                      excl. {formatCurrency(s.exclusiveRev)}
                    </span>
                    <span className="text-[10px] text-amber-500" title="Revenue from members enrolled in multiple services (also counted in their other services)">
                      · shared {formatCurrency(s.sharedRev)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Multi-service bundle note */}
        {sportRevData.some(s => s.sharedRev > 0) && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <span className="text-amber-500 text-sm mt-0.5">ℹ</span>
            <p className="text-xs text-amber-700">
              <span className="font-semibold">Multi-service members:</span> members enrolled in 2+ services have their payment counted in each service ("shared" amount). Total collected is{' '}
              <span className="font-bold">{formatCurrency(sportRevData.reduce((s, d) => s + d.exclusiveRev, 0) + (() => {
                const msMembers = members.filter(m => (m.categories ?? []).length > 1)
                const msIds = new Set(msMembers.map(m => m.id))
                return payments.filter(p => p.status === 'paid' && msIds.has(p.memberId) && (rangeMonthsSet === null || rangeMonthsSet.has(p.month))).reduce((s, p) => s + (p.amount ?? 0), 0)
              })())}</span>.
            </p>
          </div>
        )}
      </Card>

      {/* Payment table */}
      <Card padding={false}>
        {/* Table header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900">Member Payments</h3>
          <div className="flex items-center gap-2 ml-auto">
            {filteredRows.some(r => !r.payment || r.payment.status !== 'paid') && (
              <button
                onClick={() => setShowBulkPay(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-100 hover:bg-primary-200 rounded-lg transition-colors"
              >
                <Zap size={12} /> Bulk Pay
              </button>
            )}
            <p className="text-xs text-gray-400">
              {filteredRows.length}{filteredRows.length !== rows.length ? ` / ${rows.length}` : ''} records
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                {allTimeMode && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Month</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sports</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Paid On</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                  {memberSearch ? `No members matching "${memberSearch}"` : 'No records'}
                </td></tr>
              ) : filteredRows.map((row) => {
                const { member, payment } = row
                const rowMonth = payment?.month ?? row.impliedMonth
                return (
                  <tr key={`${member.id}_${rowMonth}`} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={member.name} size="sm" />
                        <Link
                          to={`/members/${member.id}`}
                          className="font-semibold text-gray-900 hover:text-primary-600 transition-colors"
                        >
                          {member.name}
                        </Link>
                      </div>
                    </td>
                    {allTimeMode && (
                      <td className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                        {formatMonth(rowMonth)}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(member.categories ?? []).map(c => <ServiceBadge key={c} serviceId={c} />)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">
                      {payment ? formatCurrency(payment.amount) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {payment ? <StatusBadge status={payment.status} /> : <span className="text-xs text-gray-300">No record</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell">
                      {payment?.paidAt ? formatDate(payment.paidAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right no-print">
                      {payment ? (
                        payment.status !== 'paid' ? (
                          <Button size="xs" variant="success" loading={loading2[payment.id]} onClick={() => handleMarkPaid(payment.id)}>
                            <CheckCircle2 size={11} /> Mark Paid
                          </Button>
                        ) : (
                          <Button size="xs" variant="ghost" loading={loading2[payment.id]} onClick={() => handleMarkUnpaid(payment.id)}>
                            Undo
                          </Button>
                        )
                      ) : (
                        <Button
                          size="xs"
                          variant="success"
                          loading={loading2[`new_${member.id}_${rowMonth}`]}
                          onClick={() => handleCreateAndPay(member, rowMonth)}
                          title={`Create payment record (${getMemberFee(member)}€) and mark as paid`}
                        >
                          <CheckCircle2 size={11} /> Log & Pay
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {showBulkPay && (
        <BulkPayModal
          rows={rows}
          onMarkPaid={markPaymentPaid}
          onCreateAndPay={handleCreateAndPay}
          onClose={() => setShowBulkPay(false)}
          currentMonth={currentMonth}
          allTimeMode={allTimeMode}
        />
      )}

      {showPrintPrev && (
        <PrintPreviewModal
          rows={filteredRows}
          allTimeMode={allTimeMode}
          currentMonth={currentMonth}
          services={services}
          onClose={() => setShowPrintPrev(false)}
        />
      )}
    </div>
  )
}
