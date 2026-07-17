import { useState } from 'react'
import { format } from 'date-fns'
import { Plus, Trash2, Award } from 'lucide-react'

import { useServices } from '../contexts/ServicesContext'
import Modal           from './ui/Modal'
import Button          from './ui/Button'
import { hexToRgba, BELT_COLORS, BELT_LABELS, BELTS, CATEGORY_LABELS } from '../utils/helpers'
import { alertDialog } from '../utils/dialogs'

export default function AttendanceModal({ member, title, sessions, defaultDate, dayClasses, dayEvents, allEvents, memberPayments, onClose, onLogAttendance, onRemoveAttendance, onAddPayment, beltHistory, addBeltPromotion, addMemberNote }) {
  const { services } = useServices()
  const activeServices = services.filter(s => s.active)
  const beltServices   = services.filter(s => s.usesBelts && (member.categories ?? []).includes(s.id))

  const [logDate, setLogDate]   = useState(defaultDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [logType, setLogType]   = useState(activeServices[0]?.id ?? '')
  const [logNote, setLogNote]   = useState('')
  const [saving,  setSaving]    = useState(false)
  const [quickBusy, setQuickBusy] = useState(null) // cls.id being quick-logged/unlogged
  const [noteMap, setNoteMap]   = useState({})     // {[itemId]: string} — per-item notes

  // Belt promotion form state
  const [showPromoForm, setShowPromoForm] = useState(false)
  const [promoForm, setPromoForm] = useState({ category: '', toBelt: '', notes: '' })
  const [promoSaving, setPromoSaving] = useState(false)

  function openPromoForClass(cls, svcId) {
    setPromoForm(f => ({ ...f, category: svcId, toBelt: '' }))
    setShowPromoForm(true)
  }

  // Get current belt for a category from beltHistory
  function getMemberCurrentBelt(category) {
    const history = (beltHistory ?? [])
      .filter(b => b.memberId === member.id && b.category === category)
      .sort((a, b) => new Date(b.promotedAt) - new Date(a.promotedAt))
    return history[0]?.toBelt ?? (member.belts ?? {})[category] ?? 'white'
  }

  async function handleSavePromo() {
    if (!promoForm.category || !promoForm.toBelt) return
    setPromoSaving(true)
    try {
      const fromBelt = getMemberCurrentBelt(promoForm.category)
      await addBeltPromotion(member.id, {
        category:   promoForm.category,
        fromBelt,
        toBelt:     promoForm.toBelt,
        promotedAt: logDate, // plain YYYY-MM-DD, consistent with all other dates
        notes:      promoForm.notes,
      })
      // Build note with class context
      const svc = services.find(s => s.id === promoForm.category)
      const catName = svc?.name ?? CATEGORY_LABELS[promoForm.category] ?? promoForm.category
      const matchingClass = (dayClasses ?? []).find(c => {
        const svcId = (c.serviceIds ?? (c.serviceId ? [c.serviceId] : []))[0]
        return svcId === promoForm.category
      })
      const classContext = matchingClass
        ? ` during ${matchingClass.title || catName}`
        : ''
      const noteText = `🎖 Belt promotion: ${BELT_LABELS[fromBelt]} → ${BELT_LABELS[promoForm.toBelt]} (${catName})${classContext}${promoForm.notes ? ` — ${promoForm.notes}` : ''}`
      if (addMemberNote) await addMemberNote(member.id, noteText)
      setShowPromoForm(false)
      setPromoForm({ category: '', toBelt: '', notes: '' })
    } catch (err) {
      await alertDialog(`Could not save promotion: ${typeof err === 'string' ? err : err?.message ?? 'Unknown error'}`)
    } finally {
      setPromoSaving(false)
    }
  }

  const svcColor = id => services.find(s => s.id === id)?.color ?? '#94a3b8'
  const svcName  = id => services.find(s => s.id === id)?.name  ?? id
  const sorted   = [...sessions].sort((a, b) => a.date.localeCompare(b.date))

  // Sessions on the currently selected date
  const todaySessions = sorted.filter(s => s.date === logDate)

  // Quick-log: one tap logs the class/event with optional note; tapping again removes it
  async function handleQuickLog(item, svcId, isEvent, note = '') {
    const existing = todaySessions.find(s => s.classId === item.id)
    setQuickBusy(item.id)
    try {
      if (existing) {
        await onRemoveAttendance(existing.id)
      } else {
        await onLogAttendance(member.id, logDate, svcId, note.trim(), item.id)
        // Clear note for this item after logging
        setNoteMap(m => { const n = { ...m }; delete n[item.id]; return n })
        // Only create payment when logging an event that has an extra cost
        // and no payment already exists for this event+month (prevent duplicates on toggle)
        if (isEvent && item.extraCost > 0 && onAddPayment) {
          const expectedNote = `${item.title} (event)`
          const month        = logDate.slice(0, 7)
          const alreadyPaid  = (memberPayments ?? []).some(
            p => p.memberId === member.id && p.month === month && p.note === expectedNote
          )
          if (!alreadyPaid) {
            // Await so a failed fee creation is surfaced — otherwise the
            // attendance exists but the event is silently never billed
            await onAddPayment({
              memberId: member.id,
              month,
              amount:   Number(item.extraCost),
              status:   'unpaid',
              note:     expectedNote,
            })
          }
        }
      }
    } catch (err) {
      await alertDialog(`Could not save: ${typeof err === 'string' ? err : err?.message ?? 'Unknown error'}`)
    } finally { setQuickBusy(null) }
  }

  // Manual log (for private / custom sessions)
  async function handleLog(e) {
    e.preventDefault()
    if (!logDate || !logType) return
    setSaving(true)
    try { await onLogAttendance(member.id, logDate, logType, logNote.trim(), null) }
    finally { setSaving(false); setLogNote('') }
  }

  // Scheduled classes + one-off events for this date
  const quickClasses = dayClasses ?? []
  const quickEvents  = (dayEvents ?? []).filter(ev => ev.date === logDate)

  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={<div className="flex justify-end w-full"><Button variant="secondary" size="sm" onClick={onClose}>Close</Button></div>}
    >
      <div className="space-y-4">

        {/* ── Quick attendance from scheduled classes & one-off events ── */}
        {(quickClasses.length > 0 || quickEvents.length > 0) && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 inline-block" />
              Today's Classes &amp; Events
            </p>
            <div className="flex flex-col gap-1.5">
              {quickClasses.map(cls => {
                const svcId = (cls.serviceIds ?? (cls.serviceId ? [cls.serviceId] : []))[0]
                const color = svcColor(svcId)
                const name  = svcName(svcId)
                const done  = todaySessions.some(s => s.classId === cls.id)
                const busy  = quickBusy === cls.id
                const itemNote = noteMap[cls.id] ?? ''
                const loggedSession = todaySessions.find(s => s.classId === cls.id)
                const isBeltSvc = beltServices.some(s => s.id === svcId)
                return (
                  <div key={cls.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleQuickLog(cls, svcId, false, itemNote)}
                        className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all text-left active:scale-[.98] ${
                          done ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                               : 'border-transparent hover:brightness-95'
                        }`}
                        style={done ? {} : { background: hexToRgba(color, 0.1), borderColor: hexToRgba(color, 0.35), color }}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: done ? '#10b981' : color }} />
                        <span className="flex-1">{cls.title || name} · {cls.startTime}–{cls.endTime}</span>
                        {busy ? <span className="text-gray-400">…</span>
                              : done ? <span className="text-emerald-500 text-[10px]">✓</span>
                                     : <Plus size={12} className="opacity-60" />}
                      </button>
                      {/* Award button — only shown when session is logged AND service uses belts */}
                      {done && isBeltSvc && addBeltPromotion && (
                        <button
                          type="button"
                          title="Record belt promotion for this class"
                          onClick={e => { e.stopPropagation(); openPromoForClass(cls, svcId) }}
                          className="shrink-0 w-7 h-7 flex items-center justify-center text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors border border-amber-100"
                        >
                          <Award size={13} />
                        </button>
                      )}
                    </div>
                    {/* Note input (only when not yet logged) */}
                    {!done && (
                      <input
                        type="text"
                        placeholder="Note for this session (optional)…"
                        value={itemNote}
                        onChange={e => setNoteMap(m => ({ ...m, [cls.id]: e.target.value }))}
                        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 ml-4 focus:outline-none focus:ring-1 focus:ring-primary-300 bg-gray-50 placeholder-gray-300"
                      />
                    )}
                    {/* Show saved note on already-logged session */}
                    {done && loggedSession?.note && (
                      <p className="text-[10px] text-gray-400 italic ml-4 px-1">"{loggedSession.note}"</p>
                    )}
                  </div>
                )
              })}
              {quickEvents.map(ev => {
                const svcIds = ev.serviceIds ?? (ev.serviceId ? [ev.serviceId] : [])
                const svcId  = svcIds[0] ?? ''
                const color  = svcId ? svcColor(svcId) : (ev.color ?? '#6366f1')
                const evColor = ev.color ?? color
                const done   = todaySessions.some(s => s.classId === ev.id)
                const busy   = quickBusy === ev.id
                const itemNote = noteMap[ev.id] ?? ''
                const loggedSession = todaySessions.find(s => s.classId === ev.id)
                return (
                  <div key={ev.id} className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleQuickLog(ev, svcId, true, itemNote)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all text-left active:scale-[.98] ${
                        done ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                             : 'border-transparent hover:brightness-95'
                      }`}
                      style={done ? {} : { background: hexToRgba(evColor, 0.1), borderColor: hexToRgba(evColor, 0.35), color: evColor }}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: done ? '#10b981' : evColor }} />
                      <span className="flex-1">
                        ★ {ev.title}
                        {ev.startTime && ev.endTime ? ` · ${ev.startTime}–${ev.endTime}` : ''}
                        {ev.extraCost > 0 ? ` · €${ev.extraCost}` : ''}
                      </span>
                      {busy ? <span className="text-gray-400">…</span>
                            : done ? <span className="text-emerald-500 text-[10px]">✓</span>
                                   : <Plus size={12} className="opacity-60" />}
                    </button>
                    {/* Note input (only when not yet logged) */}
                    {!done && (
                      <input
                        type="text"
                        placeholder="Note for this session (optional)…"
                        value={itemNote}
                        onChange={e => setNoteMap(m => ({ ...m, [ev.id]: e.target.value }))}
                        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 ml-4 focus:outline-none focus:ring-1 focus:ring-primary-300 bg-gray-50 placeholder-gray-300"
                      />
                    )}
                    {/* Show saved note on already-logged session */}
                    {done && loggedSession?.note && (
                      <p className="text-[10px] text-gray-400 italic ml-4 px-1">"{loggedSession.note}"</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Session list ── */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {sorted.length} session{sorted.length !== 1 ? 's' : ''}
          </p>
          {sorted.length === 0
            ? <p className="text-xs text-gray-400 py-2">No sessions logged.</p>
            : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {sorted.map(s => {
                  // If the session was logged via a scheduled class, show the class title
                  const linkedClass = s.classId ? quickClasses.find(c => c.id === s.classId) : null
                  // If not a scheduled class, check events (quick-logged via event button)
                  const linkedEvent = !linkedClass && s.classId
                    ? (allEvents ?? dayEvents ?? []).find(e => e.id === s.classId)
                    : null
                  const label = linkedClass
                    ? (linkedClass.title || svcName((linkedClass.serviceIds ?? [linkedClass.serviceId])[0]))
                    : linkedEvent
                      ? `★ ${linkedEvent.title}`
                      : svcName(s.sessionType)
                  const dotColor = linkedEvent?.color ?? svcColor(s.sessionType)
                  return (
                  <div key={s.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-gray-50">
                    <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: dotColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-700">{format(new Date(s.date), 'EEE, d MMM')}</span>
                        <span className="text-xs font-medium" style={{ color: dotColor }}>
                          {label}
                        </span>
                      </div>
                      {s.note && <p className="text-[10px] text-gray-400 italic mt-0.5 truncate">{s.note}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAttendance(s.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors ml-1 shrink-0 mt-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  )
                })}
              </div>
            )
          }
        </div>

        {/* ── Manual / Private log form ── */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <Plus size={10} className="inline mr-1" />Manual / Private Session
          </p>
          <form onSubmit={handleLog} className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input
                  type="date" value={logDate} onChange={e => setLogDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Service</label>
                <select
                  value={logType} onChange={e => setLogType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {activeServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
              <input
                type="text"
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
                placeholder="e.g. private session, injury note…"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <Button size="sm" type="submit" loading={saving} className="self-end">
              <Plus size={12} /> Log
            </Button>
          </form>
        </div>

        {/* ── Belt Promotion (only shown when member has belt-ranked categories) ── */}
        {beltServices.length > 0 && addBeltPromotion && (
          <div className="border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setShowPromoForm(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors w-full"
            >
              <Award size={12} />
              Record Belt Promotion
              <span className="ml-auto text-gray-300 text-[10px]">{showPromoForm ? '▲' : '▼'}</span>
            </button>

            {showPromoForm && (
              <div className="mt-3 space-y-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">

                {/* Category pills */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Category</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {beltServices.map(s => {
                      const isActive = promoForm.category === s.id
                      const c = s.color ?? '#94a3b8'
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setPromoForm(f => ({ ...f, category: s.id, toBelt: '' }))}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                          style={isActive
                            ? { background: c, color: 'white' }
                            : { background: c + '20', color: c }
                          }
                        >
                          {s.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* From belt preview */}
                {promoForm.category && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                    <span>From:</span>
                    <span className="flex items-center gap-1 font-medium text-gray-700">
                      <span className="w-2 h-2 rounded-full border border-gray-300"
                            style={{ background: BELT_COLORS[getMemberCurrentBelt(promoForm.category)] ?? '#ccc' }} />
                      {BELT_LABELS[getMemberCurrentBelt(promoForm.category)]}
                    </span>
                    {promoForm.toBelt && (
                      <>
                        <span className="text-gray-300">→</span>
                        <span className="flex items-center gap-1 font-semibold text-amber-700">
                          <span className="w-2 h-2 rounded-full border border-amber-200"
                                style={{ background: BELT_COLORS[promoForm.toBelt] ?? '#ccc' }} />
                          {BELT_LABELS[promoForm.toBelt]}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* To Belt pills */}
                {promoForm.category && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Promote To</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {BELTS.map(b => {
                        const isActive = promoForm.toBelt === b
                        const beltColor = BELT_COLORS[b] ?? '#ccc'
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setPromoForm(f => ({ ...f, toBelt: b }))}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                              isActive
                                ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                                : 'border-amber-100 bg-white text-gray-600 hover:border-amber-300'
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

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={promoForm.notes}
                    onChange={e => setPromoForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. competition result, instructor note…"
                    className="w-full border border-amber-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleSavePromo}
                    disabled={promoSaving || !promoForm.category || !promoForm.toBelt}
                    className="px-3 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-colors"
                  >
                    {promoSaving ? 'Saving…' : '🎖 Save Promotion'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPromoForm(false)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
