import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { getServicesConfig, saveServicesConfig } from '../services/sheetsService'

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
  const [initError, setInitError] = useState(null)
  const ref = useRef(services)
  ref.current = services

  // On mount: load from Google Sheets
  useEffect(() => {
    async function init() {
      setInitError(null)
      try {
        const json = await getServicesConfig()
        if (json) {
          const parsed = typeof json === 'string' ? JSON.parse(json) : json
          const loaded = parsed.services ?? parsed
          if (Array.isArray(loaded) && loaded.length > 0) {
            setServices(loaded)
            ref.current = loaded
          } else {
            // Empty services array or missing property — initialize with defaults
            try {
              await saveServicesConfig(JSON.stringify({ services: DEFAULT_SERVICES }))
            } catch (saveErr) {
              console.error('[ServicesContext] Failed to save default services:', saveErr)
              setInitError(`Failed to save services configuration: ${typeof saveErr === 'string' ? saveErr : saveErr.message}`)
            }
          }
        } else {
          // No existing config — create new one with defaults
          try {
            await saveServicesConfig(JSON.stringify({ services: DEFAULT_SERVICES }))
          } catch (saveErr) {
            console.error('[ServicesContext] Failed to save default services on first init:', saveErr)
            setInitError(`Failed to initialize services configuration: ${typeof saveErr === 'string' ? saveErr : saveErr.message}`)
          }
        }
      } catch (err) {
        // Load failed — log error and use defaults
        const msg = typeof err === 'string' ? err : err.message ?? 'Unknown error'
        console.error('[ServicesContext] Failed to load services from Sheets:', msg, err)
        setInitError(msg)
        // Services stays as DEFAULT_SERVICES from initial useState
      }
      setInitialized(true)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save to Google Sheets whenever services change (after initial load)
  useEffect(() => {
    if (!initialized) return
    saveServicesConfig(JSON.stringify({ services }))
      .catch(err => {
        const msg = typeof err === 'string' ? err : err.message ?? 'Unknown error'
        console.error('[ServicesContext] Failed to persist services to Sheets:', msg)
        // Don't override services state on save failure; in-memory changes remain
      })
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
    setAndSync(prev => [...prev, newService])
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
    <ServicesContext.Provider value={{ services, getService, getMemberFee, updateService, addService, initialized, initError }}>
      {children}
    </ServicesContext.Provider>
  )
}

export const useServices = () => {
  const ctx = useContext(ServicesContext)
  if (!ctx) throw new Error('useServices must be used within ServicesProvider')
  return ctx
}
