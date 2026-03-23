import { useMemo, useState, useRef, useEffect } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  format, parse, startOfWeek, addWeeks, subWeeks, eachDayOfInterval, addDays,
  isToday, isFuture, startOfMonth, endOfMonth, addMonths, subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, CalendarDays, BarChart2 } from 'lucide-react'

import { useData }      from '../contexts/DataContext'
import { useServices }  from '../contexts/ServicesContext'
import { useSchedule }  from '../contexts/ScheduleContext'
import Avatar           from '../components/ui/Avatar'
import Button           from '../components/ui/Button'
import { PageLoader }   from '../components/ui/LoadingSpinner'
import { currentYear, formatMonth, currentMonthStr, hexToRgba, toDate, BELT_COLORS, BELT_LABELS } from '../utils/helpers'
import AttendanceModal  from '../components/AttendanceModal'

// ── Helpers ────────────────────────────────────────────────────────────────────
function allMonthsForYear(year) {
  return Array.from({ length: 12 }, (_, i) => format(new Date(year, i, 1), 'yyyy-MM'))
}

// Day key from a Date: 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
function dayKey(date) { return format(date, 'EEE').toLowerCase() }

// ── Floating tooltip ───────────────────────────────────────────────────────────
function FloatingTooltip({ tooltip }) {
  if (!tooltip) return null
  return (
    <div
      className="fixed z-[9999] pointer-events-none bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-xl px-3 py-2.5 shadow-2xl max-w-56 border border-white/10"
      style={{
        left:      Math.min(tooltip.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 230),
        top:       tooltip.y,
        transform: 'translateY(calc(-100% - 8px))',
      }}
    >
      {tooltip.content}
    </div>
  )
}

// ── Year navigator ─────────────────────────────────────────────────────────────
function YearNav({ value, onChange, min = 2020 }) {
  const max = currentYear()
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(y => Math.max(min, y - 1))}
        disabled={value <= min}
        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-bold text-gray-900 min-w-14 text-center">{value}</span>
      <button
        onClick={() => onChange(y => Math.min(max, y + 1))}
        disabled={value >= max}
        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

// ── Week navigator ─────────────────────────────────────────────────────────────
function WeekNav({ weekStart, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(subWeeks(weekStart, 1))}
        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-bold text-gray-900 min-w-44 text-center">
        {format(weekStart, 'd MMM')} — {format(addDays(weekStart, 6), 'd MMM yyyy')}
      </span>
      <button
        onClick={() => onChange(addWeeks(weekStart, 1))}
        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <ChevronRight size={16} />
      </button>
      <button
        onClick={() => onChange(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        className="ml-1 px-2.5 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
      >
        Today
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// MONTHLY GANTT VIEW  (single multi-colour Gantt bar per member per month)
// ──────────────────────────────────────────────────────────────────────────────
function MonthlyView({
  members, attendance, payments, selectedYear, services, scheduleEvents, beltHistory,
  onCellClick, tooltip, setTooltip,
}) {
  const months       = allMonthsForYear(selectedYear)
  const currentMonth = currentMonthStr()

  // sessionMap[memberId][serviceId][month] = sessions[]
  const sessionMap = useMemo(() => {
    const map = {}
    attendance.forEach(a => {
      const month = a.date.slice(0, 7)
      if (!map[a.memberId]) map[a.memberId] = {}
      if (!map[a.memberId][a.sessionType]) map[a.memberId][a.sessionType] = {}
      if (!map[a.memberId][a.sessionType][month]) map[a.memberId][a.sessionType][month] = []
      map[a.memberId][a.sessionType][month].push(a)
    })
    return map
  }, [attendance])

  // beltPromoMap[memberId][month] = [{ category, fromBelt, toBelt, promotedAt }, ...]
  const beltPromoMap = useMemo(() => {
    const map = {}
    ;(beltHistory ?? []).forEach(b => {
      const month = format(new Date(b.promotedAt), 'yyyy-MM')
      if (!map[b.memberId]) map[b.memberId] = {}
      if (!map[b.memberId][month]) map[b.memberId][month] = []
      map[b.memberId][month].push(b)
    })
    return map
  }, [beltHistory])

  const CELL_W  = 62   // px per month column
  const NAME_W  = 210  // px for the sticky name column
  const GANTT_H = 22   // px height of the single Gantt bar
  const ROW_PAD = 8    // top + bottom padding inside a row
  // row height: padding + gantt bar + 4px gap + 7px payment strip
  const rowH    = ROW_PAD * 2 + GANTT_H + 4 + 7

  const activeServices = services.filter(s => s.active)

  const stripeBg = (color) =>
    `repeating-linear-gradient(45deg,
      ${hexToRgba(color, 0.72)},
      ${hexToRgba(color, 0.72)} 3px,
      ${hexToRgba(color, 0.28)} 3px,
      ${hexToRgba(color, 0.28)} 6px)`

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
        {activeServices.map(svc => (
          <div key={svc.id} className="flex items-center gap-1.5">
            <span className="w-8 h-3 rounded-sm" style={{ background: stripeBg(svc.color) }} />
            {svc.name}
          </div>
        ))}
        {(scheduleEvents ?? []).length > 0 && (
          <span className="text-gray-400 italic text-[11px]">★ events shown in their own colour</span>
        )}
        <p className="ml-auto text-gray-400">Hover for details · click to log sessions</p>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: NAME_W + months.length * CELL_W + 40 }}>

            {/* ── Header ── */}
            <div className="flex border-b border-gray-100 bg-gray-50/80 sticky top-0 z-20">
              <div
                className="shrink-0 sticky left-0 z-30 bg-gray-50 border-r border-gray-100 flex items-center px-4 py-3"
                style={{ width: NAME_W }}
              >
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Member</span>
              </div>
              {months.map(month => {
                const isCurrent = month === currentMonth
                const future    = month > currentMonth
                return (
                  <div
                    key={month}
                    className={`shrink-0 flex flex-col items-center justify-center py-2 border-r border-gray-100 last:border-r-0 ${isCurrent ? 'bg-primary-50/40' : ''}`}
                    style={{ width: CELL_W }}
                  >
                    <span className={`text-xs font-semibold ${future ? 'text-gray-300' : isCurrent ? 'text-primary-600' : 'text-gray-500'}`}>
                      {format(parse(month, 'yyyy-MM', new Date()), 'MMM')}
                    </span>
                    {isCurrent && <span className="w-1 h-1 rounded-full bg-primary-400 mt-0.5" />}
                    {(scheduleEvents ?? []).some(ev => ev.date.startsWith(month)) && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5"
                        title={(scheduleEvents ?? []).filter(ev => ev.date.startsWith(month)).map(e => e.title).join(', ')}
                      />
                    )}
                  </div>
                )
              })}
              {/* Status col header */}
              <div className="shrink-0 w-8" />
            </div>

            {/* ── Member rows ── */}
            {members.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No members to display.</div>
            ) : members.map((member, rowIdx) => {
              const memberSvcMap = sessionMap[member.id] ?? {}

              // Total sessions for this member in a given month (across all services)
              const totalInMonth = (m) =>
                Object.values(memberSvcMap).reduce((acc, mm) => acc + (mm[m]?.length ?? 0), 0)

              // Services with any session this year (for name-column dots)
              const activeSvcIds = activeServices
                .filter(s => months.some(m => (memberSvcMap[s.id]?.[m]?.length ?? 0) > 0))
                .map(s => s.id)

              const rowBg  = rowIdx % 2 === 0 ? 'bg-white'      : 'bg-slate-50/30'
              const nameBg = rowIdx % 2 === 0 ? 'bg-white'      : 'bg-slate-50/30'

              return (
                <div
                  key={member.id}
                  className={`flex border-b border-gray-100 last:border-b-0 ${rowBg}`}
                  style={{ minHeight: rowH }}
                >
                  {/* ── Sticky name ── */}
                  <div
                    className={`shrink-0 sticky left-0 z-10 border-r border-gray-100 flex items-center gap-2.5 px-3 ${nameBg}`}
                    style={{ width: NAME_W, minHeight: rowH }}
                  >
                    <Avatar name={member.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/members/${member.id}`}
                        className="text-xs font-semibold text-gray-800 hover:text-primary-600 transition-colors truncate block leading-tight"
                      >
                        {member.name}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {activeSvcIds.length === 0
                          ? <span className="text-[10px] text-gray-400">No sessions this year</span>
                          : activeSvcIds.map(id => {
                              const svc = services.find(s => s.id === id)
                              return <span key={id} className="w-1.5 h-1.5 rounded-full" style={{ background: svc?.color ?? '#94a3b8' }} />
                            })
                        }
                      </div>
                    </div>
                    <span
                      className={`shrink-0 w-1.5 h-1.5 rounded-full ${member.status === 'active' ? 'bg-emerald-400' : 'bg-gray-300'}`}
                      title={member.status}
                    />
                  </div>

                  {/* ── Timeline area ── */}
                  <div className="relative flex-1" style={{ minHeight: rowH }}>
                    {/* Vertical month guide lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {months.map(m => (
                        <div
                          key={m}
                          className={`shrink-0 border-r border-gray-100/80 ${m === currentMonth ? 'bg-primary-50/25' : ''}`}
                          style={{ width: CELL_W }}
                        />
                      ))}
                    </div>

                    <div
                      className="relative z-10 flex flex-col"
                      style={{ paddingTop: ROW_PAD, paddingBottom: ROW_PAD, gap: 4 }}
                    >
                      {/* ── Single multi-colour Gantt bar ── */}
                      <div className="flex" style={{ height: GANTT_H }}>
                        {months.map((month, mIdx) => {
                          // Flat list of all sessions this member had this month
                          const allSessions = Object.values(memberSvcMap)
                            .flatMap(mm => mm[month] ?? [])
                          const total      = allSessions.length
                          const future     = month > currentMonth
                          const canClick   = !future && member.status === 'active'
                          const monthPromos = beltPromoMap[member.id]?.[month] ?? []

                          // Empty month — but show a promo indicator if there was a belt promotion
                          if (total === 0 || future) {
                            if (!future && monthPromos.length > 0) {
                              const promoTooltipContent = (
                                <div className="space-y-1.5" style={{ minWidth: 185 }}>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-semibold text-white leading-tight">{member.name}</p>
                                    <span className="text-[10px] text-gray-400 shrink-0">
                                      {format(parse(month, 'yyyy-MM', new Date()), 'MMM yyyy')}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-400 italic">No training sessions</p>
                                  <div className="border-t border-white/10 pt-1 space-y-1">
                                    {monthPromos.map((promo, pi) => {
                                      const svc = activeServices.find(s => s.id === promo.category)
                                      const beltColor = BELT_COLORS[promo.toBelt] ?? '#94a3b8'
                                      return (
                                        <div key={pi} className="flex items-center gap-1.5">
                                          <span className="text-amber-400 text-[10px]">🎖</span>
                                          <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                                            style={{ background: beltColor }} />
                                          <span className="text-[11px] font-semibold" style={{ color: beltColor }}>
                                            {BELT_LABELS[promo.toBelt] ?? promo.toBelt} Belt
                                          </span>
                                          {svc && (
                                            <span className="text-[10px] ml-auto" style={{ color: svc.color ?? '#94a3b8' }}>
                                              {svc.name}
                                            </span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                              return (
                                <div
                                  key={month}
                                  className="shrink-0 flex items-center justify-center"
                                  style={{ width: CELL_W, height: GANTT_H }}
                                  onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, content: promoTooltipContent })}
                                  onMouseLeave={() => setTooltip(null)}
                                  onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                                >
                                  {monthPromos.map((promo, pi) => {
                                    const beltColor = BELT_COLORS[promo.toBelt] ?? '#94a3b8'
                                    return (
                                      <span
                                        key={pi}
                                        className="w-3.5 h-3.5 rounded-full border-2 border-white/30 shrink-0"
                                        style={{ background: beltColor, marginLeft: pi > 0 ? -4 : 0 }}
                                        title={`${BELT_LABELS[promo.toBelt]} Belt promotion`}
                                      />
                                    )
                                  })}
                                </div>
                              )
                            }
                            return <div key={month} className="shrink-0" style={{ width: CELL_W }} />
                          }

                          // Group sessions by their display colour:
                          // event-linked → event colour; regular → service colour
                          const groups = {}
                          ;[...allSessions].sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
                            const linkedEvent = s.classId
                              ? (scheduleEvents ?? []).find(ev => ev.id === s.classId)
                              : null
                            const svc   = activeServices.find(sv => sv.id === s.sessionType)
                            const color = linkedEvent?.color ?? svc?.color ?? '#94a3b8'
                            const label = linkedEvent
                              ? `★ ${linkedEvent.title}`
                              : (svc?.name ?? s.sessionType)
                            if (!groups[color]) groups[color] = { color, label, sessions: [] }
                            groups[color].sessions.push({ ...s, linkedEvent: linkedEvent ?? null })
                          })
                          const segments = Object.values(groups)

                          // Border radius: join adjacent months that have sessions
                          const prevHas = mIdx > 0 && totalInMonth(months[mIdx - 1]) > 0
                          const nextHas = mIdx < months.length - 1
                            && months[mIdx + 1] <= currentMonth
                            && totalInMonth(months[mIdx + 1]) > 0
                          const r = 4
                          const borderRadius = [
                            prevHas ? 0 : r, nextHas ? 0 : r,
                            nextHas ? 0 : r, prevHas ? 0 : r,
                          ].map(v => v + 'px').join(' ')

                          // Tooltip: full breakdown per service/event
                          const allNotes = allSessions.filter(s => s.note)
                          const tooltipContent = (
                            <div className="space-y-1.5" style={{ minWidth: 185 }}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-white leading-tight">{member.name}</p>
                                <span className="text-[10px] text-gray-400 shrink-0">
                                  {format(parse(month, 'yyyy-MM', new Date()), 'MMM yyyy')}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-300">
                                {total} session{total !== 1 ? 's' : ''}
                              </p>
                              {/* Belt promotions this month */}
                              {monthPromos.length > 0 && (
                                <div className="border-t border-white/10 pt-1 space-y-1">
                                  {monthPromos.map((promo, pi) => {
                                    const svc = activeServices.find(s => s.id === promo.category)
                                    const beltColor = BELT_COLORS[promo.toBelt] ?? '#94a3b8'
                                    return (
                                      <div key={pi} className="flex items-center gap-1.5">
                                        <span className="text-amber-400 text-[10px]">🎖</span>
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                                          style={{ background: beltColor }} />
                                        <span className="text-[11px] font-semibold" style={{ color: beltColor }}>
                                          {BELT_LABELS[promo.toBelt] ?? promo.toBelt} Belt
                                        </span>
                                        {svc && (
                                          <span className="text-[10px] ml-auto" style={{ color: svc.color ?? '#94a3b8' }}>
                                            {svc.name}
                                          </span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                              {segments.map((seg, si) => (
                                <div key={si} className="border-t border-white/10 pt-1">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                                    <span className="text-[11px] font-semibold" style={{ color: seg.color }}>
                                      {seg.label}
                                    </span>
                                    <span className="text-[10px] text-gray-500 ml-auto">{seg.sessions.length}×</span>
                                  </div>
                                  {seg.sessions.map((s, si2) => (
                                    <p key={si2} className="text-[10px] text-gray-400 pl-3.5">
                                      · {format(new Date(s.date), 'EEE d MMM')}
                                      {s.note && <span className="text-gray-500 italic"> — {s.note}</span>}
                                    </p>
                                  ))}
                                </div>
                              ))}
                              {allNotes.length > 0 && (
                                <div className="pt-1 border-t border-white/10">
                                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Notes</p>
                                  {allNotes.map((s, ni) => (
                                    <p key={ni} className="text-[10px] text-gray-300 italic">
                                      {format(new Date(s.date), 'd MMM')}: {s.note}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )

                          return (
                            <div
                              key={month}
                              className="shrink-0"
                              style={{ width: CELL_W, height: GANTT_H, padding: '0 2px' }}
                              onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, content: tooltipContent })}
                              onMouseLeave={() => setTooltip(null)}
                              onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                              onClick={() => canClick && onCellClick({ memberId: member.id, month })}
                            >
                              <div
                                className={`relative w-full h-full flex overflow-hidden transition-all ${canClick ? 'cursor-pointer hover:brightness-110 active:scale-95' : ''}`}
                                style={{ borderRadius }}
                              >
                                {segments.map((seg, si) => (
                                  <div
                                    key={si}
                                    style={{ flex: seg.sessions.length, background: stripeBg(seg.color), minWidth: 3 }}
                                  />
                                ))}
                                {total > 1 && (
                                  <span
                                    className="absolute inset-0 flex items-center justify-center text-[9px] font-bold pointer-events-none select-none"
                                    style={{ color: 'rgba(0,0,0,0.30)' }}
                                  >
                                    {total}
                                  </span>
                                )}
                                {/* Belt promotion indicator */}
                                {monthPromos.length > 0 && (
                                  <span
                                    className="absolute top-0 right-0.5 text-[8px] pointer-events-none select-none leading-none"
                                    title="Belt promotion this month"
                                  >
                                    🎖
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* ── Payment status strip ── */}
                      <div className="flex" style={{ height: 7 }}>
                        {months.map(month => {
                          const joinDate   = toDate(member.joinDate)
                          const joinMonth  = joinDate ? format(joinDate, 'yyyy-MM') : null
                          const isFuture   = month > currentMonth
                          const beforeJoin = joinMonth && month < joinMonth
                          if (isFuture || beforeJoin) {
                            return <div key={month} className="shrink-0" style={{ width: CELL_W }} />
                          }
                          // All payments for this member in this month (monthly + events)
                          const monthPayments = payments.filter(p => p.memberId === member.id && p.month === month)
                          const payment       = monthPayments.find(p => !p.note?.includes('(event)')) ?? monthPayments[0]
                          const eventPayments = monthPayments.filter(p => p.note?.includes('(event)'))
                          const paid          = payment?.status === 'paid'
                          const tipContent = (
                            <div className="space-y-1" style={{ minWidth: 150 }}>
                              <p className="font-semibold text-white">{member.name}</p>
                              <p className="text-[10px] text-gray-400">{formatMonth(month)}</p>
                              {/* Monthly fee status */}
                              <p className={`text-[11px] font-bold ${paid ? 'text-emerald-400' : 'text-red-400'}`}>
                                {paid ? '✓ Monthly Fee Paid' : monthPayments.length === 0 ? '✗ No record' : '✗ Monthly Fee Unpaid'}
                              </p>
                              {payment?.amount != null && (
                                <p className="text-[10px] text-gray-400">{payment.amount}€</p>
                              )}
                              {/* Event payments */}
                              {eventPayments.length > 0 && (
                                <div className="pt-1 border-t border-white/10">
                                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Event Payments</p>
                                  {eventPayments.map((ep, ei) => {
                                    const evTitle = ep.note?.replace(' (event)', '') ?? ''
                                    const ev = (scheduleEvents ?? []).find(e => e.title === evTitle)
                                    return (
                                      <div key={ei} className="flex items-center gap-1.5">
                                        {ev && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ev.color ?? '#f59e0b' }} />}
                                        <span className="text-[10px] text-gray-300">
                                          ★ {evTitle} · {ep.amount}€
                                        </span>
                                        <span className={`text-[9px] font-bold ml-auto ${ep.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                          {ep.status === 'paid' ? '✓' : '○'}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                          return (
                            <div
                              key={month}
                              className="shrink-0 cursor-default"
                              style={{ width: CELL_W, padding: '0 3px' }}
                              onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, content: tipContent })}
                              onMouseLeave={() => setTooltip(null)}
                              onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                            >
                              <div
                                className="w-full h-full rounded-full"
                                style={{ background: paid ? '#22c55e' : '#ef4444', opacity: paid ? 0.65 : 0.45 }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ── Status column: membership + this-month payment ── */}
                  <div className="shrink-0 w-10 flex flex-col items-center justify-center gap-1.5">
                    {/* Active / inactive */}
                    <span
                      className={`text-[10px] font-bold leading-none ${member.status === 'active' ? 'text-emerald-500' : 'text-gray-300'}`}
                      title={`Member is ${member.status}`}
                    >
                      {member.status === 'active' ? '✓' : '✕'}
                    </span>
                    {/* This month's payment */}
                    {(() => {
                      const joinDate  = toDate(member.joinDate)
                      const joinMonth = joinDate ? format(joinDate, 'yyyy-MM') : null
                      if (joinMonth && currentMonth < joinMonth) return null
                      const p    = payments.find(x => x.memberId === member.id && x.month === currentMonth)
                      const paid = p?.status === 'paid'
                      return (
                        <span
                          className={`text-[9px] font-bold px-1 py-0.5 rounded leading-none ${paid ? 'text-emerald-600 bg-emerald-100' : 'text-red-500 bg-red-50'}`}
                          title={`${formatMonth(currentMonth)}: ${paid ? 'Paid' : 'Unpaid'}`}
                        >
                          €
                        </span>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// MonthDayStrip removed — integrated directly into WeeklyView as an inline scrollable bar

// ──────────────────────────────────────────────────────────────────────────────
// WEEKLY VIEW
// ──────────────────────────────────────────────────────────────────────────────
function WeeklyView({
  members, attendance, services, weekStart, onWeekChange,
  scheduleClasses, scheduleEvents, onCellClick, tooltip, setTooltip,
}) {
  const stripRef = useRef(null)

  // Month containing weekStart
  const monthStart = startOfMonth(weekStart)
  const monthEnd   = endOfMonth(weekStart)
  const allDays    = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const weekEnd    = addDays(weekStart, 6)

  // Scroll the active week into view when weekStart changes
  useEffect(() => {
    const el = stripRef.current?.querySelector('[data-active="true"]')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [weekStart])

  // 7 days of this week
  const weekDays = useMemo(() =>
    eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }),
    [weekStart]
  )

  // Daily attendance map: "memberId:YYYY-MM-DD" → sessions[]
  const attendanceDayMap = useMemo(() => {
    const map = {}
    attendance.forEach(a => {
      const key = `${a.memberId}:${a.date}`
      if (!map[key]) map[key] = []
      map[key].push(a)
    })
    return map
  }, [attendance])

  // Scheduled classes per day key ('mon','tue',...)
  const classesPerDay = useMemo(() => {
    const map = {}
    weekDays.forEach(d => {
      const key = dayKey(d)
      map[key] = scheduleClasses.filter(c => c.day === key).sort((a, b) => a.startTime.localeCompare(b.startTime))
    })
    return map
  }, [weekDays, scheduleClasses])

  const NAME_W = 190
  const CELL_W = 120

  return (
    <div className="space-y-3">

      {/* ── Integrated scrollable day navigation bar ── */}
      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl shadow-sm px-2 py-2">
        {/* Prev week */}
        <button
          onClick={() => onWeekChange(subWeeks(weekStart, 1))}
          className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Month label — fixed width so it doesn't shift */}
        <span className="shrink-0 text-xs font-bold text-gray-600 min-w-[72px] text-center select-none">
          {format(monthStart, 'MMM yyyy')}
        </span>

        {/* Scrollable day pills */}
        <div
          ref={stripRef}
          className="flex-1 flex gap-1 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {allDays.map(date => {
            const inCurrentWeek = date >= weekStart && date <= weekEnd
            const todayDay      = isToday(date)
            const future        = isFuture(date) && !todayDay
            return (
              <button
                key={format(date, 'yyyy-MM-dd')}
                data-active={inCurrentWeek ? 'true' : 'false'}
                onClick={() => onWeekChange(startOfWeek(date, { weekStartsOn: 1 }))}
                className={`shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all text-center min-w-[34px] ${
                  inCurrentWeek
                    ? 'bg-primary-500 text-white shadow-sm'
                    : todayDay
                      ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                      : future
                        ? 'text-gray-300 hover:bg-gray-50 cursor-default'
                        : 'text-gray-600 hover:bg-gray-100 cursor-pointer'
                }`}
              >
                <span className={`text-[9px] font-semibold uppercase leading-none ${inCurrentWeek ? 'text-white/80' : future ? 'text-gray-300' : 'text-gray-400'}`}>
                  {format(date, 'EEE')}
                </span>
                <span className="text-xs font-bold leading-none">{format(date, 'd')}</span>
              </button>
            )
          })}
        </div>

        {/* Next week */}
        <button
          onClick={() => onWeekChange(addWeeks(weekStart, 1))}
          className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight size={16} />
        </button>

        {/* Today shortcut */}
        <button
          onClick={() => onWeekChange(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          className="shrink-0 px-2.5 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors border border-primary-100"
        >
          Today
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-400" /> Session logged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-200" /> No session
        </span>
        <p className="ml-auto text-gray-400">Click any cell to log / manage sessions</p>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: NAME_W + weekDays.length * CELL_W }}>
            {/* Header row: day names */}
            <div className="flex border-b border-gray-100 bg-gray-50 sticky top-0 z-20">
              <div
                className="shrink-0 sticky left-0 z-30 bg-gray-50 border-r border-gray-100 flex items-center px-4 py-3"
                style={{ width: NAME_W }}
              >
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Member</span>
              </div>
              {weekDays.map(date => {
                const today   = isToday(date)
                const future  = isFuture(date) && !today
                const dk      = dayKey(date)
                const classes = classesPerDay[dk] ?? []
                return (
                  <div
                    key={dk}
                    className="shrink-0 border-r border-gray-100 last:border-r-0 px-2 py-2"
                    style={{ width: CELL_W }}
                  >
                    {/* Date */}
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className={`text-xs font-bold ${today ? 'text-primary-600' : future ? 'text-gray-300' : 'text-gray-700'}`}>
                        {format(date, 'EEE')}
                      </span>
                      <span className={`text-xs ${today ? 'text-primary-400' : future ? 'text-gray-300' : 'text-gray-400'}`}>
                        {format(date, 'd')}
                      </span>
                      {today && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 ml-auto" />}
                    </div>
                    {/* Scheduled classes chips */}
                    <div className="space-y-0.5">
                      {classes.map(cls => {
                        const svcId = cls.serviceIds?.[0] ?? cls.serviceId
                        const svc = services.find(s => s.id === svcId)
                        if (!svc) return null
                        return (
                          <div
                            key={cls.id}
                            className="text-xs px-1.5 py-0.5 rounded font-medium truncate"
                            style={{ background: hexToRgba(svc.color, 0.12), color: svc.color }}
                            title={`${cls.startTime}–${cls.endTime} ${svc.name}${cls.instructor ? ' · ' + cls.instructor : ''}`}
                          >
                            {cls.startTime} {svc.name}
                          </div>
                        )
                      })}
                      {/* One-off events for this specific date */}
                      {(scheduleEvents ?? []).filter(ev => ev.date === format(date, 'yyyy-MM-dd')).map(ev => (
                        <div
                          key={ev.id}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg border truncate"
                          style={{
                            background:  hexToRgba(ev.color, 0.15),
                            color:       ev.color,
                            borderColor: hexToRgba(ev.color, 0.35),
                          }}
                          title={`${ev.startTime && ev.endTime ? ev.startTime + '–' + ev.endTime + ' · ' : ''}${ev.title}${ev.extraCost > 0 ? ' · €' + ev.extraCost : ''}`}
                        >
                          ★ {ev.startTime ? ev.startTime + ' ' : ''}{ev.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Member rows */}
            {members.length === 0
              ? <div className="py-16 text-center text-sm text-gray-400">No members to display.</div>
              : members.map((member, rowIdx) => (
                <div
                  key={member.id}
                  className={`flex border-b border-gray-50 last:border-b-0 ${rowIdx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                >
                  {/* Sticky name */}
                  <div
                    className={`shrink-0 sticky left-0 z-10 border-r border-gray-100 flex items-center gap-2.5 px-4 py-2 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                    style={{ width: NAME_W }}
                  >
                    <Avatar name={member.name} size="sm" />
                    <div className="min-w-0">
                      <Link
                        to={`/members/${member.id}`}
                        className="text-xs font-semibold text-gray-800 hover:text-primary-600 transition-colors truncate block"
                      >
                        {member.name}
                      </Link>
                      {member.status === 'inactive' && <span className="text-xs text-gray-400">Inactive</span>}
                    </div>
                  </div>

                  {/* Day cells */}
                  {weekDays.map(date => {
                    const dateStr    = format(date, 'yyyy-MM-dd')
                    const future     = isFuture(date) && !isToday(date)
                    const sessions   = attendanceDayMap[`${member.id}:${dateStr}`] ?? []
                    const count      = sessions.length
                    const canClick   = !future && member.status === 'active'

                    // Tooltip
                    const tooltipContent = (
                      <div className="space-y-0.5">
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-gray-400">{format(date, 'EEEE, d MMM')}</p>
                        {future
                          ? <p className="text-gray-500 mt-1">Future date</p>
                          : <>
                              <p className="mt-1">{count} session{count !== 1 ? 's' : ''}</p>
                              {sessions.map(s => {
                                const svc = services.find(sv => sv.id === s.sessionType)
                                const linkedEvent = s.classId ? (scheduleEvents ?? []).find(ev => ev.id === s.classId) : null
                                return (
                                  <div key={s.id} className="flex items-center gap-1 text-[10px] text-gray-400">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: linkedEvent?.color ?? svc?.color ?? '#94a3b8' }} />
                                    {linkedEvent ? `★ ${linkedEvent.title}` : (svc?.name ?? s.sessionType)}
                                    {s.note && <span className="italic text-gray-500"> — {s.note}</span>}
                                  </div>
                                )
                              })}
                            </>
                        }
                      </div>
                    )

                    return (
                      <div
                        key={dateStr}
                        className={`shrink-0 border-r border-gray-100 last:border-r-0 flex items-center justify-center gap-1 px-2 transition-all ${canClick ? 'cursor-pointer hover:bg-primary-50/40' : ''} ${isToday(date) ? 'bg-primary-50/20' : ''}`}
                        style={{ width: CELL_W, minHeight: 48 }}
                        onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, content: tooltipContent })}
                        onMouseLeave={() => setTooltip(null)}
                        onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                        onClick={() => canClick && onCellClick({ memberId: member.id, date: dateStr, dayClasses: classesPerDay[dayKey(date)] ?? [] })}
                      >
                        {count === 0 ? (
                          canClick && (
                            <span className="w-5 h-5 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus size={10} className="text-gray-300" />
                            </span>
                          )
                        ) : (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {sessions.slice(0, 4).map((s, i) => {
                              const svc = services.find(sv => sv.id === s.sessionType)
                              const linkedEvent = s.classId ? (scheduleEvents ?? []).find(ev => ev.id === s.classId) : null
                              const color = linkedEvent?.color ?? svc?.color ?? '#10b981'
                              return (
                                <span
                                  key={i}
                                  className={`w-3 h-3 border border-white shadow-sm ${linkedEvent ? 'rounded-sm rotate-45' : 'rounded-full'}`}
                                  style={{ background: color }}
                                  title={linkedEvent ? `★ ${linkedEvent.title}` : (svc?.name ?? s.sessionType)}
                                />
                              )
                            })}
                            {sessions.length > 4 && (
                              <span className="text-xs font-bold text-gray-500">+{sessions.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────
export default function Activity() {
  const { members, attendance, payments, loading, logAttendance, removeAttendance, addPayment, beltHistory, addBeltPromotion, addMemberNote } = useData()
  // memberPaymentsMap[memberId] = payments[] for quick lookup in AttendanceModal
  const memberPaymentsMap = useMemo(() => {
    const map = {}
    payments.forEach(p => {
      if (!map[p.memberId]) map[p.memberId] = []
      map[p.memberId].push(p)
    })
    return map
  }, [payments])
  const { services }     = useServices()
  const { classes: scheduleClasses, events: scheduleEvents } = useSchedule()
  const { activeCategory, memberSearch = '' } = useOutletContext() ?? {}

  const [viewMode,      setViewMode]      = useState('monthly')
  const [selectedYear,  setSelectedYear]  = useState(currentYear())
  const [weekStart,     setWeekStart]     = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [activeCell,    setActiveCell]    = useState(null) // { memberId, month } | { memberId, date }
  const [tooltip,       setTooltip]       = useState(null)

  // Earliest join year among all members (for YearNav lower bound)
  const minYear = useMemo(() => {
    const years = members.map(m => {
      const d = toDate(m.joinDate)
      return d ? d.getFullYear() : null
    }).filter(Boolean)
    return years.length > 0 ? Math.min(...years) : 2020
  }, [members])

  // Filter + sort members
  const sortedMembers = useMemo(() => {
    const base = activeCategory
      ? members.filter(m => (m.categories ?? []).includes(activeCategory))
      : members
    return [...base].sort((a, b) => {
      if (a.status === b.status) return a.name.localeCompare(b.name)
      return a.status === 'active' ? -1 : 1
    })
  }, [members, activeCategory])

  // Apply member name search from global TopBar
  const filteredMembers = useMemo(() =>
    memberSearch.trim()
      ? sortedMembers.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
      : sortedMembers,
    [sortedMembers, memberSearch]
  )

  // Monthly attendance map: "memberId:YYYY-MM" → sessions[]
  const attendanceMonthMap = useMemo(() => {
    const map = {}
    attendance.forEach(a => {
      const key = `${a.memberId}:${a.date.slice(0, 7)}`
      if (!map[key]) map[key] = []
      map[key].push(a)
    })
    return map
  }, [attendance])

  // Daily attendance map: "memberId:YYYY-MM-DD" → sessions[]
  const attendanceDayMap = useMemo(() => {
    const map = {}
    attendance.forEach(a => {
      const key = `${a.memberId}:${a.date}`
      if (!map[key]) map[key] = []
      map[key].push(a)
    })
    return map
  }, [attendance])

  if (loading) return <PageLoader />

  // Derive modal info from activeCell
  const activeMember = activeCell ? members.find(m => m.id === activeCell.memberId) : null
  const isMonthCell  = !!activeCell?.month
  const modalTitle   = activeMember
    ? isMonthCell
      ? `${activeMember.name} — ${formatMonth(activeCell.month)}`
      : `${activeMember.name} — ${format(new Date(activeCell.date), 'EEE d MMM yyyy')}`
    : ''
  const modalSessions = activeCell
    ? isMonthCell
      ? (attendanceMonthMap[`${activeCell.memberId}:${activeCell.month}`] ?? [])
      : (attendanceDayMap[`${activeCell.memberId}:${activeCell.date}`] ?? [])
    : []
  const defaultDate = activeCell
    ? isMonthCell ? activeCell.month + '-01' : activeCell.date
    : format(new Date(), 'yyyy-MM-dd')

  // One-off events on the specific active date (for event quick-log in AttendanceModal)
  const activeDayEvents = activeCell?.date
    ? scheduleEvents.filter(ev => ev.date === activeCell.date)
    : []

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View mode toggle */}
        <div className="flex items-center bg-gray-100 rounded-xl p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode('monthly')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart2 size={13} /> Monthly
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'weekly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarDays size={13} /> Weekly
          </button>
        </div>

        {/* Navigator — year nav for monthly; weekly nav is embedded in the view */}
        {viewMode === 'monthly' && (
          <YearNav value={selectedYear} onChange={setSelectedYear} min={minYear} />
        )}

        <div className="ml-auto">
          {memberSearch.trim() && (
            <span className="text-xs text-gray-400">
              {filteredMembers.length} / {sortedMembers.length} members
            </span>
          )}
        </div>
      </div>

      {/* Views */}
      {viewMode === 'monthly' ? (
        <MonthlyView
          members={filteredMembers}
          attendance={attendance}
          payments={payments}
          selectedYear={selectedYear}
          services={services}
          scheduleEvents={scheduleEvents}
          beltHistory={beltHistory}
          onCellClick={setActiveCell}
          tooltip={tooltip}
          setTooltip={setTooltip}
        />
      ) : (
        <WeeklyView
          members={filteredMembers}
          attendance={attendance}
          services={services}
          weekStart={weekStart}
          onWeekChange={setWeekStart}
          scheduleClasses={scheduleClasses}
          scheduleEvents={scheduleEvents}
          onCellClick={setActiveCell}
          tooltip={tooltip}
          setTooltip={setTooltip}
        />
      )}

      {/* Floating tooltip */}
      <FloatingTooltip tooltip={tooltip} />

      {/* Attendance modal */}
      {activeCell && activeMember && (
        <AttendanceModal
          member={activeMember}
          title={modalTitle}
          sessions={modalSessions}
          defaultDate={defaultDate}
          dayClasses={activeCell.dayClasses ?? null}
          onClose={() => setActiveCell(null)}
          onLogAttendance={logAttendance}
          onRemoveAttendance={removeAttendance}
          dayEvents={activeDayEvents}
          allEvents={scheduleEvents}
          memberPayments={memberPaymentsMap[activeMember?.id] ?? []}
          onAddPayment={addPayment}
          beltHistory={beltHistory}
          addBeltPromotion={addBeltPromotion}
          addMemberNote={addMemberNote}
        />
      )}
    </div>
  )
}
