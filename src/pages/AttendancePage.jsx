import { useMemo, useState } from 'react'
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns'
import { CalendarCheck, Users, TrendingUp, Clock, Plus, X } from 'lucide-react'

import { useData } from '../contexts/DataContext'
import { ServiceBadge } from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Card, { CardHeader } from '../components/ui/Card'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { CATEGORY_LABELS, CATEGORY_COLORS, CATEGORIES, formatDate } from '../utils/helpers'

export default function AttendancePage() {
  const { members, attendance, logAttendance, loading } = useData()
  const [showLogForm, setShowLogForm] = useState(false)
  const [logForm, setLogForm] = useState({
    memberId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    sessionType: 'judo',
  })
  const [saving, setSaving] = useState(false)

  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(today), 'yyyy-MM-dd')
  const last7Start = format(subDays(today, 6), 'yyyy-MM-dd')

  const activeMembers = useMemo(() =>
    members.filter(m => m.status === 'active'),
    [members]
  )

  // Sessions this month
  const thisMonthAttendance = useMemo(() =>
    attendance.filter(a => a.date >= monthStart && a.date <= monthEnd),
    [attendance, monthStart, monthEnd]
  )

  // Sessions last 7 days
  const last7Attendance = useMemo(() =>
    attendance.filter(a => a.date >= last7Start),
    [attendance, last7Start]
  )

  // Top stats
  const topStats = useMemo(() => {
    const totalSessions = thisMonthAttendance.length

    // Most active member this month
    const sessionsByMember = {}
    thisMonthAttendance.forEach(a => {
      sessionsByMember[a.memberId] = (sessionsByMember[a.memberId] ?? 0) + 1
    })
    const topMemberId = Object.entries(sessionsByMember).sort((a, b) => b[1] - a[1])[0]?.[0]
    const topMember = topMemberId ? members.find(m => m.id === topMemberId) : null
    const topMemberCount = topMemberId ? sessionsByMember[topMemberId] : 0

    const uniqueAttendees = new Set(thisMonthAttendance.map(a => a.memberId)).size
    const avgSessions = uniqueAttendees > 0 ? (totalSessions / uniqueAttendees).toFixed(1) : '0'

    return { totalSessions, topMember, topMemberCount, uniqueAttendees, avgSessions }
  }, [thisMonthAttendance, members])

  // Per-member stats
  const memberStats = useMemo(() =>
    activeMembers
      .map(member => {
        const monthCount = thisMonthAttendance.filter(a => a.memberId === member.id).length
        const last7Count = last7Attendance.filter(a => a.memberId === member.id).length
        const allForMember = attendance.filter(a => a.memberId === member.id)
        const lastSession = allForMember.length > 0
          ? allForMember.reduce((latest, a) => a.date > latest ? a.date : latest, allForMember[0].date)
          : null
        return { member, monthCount, last7Count, lastSession }
      })
      .sort((a, b) => b.monthCount - a.monthCount),
    [activeMembers, thisMonthAttendance, last7Attendance, attendance]
  )

  async function handleLogAttendance(e) {
    e.preventDefault()
    if (!logForm.memberId || !logForm.date || !logForm.sessionType) return
    setSaving(true)
    try {
      await logAttendance(logForm.memberId, logForm.date, logForm.sessionType)
      setShowLogForm(false)
      setLogForm({ memberId: '', date: format(new Date(), 'yyyy-MM-dd'), sessionType: 'judo' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Attendance Log</h2>
          <p className="text-xs text-gray-500 mt-0.5">{format(today, 'MMMM yyyy')}</p>
        </div>
        <button
          onClick={() => setShowLogForm(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors"
        >
          {showLogForm ? <X size={14} /> : <Plus size={14} />}
          {showLogForm ? 'Cancel' : 'Log Session'}
        </button>
      </div>

      {/* Log session form */}
      {showLogForm && (
        <Card>
          <CardHeader title="Log Attendance" subtitle="Record a member's session" />
          <form onSubmit={handleLogAttendance} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Member</label>
              <select
                value={logForm.memberId}
                onChange={e => setLogForm(f => ({ ...f, memberId: e.target.value }))}
                required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-primary-400"
              >
                <option value="">Select member...</option>
                {activeMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={logForm.date}
                onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))}
                required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Session Type</label>
              <select
                value={logForm.sessionType}
                onChange={e => setLogForm(f => ({ ...f, sessionType: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-primary-400"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving...' : 'Log Session'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-primary-50 rounded-lg flex items-center justify-center">
              <CalendarCheck size={14} className="text-primary-600" />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sessions</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{topStats.totalSessions}</p>
          <p className="text-xs text-gray-400 mt-0.5">this month</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
              <TrendingUp size={14} className="text-amber-600" />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Most Active</p>
          </div>
          {topStats.topMember ? (
            <>
              <p className="text-sm font-bold text-gray-900 truncate">{topStats.topMember.name.split(' ')[0]}</p>
              <p className="text-xs text-gray-400 mt-0.5">{topStats.topMemberCount} sessions</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Users size={14} className="text-emerald-600" />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Attendees</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{topStats.uniqueAttendees}</p>
          <p className="text-xs text-gray-400 mt-0.5">unique members</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
              <Clock size={14} className="text-violet-600" />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Sessions</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{topStats.avgSessions}</p>
          <p className="text-xs text-gray-400 mt-0.5">per active member</p>
        </div>
      </div>

      {/* Member attendance table */}
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Member Attendance</h3>
          <p className="text-xs text-gray-400">{format(today, 'MMMM yyyy')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sports</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">This Month</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Last 7 Days</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Last Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {memberStats.map(({ member, monthCount, last7Count, lastSession }) => (
                <tr key={member.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={member.name} size="sm" />
                      <span className="font-semibold text-gray-900 text-sm">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(member.categories ?? []).map(c => (
                        <ServiceBadge key={c} serviceId={c} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${monthCount > 0 ? 'text-primary-600' : 'text-gray-300'}`}>
                      {monthCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = format(subDays(today, 6 - i), 'yyyy-MM-dd')
                        const hasSession = attendance.some(a => a.memberId === member.id && a.date === d)
                        return (
                          <span
                            key={i}
                            className="w-2 h-4 rounded-sm"
                            style={{ background: hasSession ? '#ea580c' : '#e2e8f0' }}
                            title={d}
                          />
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell">
                    {lastSession ? format(parseISO(lastSession), 'd MMM yyyy') : '—'}
                  </td>
                </tr>
              ))}
              {memberStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                    No active members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
