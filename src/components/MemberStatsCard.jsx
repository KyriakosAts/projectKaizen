import { useState, useMemo } from 'react'
import { format, parse, subMonths, eachMonthOfInterval, startOfMonth, differenceInMonths } from 'date-fns'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'

import { useTheme, ACCENT_PALETTES } from '../contexts/ThemeContext'
import { useSchedule } from '../contexts/ScheduleContext'
import Card from './ui/Card'
import { formatCurrency, toDate, BELT_COLORS, BELT_LABELS, BELTS, CATEGORY_LABELS } from '../utils/helpers'

const RANGE_OPTIONS = [
  { id: '6mo', label: '6 Months' },
  { id: '1yr', label: '1 Year' },
  { id: 'all', label: 'All Time' },
]

// Custom dot for belt promotions on the line chart
function BeltDot({ cx, cy, payload, beltPromos }) {
  const promo = beltPromos[payload?.monthRaw]
  if (!promo) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill={BELT_COLORS[promo.toBelt] ?? '#94a3b8'} stroke="white" strokeWidth={2} />
    </g>
  )
}

// ── Custom attendance tooltip ─────────────────────────────────────────────────
function AttendanceTooltip({ active, payload, label, beltPromos, services, accentHex }) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload ?? {}
  const promo = beltPromos[label]
  let dateStr = label
  try { dateStr = format(parse(label, 'yyyy-MM', new Date()), 'MMMM yyyy') } catch {}

  const breakdown = data.breakdown ?? {}
  const eventCount = data.eventCount ?? 0
  const totalSessions = data.sessions ?? 0
  const typeKeys = Object.keys(breakdown)
  const hasBreakdown = typeKeys.length > 1 || (typeKeys.length === 1 && eventCount > 0)

  return (
    <div className="bg-white rounded-xl shadow-md border text-xs min-w-[150px] overflow-hidden"
         style={{ borderColor: accentHex + '40' }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: accentHex + '20', background: accentHex + '08' }}>
        <p className="font-bold" style={{ color: accentHex }}>{dateStr}</p>
        {promo && (
          <p className="text-[10px] font-semibold mt-0.5 flex items-center gap-1"
             style={{ color: BELT_COLORS[promo.toBelt] ?? '#94a3b8' }}>
            🎖 {BELT_LABELS[promo.toBelt]} promotion
          </p>
        )}
      </div>
      <div className="px-3 py-2 space-y-1">
        {hasBreakdown ? (
          <>
            {typeKeys.map(type => {
              const svc = services?.find(s => s.id === type)
              const color = svc?.color ?? '#94a3b8'
              return (
                <div key={type} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                    {svc?.name ?? CATEGORY_LABELS[type] ?? type}
                  </span>
                  <span className="font-semibold text-gray-800">{breakdown[type]}</span>
                </div>
              )
            })}
            {eventCount > 0 && (
              <div className="flex items-center justify-between gap-4 pt-1 mt-0.5 border-t border-gray-100">
                <span className="flex items-center gap-1.5 text-amber-600">
                  <span className="text-[9px]">★</span> Events attended
                </span>
                <span className="font-semibold text-amber-600">{eventCount}</span>
              </div>
            )}
            {typeKeys.length > 1 && (
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-gray-100 font-semibold">
                <span className="text-gray-600">Total</span>
                <span className="text-gray-900">{totalSessions}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500">Sessions</span>
              <span className="font-bold text-gray-900">{totalSessions}</span>
            </div>
            {eventCount > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-amber-600 flex items-center gap-1">
                  <span className="text-[9px]">★</span> Events
                </span>
                <span className="font-semibold text-amber-600">{eventCount}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function MemberStatsCard({ member, payments, attendance, beltHistory, services, serviceFilter }) {
  const { accent } = useTheme()
  const accentHex = ACCENT_PALETTES[accent]?.hex ?? '#f97316'
  const { events: scheduleEvents } = useSchedule()
  const [range, setRange] = useState('6mo')

  // Compute the list of months to show based on the range
  const months = useMemo(() => {
    const now = new Date()
    if (range === '6mo') {
      return Array.from({ length: 6 }, (_, i) => format(subMonths(now, 5 - i), 'yyyy-MM'))
    }
    if (range === '1yr') {
      return Array.from({ length: 12 }, (_, i) => format(subMonths(now, 11 - i), 'yyyy-MM'))
    }
    // all time — use service start date if a service filter is active
    const startDate = (serviceFilter && member.serviceDates?.[serviceFilter])
      ? toDate(member.serviceDates[serviceFilter])
      : toDate(member.joinDate)
    if (!startDate) return Array.from({ length: 6 }, (_, i) => format(subMonths(now, 5 - i), 'yyyy-MM'))
    return eachMonthOfInterval({ start: startOfMonth(startDate), end: now })
      .map(d => format(d, 'yyyy-MM'))
  }, [range, member.joinDate, member.serviceDates, serviceFilter])

  // Attendance data per month — includes per-type breakdown + event count
  const attendanceData = useMemo(() => months.map(month => {
    const records = attendance.filter(a => {
      if (a.memberId !== member.id) return false
      if (!a.date.startsWith(month)) return false
      if (serviceFilter) {
        const ev = a.classId ? (scheduleEvents ?? []).find(e => e.id === a.classId) : null
        const evSvcs = ev ? (ev.serviceIds ?? (ev.serviceId ? [ev.serviceId] : [])) : []
        if (a.sessionType !== serviceFilter && !evSvcs.includes(serviceFilter)) return false
      }
      return true
    })
    const breakdown = {}
    let eventCount = 0
    records.forEach(a => {
      const isEvent = (scheduleEvents ?? []).some(ev => ev.id === a.classId)
      if (isEvent) eventCount++
      const type = a.sessionType || 'other'
      breakdown[type] = (breakdown[type] || 0) + 1
    })
    return { monthRaw: month, sessions: records.length, breakdown, eventCount }
  }), [months, attendance, member.id, scheduleEvents, serviceFilter])

  // Payment revenue data per month
  const paymentData = useMemo(() => months.map(month => {
    const monthPays    = payments.filter(p => p.month === month)
    const paidPays     = monthPays.filter(p => p.status === 'paid')
    const regularPays  = paidPays.filter(p => !p.note?.includes('(event)'))
    let eventPays      = paidPays.filter(p => p.note?.includes('(event)'))
    if (serviceFilter) {
      eventPays = eventPays.filter(p => {
        const evName = p.note?.replace(' (event)', '').trim()
        const ev = (scheduleEvents ?? []).find(e => e.title === evName || e.name === evName)
        if (!ev) return false
        const evSvcs = ev.serviceIds ?? (ev.serviceId ? [ev.serviceId] : [])
        return evSvcs.includes(serviceFilter)
      })
    }
    const regularRev = regularPays.reduce((s, p) => s + (p.amount ?? 0), 0)
    const eventRev   = eventPays.reduce((s, p) => s + (p.amount ?? 0), 0)
    return { monthRaw: month, regular: regularRev, events: eventRev }
  }), [months, payments, scheduleEvents, serviceFilter])

  // Smart X-axis ticks: for long ranges show only year boundaries
  const xTicks = useMemo(() => {
    if (months.length <= 12) return months
    const ticks = new Set([months[0], months[months.length - 1]])
    months.forEach(m => {
      if (m.slice(5) === '01') ticks.add(m)
      if (months.length <= 30 && m.slice(5) === '07') ticks.add(m)
    })
    return [...ticks].sort()
  }, [months])

  function tickFmt(m) {
    const d = parse(m, 'yyyy-MM', new Date())
    if (months.length > 36) return format(d, 'yyyy')
    if (months.length > 12) return format(d, 'MMM yy')
    return format(d, 'MMM')
  }

  // Belt promotions within the visible range, keyed by month string
  const beltPromos = useMemo(() => {
    const map = {}
    ;(beltHistory ?? [])
      .filter(b => b.memberId === member.id)
      .filter(b => !serviceFilter || b.category === serviceFilter)
      .forEach(b => {
        const m = format(new Date(b.promotedAt), 'yyyy-MM')
        if (months.includes(m)) map[m] = b
      })
    return map
  }, [beltHistory, member.id, months, serviceFilter])

  const promoMonths = Object.keys(beltPromos)

  // Starting belt per service (fromBelt == null entries), for start-date reference lines
  const startingBeltByService = useMemo(() =>
    Object.fromEntries(
      (beltHistory ?? [])
        .filter(b => b.memberId === member.id && b.fromBelt == null)
        .map(b => [b.category, b.toBelt])
    ),
  [beltHistory, member.id])

  // Services with belts that this member is enrolled in
  const memberBeltServices = useMemo(() =>
    (services ?? []).filter(s => s.usesBelts && (member.categories ?? []).includes(s.id)),
  [services, member.categories])

  // Belt period stats (for the metrics table), grouped by category, sorted belt desc
  const beltPeriodStats = useMemo(() => {
    const history = (beltHistory ?? [])
      .filter(b => b.memberId === member.id)
      .sort((a, b) => new Date(a.promotedAt) - new Date(b.promotedAt))

    const now = new Date()
    const flat = history.map((entry, idx) => {
      const startDate = new Date(entry.promotedAt)
      const endDate   = idx < history.length - 1 ? new Date(history[idx + 1].promotedAt) : now
      const totalMonths = differenceInMonths(endDate, startDate)
      const sessions = (attendance ?? []).filter(a => {
        if (a.memberId !== member.id) return false
        const d = new Date(a.date)
        if (d < startDate || d >= endDate) return false
        // Count direct sessions of this service
        if (a.sessionType === entry.category) return true
        // Also count events linked to this service
        const ev = a.classId ? (scheduleEvents ?? []).find(e => e.id === a.classId) : null
        const evSvcs = ev ? (ev.serviceIds ?? (ev.serviceId ? [ev.serviceId] : [])) : []
        return evSvcs.includes(entry.category)
      }).length
      return { ...entry, totalMonths, sessions, isCurrent: idx === history.length - 1 }
    })

    // Filter by service, then group by category + sort belt desc within each group
    const filtered = serviceFilter ? flat.filter(e => e.category === serviceFilter) : flat
    // Sort: first group by category (alphabetical), within each group by belt rank desc
    return [...filtered].sort((a, b) => {
      const catCmp = a.category.localeCompare(b.category)
      if (catCmp !== 0) return catCmp
      return BELTS.indexOf(b.toBelt) - BELTS.indexOf(a.toBelt)
    })
  }, [beltHistory, member.id, attendance, serviceFilter, scheduleEvents])

  const memberAttendance = attendance.filter(a => {
    if (a.memberId !== member.id) return false
    if (serviceFilter) {
      const ev = a.classId ? (scheduleEvents ?? []).find(e => e.id === a.classId) : null
      const evSvcs = ev ? (ev.serviceIds ?? (ev.serviceId ? [ev.serviceId] : [])) : []
      if (a.sessionType !== serviceFilter && !evSvcs.includes(serviceFilter)) return false
    }
    return true
  })
  const totalSessions    = memberAttendance.length
  const rangeCount       = memberAttendance.filter(a => months.includes(a.date.slice(0, 7))).length
  const totalRevenue     = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount ?? 0), 0)
  const totalEvents      = memberAttendance.filter(a => (scheduleEvents ?? []).some(ev => ev.id === a.classId)).length
  const rangeEvents      = memberAttendance.filter(a => months.includes(a.date.slice(0, 7)) && (scheduleEvents ?? []).some(ev => ev.id === a.classId)).length

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Activity & Payments</h3>
          <p className="text-xs text-gray-400 mt-0.5">Sessions and collected revenue</p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {RANGE_OPTIONS.map(o => (
            <button
              key={o.id}
              onClick={() => setRange(o.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                range === o.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-400 font-medium">Total Sessions</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">{totalSessions}</p>
          {totalEvents > 0 && (
            <p className="text-[10px] text-amber-500 font-medium mt-0.5">★ {totalEvents} events</p>
          )}
        </div>
        <div className="p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-400 font-medium">In Range</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">{rangeCount}</p>
          {rangeEvents > 0 && (
            <p className="text-[10px] text-amber-500 font-medium mt-0.5">★ {rangeEvents} events</p>
          )}
        </div>
        <div className="p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-400 font-medium">Total Paid</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      {/* Attendance line chart */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Attendance — Sessions per Month</p>
        {promoMonths.length > 0 && (
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full border border-gray-300 inline-block" style={{ background: 'white', boxShadow: '0 0 0 2px #94a3b8' }} />
            belt promotion
          </p>
        )}
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={attendanceData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={months.length > 6} />
          <XAxis
            dataKey="monthRaw"
            ticks={xTicks}
            tickFormatter={tickFmt}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            content={<AttendanceTooltip beltPromos={beltPromos} services={services} accentHex={accentHex} />}
          />
          {/* Service start-date reference lines (starting belt color) */}
          {memberBeltServices
            .filter(svc => !serviceFilter || svc.id === serviceFilter)
            .map(svc => {
              const sd = toDate(member.serviceDates?.[svc.id]); if (!sd) return null
              const sm = format(sd, 'yyyy-MM'); if (!months.includes(sm)) return null
              const belt = startingBeltByService[svc.id] ?? 'white'
              const color = BELT_COLORS[belt] ?? svc.color ?? '#94a3b8'
              return (
                <ReferenceLine key={`start_${svc.id}`} x={sm} stroke={color} strokeWidth={2}
                  label={{ value: `${BELT_LABELS[belt]?.slice(0, 3) ?? belt}`, position: 'insideTopLeft', fontSize: 8, fill: color, fontWeight: 700 }} />
              )
            })}
          {/* Belt promotion reference lines */}
          {promoMonths.map(m => (
            <ReferenceLine
              key={m}
              x={m}
              stroke={BELT_COLORS[beltPromos[m].toBelt] ?? '#94a3b8'}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: BELT_LABELS[beltPromos[m].toBelt]?.slice(0, 3),
                position: 'top',
                fontSize: 8,
                fill: BELT_COLORS[beltPromos[m].toBelt] ?? '#94a3b8',
                fontWeight: 700,
              }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="sessions"
            stroke={accentHex}
            strokeWidth={2.5}
            dot={({ cx, cy, payload }) => {
              const promo = beltPromos[payload.monthRaw]
              if (promo) {
                return (
                  <circle key={payload.monthRaw} cx={cx} cy={cy} r={5}
                    fill={BELT_COLORS[promo.toBelt] ?? '#94a3b8'}
                    stroke="white" strokeWidth={2}
                  />
                )
              }
              return <circle key={payload.monthRaw} cx={cx} cy={cy} r={months.length > 36 ? 1.5 : 3} fill={accentHex} stroke="none" />
            }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Revenue stacked bar chart */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-2">Revenue — Monthly + Event Payments</p>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart
          data={paymentData}
          barSize={months.length > 36 ? 4 : months.length > 18 ? 8 : 20}
          margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={months.length > 6} />
          <XAxis
            dataKey="monthRaw"
            ticks={xTicks}
            tickFormatter={tickFmt}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: `1px solid ${accentHex}30`, fontSize: 11 }}
            labelStyle={{ color: accentHex, fontWeight: 700, marginBottom: 2 }}
            labelFormatter={m => format(parse(m, 'yyyy-MM', new Date()), 'MMMM yyyy')}
            formatter={(v, name) => [`€${v}`, name === 'regular' ? 'Monthly Fee' : 'Events']}
          />
          {/* Service start-date reference lines (starting belt color) */}
          {memberBeltServices
            .filter(svc => !serviceFilter || svc.id === serviceFilter)
            .map(svc => {
              const sd = toDate(member.serviceDates?.[svc.id]); if (!sd) return null
              const sm = format(sd, 'yyyy-MM'); if (!months.includes(sm)) return null
              const belt = startingBeltByService[svc.id] ?? 'white'
              const color = BELT_COLORS[belt] ?? svc.color ?? '#94a3b8'
              return (
                <ReferenceLine key={`start_${svc.id}`} x={sm} stroke={color} strokeWidth={2}
                  label={{ value: `${BELT_LABELS[belt]?.slice(0, 3) ?? belt}`, position: 'insideTopLeft', fontSize: 8, fill: color, fontWeight: 700 }} />
              )
            })}
          {promoMonths.map(m => (
            <ReferenceLine
              key={m}
              x={m}
              stroke={BELT_COLORS[beltPromos[m].toBelt] ?? '#94a3b8'}
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
          ))}
          <Bar dataKey="regular" name="regular" stackId="rev" fill={accentHex} radius={[0, 0, 0, 0]} />
          <Bar dataKey="events"  name="events"  stackId="rev" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Belt period breakdown table — grouped by service, belt rank desc */}
      {beltPeriodStats.length > 0 && (() => {
        // Build groups
        const groups = []
        let lastCat = null
        beltPeriodStats.forEach(entry => {
          if (entry.category !== lastCat) {
            const svc = services?.find(s => s.id === entry.category)
            groups.push({ category: entry.category, svc, entries: [] })
            lastCat = entry.category
          }
          groups[groups.length - 1].entries.push(entry)
        })
        const maxSessions = Math.max(...beltPeriodStats.map(e => e.sessions), 1)

        return (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Sessions per Belt Period
              {serviceFilter && services?.find(s => s.id === serviceFilter) && (
                <span className="ml-1 normal-case font-normal text-gray-400">
                  — {services.find(s => s.id === serviceFilter).name}
                </span>
              )}
            </p>
            <div className="space-y-4">
              {groups.map(({ category, svc, entries }) => {
                const catColor = svc?.color ?? '#94a3b8'
                const catLabel = svc?.name ?? CATEGORY_LABELS[category] ?? category
                return (
                  <div key={category}>
                    {groups.length > 1 && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: catColor }} />
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: catColor }}>{catLabel}</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      {entries.map(entry => {
                        const sessionRate = entry.totalMonths > 0
                          ? (entry.sessions / entry.totalMonths).toFixed(1)
                          : entry.sessions
                        const barPct = Math.round((entry.sessions / maxSessions) * 100)
                        return (
                          <div key={entry.id} className="flex items-center gap-3">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 border border-gray-200"
                              style={{ background: BELT_COLORS[entry.toBelt] ?? '#ccc' }}
                            />
                            <span className="text-xs text-gray-600 w-16 shrink-0 font-medium">{BELT_LABELS[entry.toBelt] ?? entry.toBelt}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${barPct}%`, background: catColor }}
                              />
                            </div>
                            <span className="text-xs font-bold text-gray-700 w-6 text-right shrink-0">{entry.sessions}</span>
                            <span className="text-[10px] text-gray-400 shrink-0 w-14 text-right">
                              {entry.totalMonths}mo · {sessionRate}/mo
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </Card>
  )
}
