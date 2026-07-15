import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { getServicesConfig, saveServicesConfig } from '../services/dataService'

export const DEFAULT_SERVICES = [
  { id: 'judo',     name: 'Judo',      description: 'Traditional Japanese martial art focusing on throws and ground work.', color: '#3b82f6', monthlyFee: 40, active: true, usesBelts: true },
  { id: 'bjj',      name: 'BJJ',       description: 'Brazilian Jiu-Jitsu — ground-based grappling and submission wrestling.', color: '#f97316', monthlyFee: 45, active: true, usesBelts: true },
  { id: 'fitness',  name: 'Fitness',   description: 'General fitness and conditioning classes for all levels.', color: '#10b981', monthlyFee: 35, active: true, usesBelts: false },
  { id: 'judokids', name: 'Judo Kids', description: 'Youth Judo program for ages 6–14. Fun, safe and educational.', color: '#a855f7', monthlyFee: 30, active: true, usesBelts: true },
]

const ServicesContext = createContext(null)

export function ServicesProvider({ children }) {
  const [services, setServices] = useState(DEFAULT_SERVICES)
  const [initialized, setInitialized] = useState(false)
  const ref = useRef(services)
  ref.current = services

  // On mount: load from the database.
  // Autosave (below) is only enabled after a successful load — a failed or
  // corrupt load must never let defaults overwrite the stored config. A fresh
  // database (no config yet) is seeded automatically by the autosave effect.
  useEffect(() => {
    async function init() {
      let json = null
      try {
        json = await getServicesConfig()
      } catch (err) {
        console.error('[ServicesContext] Failed to load services config — autosave disabled to protect stored data:', err)
        return
      }
      if (json) {
        try {
          const parsed = typeof json === 'string' ? JSON.parse(json) : json
          const loaded = parsed.services ?? parsed
          if (Array.isArray(loaded) && loaded.length > 0) {
            setServices(loaded)
            ref.current = loaded
          }
        } catch (err) {
          console.error('[ServicesContext] Stored services config is corrupt — autosave disabled to protect it:', err)
          return
        }
      }
      setInitialized(true)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save to the database whenever services change (after initial load)
  useEffect(() => {
    if (!initialized) return
    saveServicesConfig(JSON.stringify({ services }))
      .catch(err => console.error('[ServicesContext] Failed to save services config:', err))
  }, [services, initialized])

  function setAndSync(updater) {
    const next = typeof updater === 'function' ? updater(ref.current) : updater
    ref.current = next
    setServices(next)
  }

  const updateService = useCallback((id, data) => {
    setAndSync(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
  }, [])

  const addService = useCallback((data) => {
    const id = data.id ?? `svc_${Date.now()}`
    const newService = { active: true, usesBelts: false, ...data, id }
    // Upsert — re-importing an existing service id updates it instead of duplicating
    setAndSync(prev => prev.some(s => s.id === id)
      ? prev.map(s => (s.id === id ? { ...s, ...newService } : s))
      : [...prev, newService])
    return id
  }, [])

  const getService = useCallback((id) =>
    ref.current.find(s => s.id === id) ?? { id, name: id, color: '#94a3b8', monthlyFee: 0, active: true, usesBelts: false },
    []
  )

  const getMemberFee = useCallback((member) => {
    if (member.customFee != null && member.customFee > 0) return member.customFee
    return (member.categories ?? []).reduce((sum, cat) => sum + (getService(cat)?.monthlyFee ?? 0), 0)
  }, [getService])

  return (
    <ServicesContext.Provider value={{ services, getService, getMemberFee, updateService, addService }}>
      {children}
    </ServicesContext.Provider>
  )
}

export const useServices = () => {
  const ctx = useContext(ServicesContext)
  if (!ctx) throw new Error('useServices must be used within ServicesProvider')
  return ctx
}
