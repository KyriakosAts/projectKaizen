import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { getInstructorsConfig, saveInstructorsConfig } from '../services/dataService'

const InstructorsContext = createContext(null)

export function InstructorsProvider({ children }) {
  const [instructors, setInstructors] = useState([])
  const [initialized, setInitialized] = useState(false)
  const ref = useRef(instructors)
  ref.current = instructors

  // On mount: load from the database.
  // Autosave (below) is only enabled after a successful load — a failed or
  // corrupt load must never let defaults overwrite the stored config. A fresh
  // database (no config yet) is seeded automatically by the autosave effect.
  useEffect(() => {
    async function init() {
      let json = null
      try {
        json = await getInstructorsConfig()
      } catch (err) {
        console.error('[InstructorsContext] Failed to load instructors config — autosave disabled to protect stored data:', err)
        return
      }
      if (json) {
        try {
          const parsed = typeof json === 'string' ? JSON.parse(json) : json
          const loaded = parsed.instructors ?? parsed
          if (Array.isArray(loaded)) {
            setInstructors(loaded)
            ref.current = loaded
          }
        } catch (err) {
          console.error('[InstructorsContext] Stored instructors config is corrupt — autosave disabled to protect it:', err)
          return
        }
      }
      setInitialized(true)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save to the database whenever instructors change (after initial load)
  useEffect(() => {
    if (!initialized) return
    saveInstructorsConfig(JSON.stringify({ instructors }))
      .catch(err => console.error('[InstructorsContext] Failed to save instructors config:', err))
  }, [instructors, initialized])

  function setAndSync(updater) {
    const next = typeof updater === 'function' ? updater(ref.current) : updater
    ref.current = next
    setInstructors(next)
  }

  const addInstructor = useCallback((data) => {
    const id = `ins_${Date.now()}`
    const newIns = { id, active: true, serviceIds: [], ...data }
    setAndSync(prev => [...prev, newIns])
    return id
  }, [])

  const updateInstructor = useCallback((id, data) => {
    setAndSync(prev => prev.map(i => i.id === id ? { ...i, ...data } : i))
  }, [])

  const removeInstructor = useCallback((id) => {
    setAndSync(prev => prev.filter(i => i.id !== id))
  }, [])

  return (
    <InstructorsContext.Provider value={{ instructors, addInstructor, updateInstructor, removeInstructor }}>
      {children}
    </InstructorsContext.Provider>
  )
}

export const useInstructors = () => {
  const ctx = useContext(InstructorsContext)
  if (!ctx) throw new Error('useInstructors must be used within InstructorsProvider')
  return ctx
}
