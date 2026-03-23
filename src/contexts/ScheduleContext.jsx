import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { getScheduleConfig, saveScheduleConfig } from '../services/sheetsService'

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const DAY_LABELS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
export const DAY_SHORT  = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

// ── Default schedule (from the dojo's timetable image) ─────────────────────────
export const DEFAULT_CLASSES = [
  // Judo Kids (5-7): Mon, Wed, Fri 17:00-17:45
  { id: 'dc_1',  day: 'mon', startTime: '17:00', endTime: '17:45', serviceId: 'judokids', title: 'Judo Kids (5-7)',        instructor: '', instructorId: null, capacity: null },
  { id: 'dc_2',  day: 'wed', startTime: '17:00', endTime: '17:45', serviceId: 'judokids', title: 'Judo Kids (5-7)',        instructor: '', instructorId: null, capacity: null },
  { id: 'dc_3',  day: 'fri', startTime: '17:00', endTime: '17:45', serviceId: 'judokids', title: 'Judo Kids (5-7)',        instructor: '', instructorId: null, capacity: null },
  // Judo Kids (8-11): Tue, Thu 17:00-18:00; Sat 16:00-17:00
  { id: 'dc_4',  day: 'tue', startTime: '17:00', endTime: '18:00', serviceId: 'judokids', title: 'Judo Kids (8-11)',       instructor: '', instructorId: null, capacity: null },
  { id: 'dc_5',  day: 'thu', startTime: '17:00', endTime: '18:00', serviceId: 'judokids', title: 'Judo Kids (8-11)',       instructor: '', instructorId: null, capacity: null },
  { id: 'dc_6',  day: 'sat', startTime: '16:00', endTime: '17:00', serviceId: 'judokids', title: 'Judo Kids (8-11)',       instructor: '', instructorId: null, capacity: null },
  // BJJ Fundamentals: Mon–Fri 18:00-19:00
  { id: 'dc_7',  day: 'mon', startTime: '18:00', endTime: '19:00', serviceId: 'bjj',      title: 'BJJ Fundamentals',      instructor: '', instructorId: null, capacity: null },
  { id: 'dc_8',  day: 'tue', startTime: '18:00', endTime: '19:00', serviceId: 'bjj',      title: 'BJJ Fundamentals',      instructor: '', instructorId: null, capacity: null },
  { id: 'dc_9',  day: 'wed', startTime: '18:00', endTime: '19:00', serviceId: 'bjj',      title: 'BJJ Fundamentals',      instructor: '', instructorId: null, capacity: null },
  { id: 'dc_10', day: 'thu', startTime: '18:00', endTime: '19:00', serviceId: 'bjj',      title: 'BJJ Fundamentals',      instructor: '', instructorId: null, capacity: null },
  { id: 'dc_11', day: 'fri', startTime: '18:00', endTime: '19:00', serviceId: 'bjj',      title: 'BJJ Fundamentals',      instructor: '', instructorId: null, capacity: null },
  // BJJ Advanced: Mon, Wed, Fri 19:00-20:15; Tue, Thu 19:00-20:00
  { id: 'dc_12', day: 'mon', startTime: '19:00', endTime: '20:15', serviceId: 'bjj',      title: 'BJJ Advanced',          instructor: '', instructorId: null, capacity: null },
  { id: 'dc_13', day: 'wed', startTime: '19:00', endTime: '20:15', serviceId: 'bjj',      title: 'BJJ Advanced',          instructor: '', instructorId: null, capacity: null },
  { id: 'dc_14', day: 'fri', startTime: '19:00', endTime: '20:15', serviceId: 'bjj',      title: 'BJJ Advanced',          instructor: '', instructorId: null, capacity: null },
  { id: 'dc_15', day: 'tue', startTime: '19:00', endTime: '20:00', serviceId: 'bjj',      title: 'BJJ Advanced',          instructor: '', instructorId: null, capacity: null },
  { id: 'dc_16', day: 'thu', startTime: '19:00', endTime: '20:00', serviceId: 'bjj',      title: 'BJJ Advanced',          instructor: '', instructorId: null, capacity: null },
  // Judo (12-14): Tue, Thu 20:00-21:00; Sat 17:00-18:00
  { id: 'dc_17', day: 'tue', startTime: '20:00', endTime: '21:00', serviceId: 'judo',     title: 'Judo (12-14)',          instructor: '', instructorId: null, capacity: null },
  { id: 'dc_18', day: 'thu', startTime: '20:00', endTime: '21:00', serviceId: 'judo',     title: 'Judo (12-14)',          instructor: '', instructorId: null, capacity: null },
  { id: 'dc_19', day: 'sat', startTime: '17:00', endTime: '18:00', serviceId: 'judo',     title: 'Judo (12-14)',          instructor: '', instructorId: null, capacity: null },
  // Judo (15+): Mon, Wed, Fri 20:15-21:15
  { id: 'dc_20', day: 'mon', startTime: '20:15', endTime: '21:15', serviceId: 'judo',     title: 'Judo (15+)',            instructor: '', instructorId: null, capacity: null },
  { id: 'dc_21', day: 'wed', startTime: '20:15', endTime: '21:15', serviceId: 'judo',     title: 'Judo (15+)',            instructor: '', instructorId: null, capacity: null },
  { id: 'dc_22', day: 'fri', startTime: '20:15', endTime: '21:15', serviceId: 'judo',     title: 'Judo (15+)',            instructor: '', instructorId: null, capacity: null },
  // Open Mat (Judo & BJJ): Sat 18:00-19:30
  { id: 'dc_23', day: 'sat', startTime: '18:00', endTime: '19:30', serviceId: 'judo',     title: 'Open Mat (Judo & BJJ)', instructor: '', instructorId: null, capacity: null },
]

const ScheduleContext = createContext(null)

export function ScheduleProvider({ children }) {
  const [classes, setClasses] = useState(DEFAULT_CLASSES)
  const [events, setEvents] = useState([])
  const [initialized, setInitialized] = useState(false)

  const classesRef = useRef(classes)
  classesRef.current = classes
  const eventsRef = useRef(events)
  eventsRef.current = events

  const saveTimer = useRef(null)

  function debouncedSave(nextClasses, nextEvents) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveScheduleConfig(JSON.stringify({ classes: nextClasses, events: nextEvents })), 500)
  }

  // On mount: load from Google Sheets
  useEffect(() => {
    async function init() {
      try {
        const json = await getScheduleConfig()
        if (json) {
          const parsed = typeof json === 'string' ? JSON.parse(json) : json
          const loadedClasses = Array.isArray(parsed.classes) ? parsed.classes : DEFAULT_CLASSES
          const loadedEvents  = Array.isArray(parsed.events)  ? parsed.events  : []
          setClasses(loadedClasses)
          setEvents(loadedEvents)
          classesRef.current = loadedClasses
          eventsRef.current  = loadedEvents
        } else {
          await saveScheduleConfig(JSON.stringify({ classes: DEFAULT_CLASSES, events: [] }))
        }
      } catch {
        // Fall back to defaults silently
      }
      setInitialized(true)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save whenever classes or events change (after initial load)
  useEffect(() => {
    if (!initialized) return
    debouncedSave(classes, events)
  }, [classes, events, initialized]) // eslint-disable-line react-hooks/exhaustive-deps

  function setClassesAndSync(updater) {
    const next = typeof updater === 'function' ? updater(classesRef.current) : updater
    classesRef.current = next
    setClasses(next)
  }

  function setEventsAndSync(updater) {
    const next = typeof updater === 'function' ? updater(eventsRef.current) : updater
    eventsRef.current = next
    setEvents(next)
  }

  const addClass = useCallback((data) => {
    const id = `cls_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    setClassesAndSync(prev => [...prev, { id, ...data }])
    return id
  }, [])

  const updateClass = useCallback((id, data) => {
    setClassesAndSync(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
  }, [])

  const removeClass = useCallback((id) => {
    setClassesAndSync(prev => prev.filter(c => c.id !== id))
  }, [])

  const resetToDefault = useCallback(() => {
    setClassesAndSync(DEFAULT_CLASSES)
  }, [])

  // ── One-off events (seminars, holidays, special sessions) ──────────────────
  const addEvent = useCallback((data) => {
    const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    setEventsAndSync(prev => [...prev, { id, ...data }])
    return id
  }, [])

  const updateEvent = useCallback((id, data) => {
    setEventsAndSync(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
  }, [])

  const removeEvent = useCallback((id) => {
    setEventsAndSync(prev => prev.filter(e => e.id !== id))
  }, [])

  return (
    <ScheduleContext.Provider value={{
      classes, addClass, updateClass, removeClass, resetToDefault,
      events, addEvent, updateEvent, removeEvent,
    }}>
      {children}
    </ScheduleContext.Provider>
  )
}

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext)
  if (!ctx) throw new Error('ScheduleProvider missing')
  return ctx
}
