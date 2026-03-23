import { useState, useMemo, useRef, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Plus, Trash2, X, Users, RefreshCw, Check,
  ChevronLeft, ChevronRight, CalendarDays, List,
} from 'lucide-react'
import {
  format, parse, addMonths, subMonths,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isToday,
} from 'date-fns'
import { useSchedule, DAYS, DAY_LABELS, DAY_SHORT } from '../contexts/ScheduleContext'
import { useServices }    from '../contexts/ServicesContext'
import { useInstructors } from '../contexts/InstructorsContext'
import { hexToRgba } from '../utils/helpers'

// Time slots 08:00 → 21:00
const TIME_SLOTS = Array.from({ length: 14 }, (_, i) => {
  const h = i + 8
  return `${String(h).padStart(2, '0')}:00`
})

// ── Helpers to normalise old single-value fields ────────────────────────────────
function getSvcIds(cls)  { return cls?.serviceIds  ?? (cls?.serviceId  ? [cls.serviceId]  : []) }
function getInsIds(cls)  { return cls?.instructorIds ?? (cls?.instructorId ? [cls.instructorId] : []) }

// ── Class Modal ─────────────────────────────────────────────────────────────────
function ClassModal({ cls, prefillDay, prefillTime, onClose, onSave, onDelete }) {
  const { services }    = useServices()
  const { instructors } = useInstructors()
  const activeServices  = services.filter(s => s.active)
  const isEdit          = !!cls

  const [form, setForm] = useState({
    title:        cls?.title        ?? '',
    day:          cls?.day          ?? prefillDay  ?? 'mon',
    startTime:    cls?.startTime    ?? prefillTime ?? '09:00',
    endTime:      cls?.endTime      ?? (() => {
      const h = parseInt(prefillTime?.slice(0, 2) ?? '9', 10)
      return `${String(Math.min(h + 1, 21)).padStart(2, '0')}:00`
    })(),
    serviceIds:   getSvcIds(cls).length > 0 ? getSvcIds(cls) : (activeServices[0] ? [activeServices[0].id] : []),
    instructorIds: getInsIds(cls),
    capacity:     cls?.capacity ?? '',
  })
  const [saving, setSaving] = useState(false)

  function set(key, val) { setForm(p => ({ ...p, [key]: val })) }

  function toggleService(id) {
    setForm(p => {
      const next = p.serviceIds.includes(id)
        ? p.serviceIds.filter(s => s !== id)
        : [...p.serviceIds, id]
      // Remove instructors whose serviceIds don't overlap with new selection
      const validIns = instructors.filter(i =>
        i.active && next.some(sid => (i.serviceIds ?? []).includes(sid))
      ).map(i => i.id)
      return { ...p, serviceIds: next, instructorIds: p.instructorIds.filter(id => validIns.includes(id)) }
    })
  }

  function toggleInstructor(id) {
    setForm(p => ({
      ...p,
      instructorIds: p.instructorIds.includes(id)
        ? p.instructorIds.filter(i => i !== id)
        : [...p.instructorIds, id],
    }))
  }

  // Instructors available for the selected services
  const availableInstructors = useMemo(() =>
    instructors.filter(i =>
      i.active && form.serviceIds.some(sid => (i.serviceIds ?? []).includes(sid))
    ),
    [instructors, form.serviceIds]
  )

  async function handleSave() {
    if (form.serviceIds.length === 0) return
    setSaving(true)
    try {
      // Build instructor name string for display
      const instructorNames = form.instructorIds
        .map(id => instructors.find(i => i.id === id)?.name)
        .filter(Boolean)
        .join(', ')

      await onSave({
        title:         form.title,
        day:           form.day,
        startTime:     form.startTime,
        endTime:       form.endTime,
        serviceIds:    form.serviceIds,
        instructorIds: form.instructorIds,
        instructor:    instructorNames,
        capacity:      form.capacity !== '' ? Number(form.capacity) : null,
        // keep single-value fields for backward compat
        serviceId:    form.serviceIds[0] ?? '',
        instructorId: form.instructorIds[0] ?? null,
      })
      onClose()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try { await onDelete(); onClose() }
    finally { setSaving(false) }
  }

  // Color accent for header — use first selected service
  const firstSvc = activeServices.find(s => s.id === form.serviceIds[0])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
          style={firstSvc ? { borderTop: `3px solid ${firstSvc.color}` } : {}}
        >
          <h2 className="text-sm font-bold text-gray-900">{isEdit ? 'Edit Class' : 'Add Class'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Class Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. BJJ Fundamentals"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              autoFocus
            />
          </div>

          {/* Day */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Day</label>
            <select
              value={form.day}
              onChange={e => set('day', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
            </select>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Start</label>
              <input
                type="time" value={form.startTime}
                onChange={e => set('startTime', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">End</label>
              <input
                type="time" value={form.endTime}
                onChange={e => set('endTime', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          {/* Services — multi-select checkboxes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Services <span className="text-gray-400 font-normal">(select one or more)</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {activeServices.map(svc => {
                const selected = form.serviceIds.includes(svc.id)
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => toggleService(svc.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all text-left ${
                      selected ? 'border-transparent' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                    }`}
                    style={selected ? {
                      background: hexToRgba(svc.color, 0.12),
                      borderColor: hexToRgba(svc.color, 0.4),
                      color: svc.color,
                    } : {}}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: svc.color }} />
                    {svc.name}
                    {selected && <Check size={10} className="ml-auto" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
            {form.serviceIds.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Select at least one service</p>
            )}
          </div>

          {/* Instructors — multi-select */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Instructors <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            {availableInstructors.length > 0 ? (
              <div className="flex flex-col gap-1">
                {availableInstructors.map(ins => {
                  const selected = form.instructorIds.includes(ins.id)
                  return (
                    <button
                      key={ins.id}
                      type="button"
                      onClick={() => toggleInstructor(ins.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left ${
                        selected
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'border-gray-100 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full border-2 shrink-0 ${selected ? 'bg-primary-500 border-primary-500' : 'border-gray-300'}`} />
                      {ins.name}
                      {selected && <Check size={10} className="ml-auto text-primary-500" strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-1.5 px-3 bg-gray-50 rounded-xl">
                No instructors linked to the selected service{form.serviceIds.length > 1 ? 's' : ''}.{' '}
                <a href="/services" className="text-primary-600 hover:underline">Add in Services → Instructors</a>
              </p>
            )}
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Capacity <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number" min={1} value={form.capacity}
                onChange={e => set('capacity', e.target.value)}
                placeholder="Unlimited"
                className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50">
          <div>
            {isEdit && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || form.serviceIds.length === 0}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isEdit ? 'Save Changes' : 'Add Class'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Class card ──────────────────────────────────────────────────────────────────
function ClassCard({ cls, services, instructors, onClick, onDelete, onDragStart }) {
  const svcIds = getSvcIds(cls)
  const insIds = getInsIds(cls)
  const svcs   = svcIds.map(id => services.find(s => s.id === id)).filter(Boolean)
  const ins    = insIds.map(id => instructors.find(i => i.id === id)).filter(Boolean)

  if (svcs.length === 0) return null

  // Use first service for card color
  const primary = svcs[0]

  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(e, cls.id) }}
      onClick={e => { e.stopPropagation(); onClick() }}
      className="cursor-grab active:cursor-grabbing relative group/card rounded-lg px-2 py-1.5 mb-1 last:mb-0 transition-all hover:brightness-95 select-none"
      style={{ background: hexToRgba(primary.color, 0.1), borderLeft: `3px solid ${primary.color}` }}
    >
      {/* Inline delete button */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete(cls.id) }}
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-500 text-gray-300 z-10"
        title="Delete class"
      >
        <X size={9} />
      </button>
      <p className="text-xs font-bold truncate pr-4" style={{ color: primary.color }}>
        {cls.title || svcs.map(s => s.name).join(' + ')}
      </p>
      <p className="text-xs text-gray-500 truncate">{cls.startTime}–{cls.endTime}</p>
      {/* Service chips (only if multiple) */}
      {svcs.length > 1 && (
        <div className="flex gap-0.5 mt-0.5 flex-wrap">
          {svcs.map(s => (
            <span
              key={s.id}
              className="text-[9px] px-1 py-px rounded font-semibold"
              style={{ background: hexToRgba(s.color, 0.15), color: s.color }}
            >
              {s.name}
            </span>
          ))}
        </div>
      )}
      {ins.length > 0 && (
        <p className="text-xs text-gray-400 truncate">{ins.map(i => i.name).join(', ')}</p>
      )}
      {cls.capacity && (
        <p className="text-xs text-gray-400 flex items-center gap-0.5">
          <Users size={9} /> {cls.capacity}
        </p>
      )}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const { classes, addClass, updateClass, removeClass, resetToDefault, events, addEvent, updateEvent, removeEvent } = useSchedule()
  const { services }    = useServices()
  const { instructors } = useInstructors()
  const activeServices  = services.filter(s => s.active)

  const { activeCategory } = useOutletContext() ?? {}

  const [modal,         setModal]         = useState(null)
  const [schedView,     setSchedView]     = useState('weekly') // 'weekly' | 'monthly'
  const [eventModal,    setEventModal]    = useState(null)     // { mode:'add'|'edit', date?, event? }
  const [dragOverKey,   setDragOverKey]   = useState(null)
  const dragIdRef    = useRef(null)   // id being dragged
  const dragShiftRef = useRef(false)  // was Shift held at drag start?

  const handleDragStart = useCallback((e, clsId) => {
    dragIdRef.current    = clsId
    dragShiftRef.current = e.shiftKey
    e.dataTransfer.effectAllowed = e.shiftKey ? 'copy' : 'move'
  }, [])

  const handleDrop = useCallback((e, day, time) => {
    e.preventDefault()
    setDragOverKey(null)
    const id    = dragIdRef.current
    // honour Shift held either at drag-start OR at drop
    const clone = dragShiftRef.current || e.shiftKey
    dragIdRef.current    = null
    dragShiftRef.current = false
    if (!id) return
    const cls = classes.find(c => c.id === id)
    if (!cls) return
    const origStart = parseInt(cls.startTime.slice(0, 2), 10)
    const origEnd   = parseInt(cls.endTime.slice(0, 2), 10)
    const dur       = origEnd - origStart
    const h         = parseInt(time.slice(0, 2), 10)
    const newEnd    = `${String(Math.min(h + Math.max(dur, 1), 22)).padStart(2, '0')}:00`
    if (clone) {
      // Shift+drag → clone into the new slot, keep original in place
      const { id: _id, ...rest } = cls
      addClass({ ...rest, day, startTime: time, endTime: newEnd })
    } else {
      updateClass(id, { day, startTime: time, endTime: newEnd })
    }
  }, [classes, addClass, updateClass])

  function handleDeleteInline(id) {
    removeClass(id)
  }

  function handleSaveEvent(data) {
    if (eventModal?.mode === 'edit') updateEvent(eventModal.event.id, data)
    else addEvent(data)
    setEventModal(null)
  }

  function handleDeleteEvent() {
    if (eventModal?.event) removeEvent(eventModal.event.id)
    setEventModal(null)
  }

  // Build grid: floor start time to HH:00 for display row
  const classGrid = useMemo(() => {
    const map = {}
    DAYS.forEach(day => { TIME_SLOTS.forEach(time => { map[`${day}:${time}`] = [] }) })
    classes.forEach(cls => {
      const hourStr = cls.startTime?.slice(0, 2)
      const hourKey = `${String(hourStr).padStart(2, '0')}:00`
      const key     = `${cls.day}:${hourKey}`
      if (map[key] !== undefined) map[key].push(cls)
      else { if (!map[key]) map[key] = []; map[key].push(cls) }
    })
    return map
  }, [classes])

  const dayCounts = useMemo(() => {
    const c = {}
    DAYS.forEach(d => { c[d] = classes.filter(cl => cl.day === d).length })
    return c
  }, [classes])

  const scheduledServices = useMemo(() => {
    const ids = new Set(classes.flatMap(c => getSvcIds(c)))
    return activeServices.filter(s => ids.has(s.id))
  }, [classes, activeServices])

  // Filtered classes based on global activeCategory
  const filteredClasses = useMemo(() =>
    activeCategory
      ? classes.filter(c => getSvcIds(c).includes(activeCategory))
      : classes,
    [classes, activeCategory]
  )

  const filteredClassGrid = useMemo(() => {
    const map = {}
    DAYS.forEach(day => { TIME_SLOTS.forEach(time => { map[`${day}:${time}`] = [] }) })
    filteredClasses.forEach(cls => {
      const hourStr = cls.startTime?.slice(0, 2)
      const hourKey = `${String(hourStr).padStart(2, '0')}:00`
      const key     = `${cls.day}:${hourKey}`
      if (map[key] !== undefined) map[key].push(cls)
      else { if (!map[key]) map[key] = []; map[key].push(cls) }
    })
    return map
  }, [filteredClasses])

  function handleSave(data) {
    if (modal?.mode === 'edit') updateClass(modal.cls.id, data)
    else addClass(data)
  }

  function handleDelete() {
    if (modal?.mode === 'edit') removeClass(modal.cls.id)
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {schedView === 'weekly' ? 'Weekly Schedule' : 'Monthly Schedule'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {schedView === 'weekly'
              ? `${classes.length} class${classes.length !== 1 ? 'es' : ''} · Shift+drag to clone`
              : `${events.length} event${events.length !== 1 ? 's' : ''} · click a day to add`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-xl p-0.5 gap-0.5">
            <button
              onClick={() => setSchedView('weekly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${schedView === 'weekly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List size={12} /> Weekly
            </button>
            <button
              onClick={() => setSchedView('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${schedView === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CalendarDays size={12} /> Monthly
            </button>
          </div>
          {schedView === 'weekly' && (
            <>
              <button
                onClick={() => { if (window.confirm('Reset schedule to the default timetable?')) resetToDefault() }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <RefreshCw size={12} /> Reset
              </button>
              <button
                onClick={() => setModal({ mode: 'add', day: 'mon', time: '09:00' })}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <Plus size={13} /> Add Class
              </button>
            </>
          )}
          <button
            onClick={() => setEventModal({ mode: 'add', date: format(new Date(), 'yyyy-MM-dd') })}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-sm"
          >
            <Plus size={13} /> Add Event
          </button>
        </div>
      </div>


      {/* Monthly view */}
      {schedView === 'monthly' && (
        <MonthlyScheduleView
          classes={filteredClasses}
          events={events}
          services={services}
          setEventModal={setEventModal}
        />
      )}

      {/* Weekly view (conditionally rendered) */}
      {schedView !== 'monthly' && (<>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 720 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-left border-r border-gray-100" style={{ width: 72 }}>
                  Time
                </th>
                {DAYS.map(day => (
                  <th key={day} className="px-2 py-3 text-xs font-bold text-gray-600 text-center border-r border-gray-100 last:border-r-0" style={{ minWidth: 110 }}>
                    {DAY_SHORT[day]}
                    {dayCounts[day] > 0 && (
                      <span className="ml-1 text-xs text-gray-400 font-normal">({dayCounts[day]})</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((time, rowIdx) => (
                <tr key={time} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                  <td className="sticky left-0 z-10 px-3 py-2 text-xs font-semibold text-gray-400 border-r border-gray-100 bg-inherit align-top whitespace-nowrap">
                    {time}
                  </td>
                  {DAYS.map(day => {
                    const cellClasses = filteredClassGrid[`${day}:${time}`] ?? []
                    return (
                      <td
                        key={day}
                        className={`px-1.5 py-1.5 border-r border-gray-100 last:border-r-0 align-top group transition-colors ${dragOverKey === `${day}:${time}` ? 'bg-primary-50 ring-1 ring-inset ring-primary-300' : ''}`}
                        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(`${day}:${time}`) }}
                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverKey(null) }}
                        onDrop={e => handleDrop(e, day, time)}
                      >
                        {cellClasses.map(cls => (
                          <ClassCard
                            key={cls.id}
                            cls={cls}
                            services={services}
                            instructors={instructors}
                            onClick={() => setModal({ mode: 'edit', cls })}
                            onDelete={handleDeleteInline}
                            onDragStart={handleDragStart}
                          />
                        ))}
                        <div
                          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center py-1"
                          onClick={() => setModal({ mode: 'add', day, time })}
                        >
                          <Plus size={11} className="text-gray-300 hover:text-primary-400 transition-colors" />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-start gap-6 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Classes per day</p>
            <div className="flex gap-3 flex-wrap">
              {DAYS.map(day => (
                <div key={day} className="text-center">
                  <p className="text-xs font-bold text-gray-900">{dayCounts[day]}</p>
                  <p className="text-xs text-gray-400">{DAY_SHORT[day]}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="w-px bg-gray-100 self-stretch hidden sm:block" />
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Weekly total</p>
            <p className="text-lg font-bold text-gray-900">{classes.length} <span className="text-sm font-normal text-gray-400">sessions</span></p>
          </div>
          {scheduledServices.length > 0 && (
            <>
              <div className="w-px bg-gray-100 self-stretch hidden sm:block" />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Services</p>
                <div className="flex gap-2 flex-wrap">
                  {scheduledServices.map(svc => (
                    <span key={svc.id} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: hexToRgba(svc.color, 0.12), color: svc.color }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: svc.color }} />
                      {svc.name}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {modal && (
        <ClassModal
          cls={modal.mode === 'edit' ? modal.cls : null}
          prefillDay={modal.mode === 'add' ? modal.day : undefined}
          prefillTime={modal.mode === 'add' ? modal.time : undefined}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
      </>)}

      {/* Events list — visible in weekly view so you can review / edit events without switching to monthly */}
      {schedView === 'weekly' && events.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            One-off Events <span className="font-normal normal-case text-gray-400">· click to edit</span>
          </p>
          <div className="space-y-1">
            {[...events].sort((a, b) => a.date.localeCompare(b.date)).map(ev => {
              const evSvcIds = ev.serviceIds ?? (ev.serviceId ? [ev.serviceId] : [])
              const evSvcs   = evSvcIds.map(id => activeServices.find(s => s.id === id)).filter(Boolean)
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setEventModal({ mode: 'edit', event: ev })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ev.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{ev.title}</p>
                    <p className="text-[10px] text-gray-400">
                      {ev.startTime && ev.endTime ? `${ev.startTime}–${ev.endTime} · ` : ''}
                      {format(new Date(ev.date + 'T12:00:00'), 'd MMM yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
                    {evSvcs.map(s => (
                      <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: hexToRgba(s.color, 0.12), color: s.color }}>
                        {s.name}
                      </span>
                    ))}
                    {ev.extraCost > 0 && <span className="text-[10px] text-amber-600 font-semibold">€{ev.extraCost}</span>}
                    <span className="text-[10px] text-gray-400 capitalize">{ev.type}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* EventModal — shared between weekly and monthly views */}
      {eventModal && (
        <EventModal
          event={eventModal.mode === 'edit' ? eventModal.event : null}
          date={eventModal.date}
          onClose={() => setEventModal(null)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}
    </div>
  )
}

// ── Event Modal (add / edit one-off events) ──────────────────────────────────
const EVENT_TYPES  = ['seminar', 'event', 'other']
const PRESET_COLORS = ['#6366f1','#f59e0b','#22c55e','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316']

function EventModal({ event, date, onClose, onSave, onDelete }) {
  const isEdit = !!event
  const { services } = useServices()
  const activeServices = services.filter(s => s.active)

  const [form, setForm] = useState({
    title:      event?.title      ?? '',
    date:       event?.date       ?? date ?? format(new Date(), 'yyyy-MM-dd'),
    startTime:  event?.startTime  ?? '09:00',
    endTime:    event?.endTime    ?? '10:00',
    serviceIds: event?.serviceIds ?? (event?.serviceId ? [event.serviceId] : []),
    type:       event?.type       ?? 'event',
    color:      event?.color      ?? '#6366f1',
    notes:      event?.notes      ?? '',
    extraCost:  event?.extraCost != null ? String(event.extraCost) : '',
  })
  const [saving, setSaving] = useState(false)

  function toggleService(id) {
    setForm(p => {
      const curr = p.serviceIds ?? []
      return { ...p, serviceIds: curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id] }
    })
  }

  function handleStartChange(val) {
    if (form.endTime <= val) {
      const [h, m] = val.split(':').map(Number)
      const newEndH = Math.min(h + 1, 23)
      const newEnd = `${String(newEndH).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`
      setForm(f => ({ ...f, startTime: val, endTime: newEnd }))
    } else {
      setForm(f => ({ ...f, startTime: val }))
    }
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const toSave = {
      ...form,
      extraCost: form.extraCost !== '' && !isNaN(Number(form.extraCost)) ? Number(form.extraCost) : null,
    }
    try { await onSave(toSave); onClose() } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
          style={{ borderTop: `3px solid ${form.color}` }}
        >
          <h2 className="text-sm font-bold text-gray-900">{isEdit ? 'Edit Event' : 'Add Event'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Title</label>
            <input
              autoFocus
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Summer Seminar…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Start</label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => handleStartChange(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">End</label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          {/* Services — multi-select, same pattern as ClassModal */}
          {activeServices.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Services <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {activeServices.map(s => {
                  const on = (form.serviceIds ?? []).includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all"
                      style={on
                        ? { background: hexToRgba(s.color, 0.15), borderColor: s.color, color: s.color }
                        : { background: 'transparent', borderColor: '#e5e7eb', color: '#6b7280' }
                      }
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: on ? s.color : '#d1d5db' }} />
                      {s.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Type</label>
            <div className="flex gap-1.5 flex-wrap">
              {EVENT_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 capitalize transition-all ${form.type === t ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:border-gray-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional details…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {/* Extra Cost */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Extra Cost (optional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">€</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.extraCost}
                onChange={e => setForm(f => ({ ...f, extraCost: e.target.value }))}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Creates a payment request when attendance is logged for this event.</p>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/60">
          {isEdit
            ? <button onClick={onDelete} className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors">Delete</button>
            : <div />
          }
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors disabled:opacity-40"
            >
              {saving ? '…' : (isEdit ? 'Save' : 'Add Event')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Monthly Schedule View ─────────────────────────────────────────────────────
function MonthlyScheduleView({ classes, events, services, setEventModal }) {
  const [currentMonth, setCurrentMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [hoverPopup, setHoverPopup]     = useState(null) // { rect, recurring, dayEvents, dateStr }
  const monthDate  = parse(currentMonth, 'yyyy-MM', new Date())
  const calStart   = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 })
  const calEnd     = endOfWeek(endOfMonth(monthDate),     { weekStartsOn: 1 })
  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd })
  const DAY_HEADERS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  // Group events by date string
  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach(ev => {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    })
    return map
  }, [events])

  // Get recurring weekly classes for a given date
  function classesForDate(date) {
    const dk = format(date, 'EEE').toLowerCase()
    return classes.filter(c => c.day === dk)
  }

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentMonth(format(subMonths(monthDate, 1), 'yyyy-MM'))}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-gray-900 min-w-36 text-center">
          {format(monthDate, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentMonth(format(addMonths(monthDate, 1), 'yyyy-MM'))}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setCurrentMonth(format(new Date(), 'yyyy-MM'))}
          className="ml-1 px-2.5 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors border border-primary-100"
        >
          Today
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_HEADERS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wide border-r border-gray-100 last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calDays.map((date, idx) => {
            const dateStr   = format(date, 'yyyy-MM-dd')
            const inMonth   = format(date, 'yyyy-MM') === currentMonth
            const today     = isToday(date)
            const recurring = classesForDate(date)
            const dayEvents = eventsByDate[dateStr] ?? []
            const isWeekend = idx % 7 >= 5

            const totalItems = recurring.length + dayEvents.length
            const showHoverHint = inMonth && totalItems > 3

            return (
              <div
                key={dateStr}
                onClick={() => inMonth && setEventModal({ mode: 'add', date: dateStr })}
                onMouseEnter={e => {
                  if (!inMonth || totalItems === 0) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  setHoverPopup({ rect, recurring, dayEvents, dateStr })
                }}
                onMouseLeave={() => setHoverPopup(null)}
                className={`min-h-[110px] p-1.5 border-b border-r border-gray-100 last:border-r-0 transition-colors cursor-pointer relative
                  ${inMonth ? 'bg-white hover:bg-primary-50/20' : 'bg-gray-50/60 cursor-default'}
                  ${isWeekend && inMonth ? 'bg-slate-50/30' : ''}
                  ${today ? 'ring-1 ring-inset ring-primary-300' : ''}`}
              >
                {/* Date number */}
                <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-1 ${
                  today ? 'bg-primary-500 text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {format(date, 'd')}
                </div>

                {/* Recurring classes (show first 2, rest hidden behind hover) */}
                {inMonth && recurring.slice(0, 2).map(cls => {
                  const svcId = (cls.serviceIds?.[0] ?? cls.serviceId)
                  const svc   = services.find(s => s.id === svcId)
                  const color = svc?.color ?? '#94a3b8'
                  return (
                    <div
                      key={cls.id}
                      className="text-[9px] font-medium px-1 py-0.5 rounded mb-0.5 truncate leading-tight"
                      style={{ background: hexToRgba(color, 0.12), color }}
                      onClick={e => e.stopPropagation()}
                    >
                      {cls.startTime} {cls.title || svc?.name}
                    </div>
                  )
                })}

                {/* One-off events (bold, highlighted) — show first 1 if classes are shown */}
                {dayEvents.slice(0, recurring.length > 0 ? 1 : 2).map(ev => (
                  <div
                    key={ev.id}
                    onClick={e => { e.stopPropagation(); setEventModal({ mode: 'edit', event: ev }) }}
                    className="text-[10px] font-bold px-1.5 py-1 rounded-lg mb-0.5 truncate cursor-pointer hover:brightness-95 transition-all mt-0.5 leading-tight border"
                    style={{
                      background:   hexToRgba(ev.color, 0.15),
                      color:        ev.color,
                      borderColor:  hexToRgba(ev.color, 0.35),
                    }}
                    title={ev.notes || ev.title}
                  >
                    {ev.title}
                  </div>
                ))}

                {/* "More" hint */}
                {showHoverHint && totalItems > 3 && (
                  <div className="text-[9px] text-gray-400 px-1 mt-0.5" onClick={e => e.stopPropagation()}>
                    +{totalItems - 3} more · hover
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded bg-blue-200 opacity-70" /> Recurring classes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-lg border border-indigo-300 bg-indigo-100" /> One-off events
        </span>
        <span className="text-gray-400 ml-auto">Click any day to add an event</span>
      </div>

      {/* Hover popup — shows ALL classes & events for the day */}
      {hoverPopup && (() => {
        const { rect, recurring: hRec, dayEvents: hEvts } = hoverPopup
        const hasAnything = hRec.length > 0 || hEvts.length > 0
        if (!hasAnything) return null
        // Position: below the cell, but flip up if too close to bottom
        const popupH = Math.min(hRec.length + hEvts.length, 20) * 26 + 40
        const spaceBelow = window.innerHeight - rect.bottom
        const topPos = spaceBelow > popupH + 8 ? rect.bottom + 4 : rect.top - popupH - 4
        const leftPos = Math.min(Math.max(rect.left, 4), window.innerWidth - 220)
        return (
          <div
            className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-52 pointer-events-none"
            style={{ top: topPos, left: leftPos }}
          >
            {hRec.length > 0 && (
              <>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Classes</p>
                <div className="space-y-0.5 mb-2">
                  {hRec.map(cls => {
                    const svcId = (cls.serviceIds?.[0] ?? cls.serviceId)
                    const svc   = services.find(s => s.id === svcId)
                    const color = svc?.color ?? '#94a3b8'
                    return (
                      <div
                        key={cls.id}
                        className="text-[10px] font-medium px-1.5 py-1 rounded truncate"
                        style={{ background: hexToRgba(color, 0.12), color }}
                      >
                        {cls.startTime}–{cls.endTime} · {cls.title || svc?.name}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            {hEvts.length > 0 && (
              <>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Events</p>
                <div className="space-y-0.5">
                  {hEvts.map(ev => {
                    const evSvcIds = ev.serviceIds ?? (ev.serviceId ? [ev.serviceId] : [])
                    return (
                      <div
                        key={ev.id}
                        className="text-[10px] font-bold px-1.5 py-1 rounded-lg border"
                        style={{ background: hexToRgba(ev.color, 0.15), color: ev.color, borderColor: hexToRgba(ev.color, 0.35) }}
                      >
                        <span className="block truncate">
                          {ev.startTime && ev.endTime ? `${ev.startTime}–${ev.endTime} · ` : ''}
                          {ev.title}
                        </span>
                        {ev.extraCost > 0 && <span className="text-[9px] opacity-80">€{ev.extraCost}</span>}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}
