import { useState, useMemo } from 'react'
import { format, differenceInMonths, differenceInDays } from 'date-fns'
import { Plus, Award, AlignLeft, LayoutGrid } from 'lucide-react'

import { useSchedule } from '../contexts/ScheduleContext'
import Card from './ui/Card'
import { BELT_COLORS, BELT_LABELS, BELTS, CATEGORY_LABELS } from '../utils/helpers'

// ── Japanese rank labels ───────────────────────────────────────────────────────
const JUDO_BELT_JP = {
  white:  '無級',
  yellow: '7級',
  orange: '6級',
  green:  '5級',
  blue:   '4級',
  purple: '3級',
  brown:  '2級',
  black:  '初段',
}

const BJJ_BELT_JP = {
  white:  '白帯',
  blue:   '青帯',
  purple: '紫帯',
  brown:  '茶帯',
  black:  '黒帯',
}

function getBeltJP(category, belt) {
  if (category === 'judo' || category === 'judokids') return JUDO_BELT_JP[belt] ?? ''
  if (category === 'bjj') return BJJ_BELT_JP[belt] ?? ''
  return ''
}

function formatDuration(months, days) {
  if (months < 1) return `${days}d`
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}mo`
  if (m === 0) return `${y}yr`
  return `${y}yr ${m}mo`
}

export default function BeltHistoryCard({ member, beltHistory, addBeltPromotion, services, attendance, externalServiceFilter }) {
  const { events: scheduleEvents } = useSchedule()
  const [showForm,       setShowForm]       = useState(false)
  const [viewMode,       setViewMode]       = useState('timeline') // 'timeline' | 'category'
  const [form, setForm] = useState({
    category:   '',
    fromBelt:   '',
    toBelt:     '',
    promotedAt: format(new Date(), 'yyyy-MM-dd'),
    notes:      '',
  })
  const [saving, setSaving] = useState(false)

  const beltServices = services ? services.filter(s => s.usesBelts) : []
  const beltCatIds   = new Set(beltServices.map(s => s.id))
  const beltCats     = (member.categories ?? []).filter(c => beltCatIds.has(c))

  // Build enriched history — category-specific session + event counts
  const memberHistory = useMemo(() => {
    const raw = beltHistory
      .filter(b => b.memberId === member.id)
      .sort((a, b) => {
        const d = new Date(a.promotedAt) - new Date(b.promotedAt)
        if (d !== 0) return d
        // Tiebreaker: createdAt (older record = earlier in history)
        return new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0)
      }) // ascending

    const now = new Date()
    return raw.map((entry, idx) => {
      const startDate   = new Date(entry.promotedAt)
      const endDate     = idx < raw.length - 1 ? new Date(raw[idx + 1].promotedAt) : now
      const totalMonths = differenceInMonths(endDate, startDate)
      const totalDays   = differenceInDays(endDate, startDate)
      const years  = Math.floor(totalMonths / 12)
      const months = totalMonths % 12

      // All attendance in this time window
      const allPeriodAtt = (attendance ?? []).filter(a => {
        if (a.memberId !== member.id) return false
        const d = new Date(a.date)
        return d >= startDate && d < endDate
      })

      // Sessions: count direct training of this service + events linked to this service via serviceIds
      const sessions = allPeriodAtt.filter(a => {
        if (a.sessionType === entry.category) return true
        const ev = a.classId ? (scheduleEvents ?? []).find(e => e.id === a.classId) : null
        const evSvcs = ev ? (ev.serviceIds ?? (ev.serviceId ? [ev.serviceId] : [])) : []
        return evSvcs.includes(entry.category)
      }).length

      const isCurrent = idx === raw.length - 1
      return { ...entry, years, months, totalMonths, totalDays, sessions, isCurrent }
    })
    .reverse() // newest first for display
  }, [beltHistory, member.id, attendance, scheduleEvents])

  // Per-category summary stats
  const categoryStats = useMemo(() => {
    const stats = {}
    memberHistory.forEach(e => {
      if (!stats[e.category]) stats[e.category] = { promotions: 0, totalSessions: 0 }
      stats[e.category].promotions++
      stats[e.category].totalSessions += e.sessions
    })
    return stats
  }, [memberHistory])

  // Group history by category for the By Category view
  const historyByCategory = useMemo(() => {
    const map = {}
    memberHistory.forEach(e => {
      if (!map[e.category]) map[e.category] = []
      map[e.category].push(e)
    })
    // Sort each category's entries by belt rank desc (black first, white last)
    Object.values(map).forEach(entries => {
      entries.sort((a, b) => BELTS.indexOf(b.toBelt) - BELTS.indexOf(a.toBelt))
    })
    return map
  }, [memberHistory])

  // Timeline filtered by external service filter (from global TopBar)
  const activeFilter = externalServiceFilter ?? null
  const filteredHistory = activeFilter
    ? memberHistory.filter(e => e.category === activeFilter)
    : memberHistory

  // ── Form handlers ────────────────────────────────────────────────────────────
  function handleCategoryChange(cat) {
    const currentBelt = (member.belts ?? {})[cat] ?? 'white'
    setForm(f => ({ ...f, category: cat, fromBelt: currentBelt, toBelt: '' }))
  }

  async function handleSave() {
    if (!form.category || !form.fromBelt || !form.toBelt) return
    setSaving(true)
    try {
      await addBeltPromotion(member.id, {
        ...form,
        promotedAt: new Date(form.promotedAt),
      })
      setShowForm(false)
      setForm({ category: '', fromBelt: '', toBelt: '', promotedAt: format(new Date(), 'yyyy-MM-dd'), notes: '' })
    } finally {
      setSaving(false)
    }
  }

  // ── Shared entry renderer (compact version for By Category view) ─────────────
  function renderCompactEntry(entry, idx, entries, catColor) {
    const jpFrom = getBeltJP(entry.category, entry.fromBelt)
    const jpTo   = getBeltJP(entry.category, entry.toBelt)
    const promotedDate  = entry.promotedAt instanceof Date ? entry.promotedAt : new Date(entry.promotedAt)
    const durationLabel = formatDuration(entry.totalMonths, entry.totalDays)
    return (
      <div key={entry.id} className="flex gap-2.5 pb-3 last:pb-0">
        <div className="flex flex-col items-center">
          <div
            className="w-2.5 h-2.5 rounded-full border-2 mt-0.5 shrink-0"
            style={{ borderColor: catColor, background: entry.isCurrent ? catColor : 'white' }}
          />
          {idx < entries.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
        </div>
        <div className="flex-1 pb-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-500">{format(promotedDate, 'd MMM yyyy')}</span>
          </div>
          {/* Belt transition */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {entry.fromBelt != null ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full border border-gray-300" style={{ background: BELT_COLORS[entry.fromBelt] ?? '#ccc' }} />
                {BELT_LABELS[entry.fromBelt]}
                {jpFrom && <span className="text-gray-400" style={{ fontFamily: "'Noto Serif JP', serif" }}>{jpFrom}</span>}
              </span>
            ) : (
              <span className="text-[10px] text-emerald-700 font-medium">🥋 Joined</span>
            )}
            {entry.fromBelt != null && <span className="text-gray-300 text-[10px]">→</span>}
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: catColor }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: BELT_COLORS[entry.toBelt] ?? '#ccc' }} />
              {BELT_LABELS[entry.toBelt]}
              {jpTo && <span style={{ fontFamily: "'Noto Serif JP', serif", opacity: 0.7 }}>{jpTo}</span>}
            </span>
          </div>
          {/* Stats */}
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[9px]">
            <span className="text-gray-400">
              ⏱ {entry.isCurrent ? 'Holding' : 'Held'} <span className="font-semibold text-gray-600">{durationLabel}</span>
            </span>
            {entry.sessions > 0 && (
              <span className="text-gray-400">· <span className="font-semibold text-gray-600">{entry.sessions}</span> sessions</span>
            )}
            {entry.sessions > 0 && entry.totalMonths > 0 && (
              <span className="text-gray-300">· ~{(entry.sessions / Math.max(entry.totalMonths, 1)).toFixed(1)}/mo</span>
            )}
          </div>
          {entry.notes && <p className="text-[10px] text-gray-500 mt-0.5 italic">{entry.notes}</p>}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Card>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Belt Promotion History</h3>
          <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: "'Noto Serif JP', serif" }}>段位昇格履歴</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          {memberHistory.length > 0 && (
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode('timeline')}
                title="Timeline"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  viewMode === 'timeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <AlignLeft size={10} /> Timeline
              </button>
              <button
                onClick={() => setViewMode('category')}
                title="By Category"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  viewMode === 'category' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutGrid size={10} /> By Category
              </button>
            </div>
          )}
          {beltCats.length > 0 && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              <Plus size={12} /> Add Promotion
            </button>
          )}
        </div>
      </div>


      {/* ── Per-category summary metrics ── */}
      {Object.keys(categoryStats).length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-5">
          {Object.entries(categoryStats).map(([cat, s]) => {
            const svc      = services?.find(sv => sv.id === cat)
            const catColor = svc?.color ?? '#94a3b8'
            return (
              <div
                key={cat}
                className="p-3 rounded-xl border"
                style={{ borderColor: catColor + '30', background: catColor + '08' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: catColor }}>
                  {svc?.name ?? CATEGORY_LABELS[cat] ?? cat}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <p className="text-base font-bold text-gray-900">{s.promotions}</p>
                    <p className="text-[10px] text-gray-400">promotions</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900">{s.totalSessions}</p>
                    <p className="text-[10px] text-gray-400">sessions</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Inline add form ── */}
      {showForm && (
        <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Record Belt Promotion</p>

          {/* Category pills */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Category</label>
            <div className="flex gap-1.5 flex-wrap">
              {beltCats.map(c => {
                const svc = services?.find(s => s.id === c)
                const catColor = svc?.color ?? '#94a3b8'
                const isActive = form.category === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCategoryChange(c)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={isActive
                      ? { background: catColor, color: 'white' }
                      : { background: catColor + '20', color: catColor }
                    }
                  >
                    {svc?.name ?? CATEGORY_LABELS[c] ?? c}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={form.promotedAt}
              onChange={e => setForm(f => ({ ...f, promotedAt: e.target.value }))}
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-primary-400"
            />
          </div>

          {/* From belt preview */}
          {form.category && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>From:</span>
              <span className="flex items-center gap-1 font-medium text-gray-700">
                <span className="w-2.5 h-2.5 rounded-full border border-gray-300" style={{ background: BELT_COLORS[form.fromBelt] ?? '#ccc' }} />
                {BELT_LABELS[form.fromBelt]}
              </span>
              <span className="text-gray-300">→ promote to:</span>
            </div>
          )}

          {/* To Belt pills */}
          {form.category && (
            <div>
              <div className="flex gap-1.5 flex-wrap">
                {BELTS.map(b => {
                  const isActive = form.toBelt === b
                  const beltColor = BELT_COLORS[b] ?? '#ccc'
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, toBelt: b }))}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        isActive
                          ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: beltColor, border: b === 'white' ? '1px solid #d1d5db' : 'none' }}
                      />
                      {BELT_LABELS[b]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes..."
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-primary-400"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !form.category || !form.fromBelt || !form.toBelt}
              className="px-3 py-1.5 text-xs font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TIMELINE VIEW — unified date-sorted, all categories mixed            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'timeline' && (
        filteredHistory.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No promotion records yet.</p>
        ) : (
          <div className="space-y-0">
            {filteredHistory.map((entry, idx) => {
              const jpFrom = getBeltJP(entry.category, entry.fromBelt)
              const jpTo   = getBeltJP(entry.category, entry.toBelt)
              const promotedDate  = entry.promotedAt instanceof Date ? entry.promotedAt : new Date(entry.promotedAt)
              const durationLabel = formatDuration(entry.totalMonths, entry.totalDays)
              const svc      = services?.find(s => s.id === entry.category)
              const catColor = svc?.color ?? '#94a3b8'

              return (
                <div key={entry.id} className="flex gap-3 pb-4 last:pb-0">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-3 h-3 rounded-full border-2 mt-0.5 shrink-0"
                      style={{ borderColor: catColor, background: entry.isCurrent ? catColor : 'white' }}
                    />
                    {idx < filteredHistory.length - 1 && (
                      <div className="w-px flex-1 bg-gray-100 mt-1" />
                    )}
                  </div>

                  <div className="flex-1 pb-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-500">{format(promotedDate, 'd MMM yyyy')}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: catColor + '18', color: catColor }}>
                        {svc?.name ?? CATEGORY_LABELS[entry.category] ?? entry.category}
                      </span>
                    </div>

                    {/* Belt transition */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {entry.fromBelt != null ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                          <span className="w-2 h-2 rounded-full border border-gray-300" style={{ background: BELT_COLORS[entry.fromBelt] ?? '#ccc' }} />
                          {BELT_LABELS[entry.fromBelt]}
                          {jpFrom && <span className="text-gray-400 ml-0.5" style={{ fontFamily: "'Noto Serif JP', serif" }}>{jpFrom}</span>}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-xs font-medium text-emerald-700">
                          🥋 Started Journey
                        </span>
                      )}
                      {entry.fromBelt != null && <span className="text-gray-400 text-xs">→</span>}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                        <span className="w-2 h-2 rounded-full border border-primary-200" style={{ background: BELT_COLORS[entry.toBelt] ?? '#ccc' }} />
                        {BELT_LABELS[entry.toBelt]}
                        {jpTo && <span className="text-primary-500 ml-0.5" style={{ fontFamily: "'Noto Serif JP', serif" }}>{jpTo}</span>}
                      </span>
                    </div>

                    {/* Duration + sessions row */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md">
                        ⏱ {entry.isCurrent ? 'Holding for' : 'Held for'} <span className="font-bold text-gray-700">{durationLabel}</span>
                      </span>
                      {entry.sessions > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md">
                          <Award size={9} className="text-gray-400" />
                          <span className="font-bold text-gray-700">{entry.sessions}</span> sessions
                        </span>
                      )}
                      {entry.sessions > 0 && entry.totalMonths > 0 && (
                        <span className="text-[10px] text-gray-400">
                          ~{(entry.sessions / Math.max(entry.totalMonths, 1)).toFixed(1)}/mo
                        </span>
                      )}
                    </div>

                    {entry.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">{entry.notes}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* BY CATEGORY VIEW — each service in its own column card               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'category' && (
        Object.keys(historyByCategory).length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No promotion records yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(historyByCategory).filter(([cat]) => !externalServiceFilter || cat === externalServiceFilter).map(([cat, entries]) => {
              const svc      = services?.find(s => s.id === cat)
              const catColor = svc?.color ?? '#94a3b8'
              const catStats = categoryStats[cat]
              return (
                <div
                  key={cat}
                  className="border rounded-xl p-3"
                  style={{ borderColor: catColor + '30', background: catColor + '05' }}
                >
                  {/* Category header */}
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b" style={{ borderColor: catColor + '25' }}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: catColor }} />
                    <p className="text-xs font-bold" style={{ color: catColor }}>
                      {svc?.name ?? CATEGORY_LABELS[cat] ?? cat}
                    </p>
                    <div className="ml-auto flex items-center gap-2.5 text-[10px]">
                      <span className="text-gray-500">
                        <span className="font-bold text-gray-800">{catStats?.promotions ?? 0}</span> promos
                      </span>
                      <span className="text-gray-500">
                        <span className="font-bold text-gray-800">{catStats?.totalSessions ?? 0}</span> sessions
                      </span>
                    </div>
                  </div>

                  {/* Belt timeline for this category */}
                  <div className="space-y-0">
                    {entries.map((entry, idx) => renderCompactEntry(entry, idx, entries, catColor))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </Card>
  )
}
