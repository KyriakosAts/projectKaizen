import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { getInstructorsConfig, saveInstructorsConfig } from '../services/sheetsService'

const InstructorsContext = createContext(null)

export function InstructorsProvider({ children }) {
  const [instructors, setInstructors] = useState([])
  const [initialized, setInitialized] = useState(false)
  const ref = useRef(instructors)
  ref.current = instructors

  // On mount: load from Google Sheets
  useEffect(() => {
    async function init() {
      try {
        const json = await getInstructorsConfig()
        if (json) {
          const parsed = typeof json === 'string' ? JSON.parse(json) : json
          const loaded = parsed.instructors ?? parsed
          if (Array.isArray(loaded)) {
            setInstructors(loaded)
            ref.current = loaded
          }
        } else {
          await saveInstructorsConfig(JSON.stringify({ instructors: [] }))
        }
      } catch {
        // Fall back to empty list silently
      }
      setInitialized(true)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save to Google Sheets whenever instructors change (after initial load)
  useEffect(() => {
    if (!initialized) return
    saveInstructorsConfig(JSON.stringify({ instructors }))
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
