import { createContext, useContext, useState, useEffect } from 'react'

// ── Accent palettes ─────────────────────────────────────────────────────────
export const ACCENT_PALETTES = {
  orange:  { name: 'Orange',  hex: '#f97316', '50':'255 247 237', '100':'255 237 213', '400':'251 146 60',  '500':'249 115 22',  '600':'234 88 12',  '700':'194 65 12'  },
  indigo:  { name: 'Indigo',  hex: '#6366f1', '50':'238 242 255', '100':'224 231 255', '400':'129 140 248', '500':'99 102 241',  '600':'79 70 229',  '700':'67 56 202'  },
  emerald: { name: 'Emerald', hex: '#10b981', '50':'236 253 245', '100':'209 250 229', '400':'52 211 153',  '500':'16 185 129',  '600':'5 150 105',  '700':'4 120 87'   },
  rose:    { name: 'Rose',    hex: '#f43f5e', '50':'255 241 242', '100':'255 228 230', '400':'251 113 133', '500':'244 63 94',   '600':'225 29 72',  '700':'190 18 60'  },
  violet:  { name: 'Violet',  hex: '#8b5cf6', '50':'245 243 255', '100':'237 233 254', '400':'167 139 250', '500':'139 92 246',  '600':'124 58 237', '700':'109 40 217' },
  sky:     { name: 'Sky',     hex: '#0ea5e9', '50':'240 249 255', '100':'224 242 254', '400':'56 189 248',  '500':'14 165 233',  '600':'2 132 199',  '700':'3 105 161'  },
}

// ── Time & date format options ────────────────────────────────────────────────
export const TIME_FORMATS = [
  { id: 'HH:mm:ss',  label: '24h — 14:35:02' },
  { id: 'HH:mm',     label: '24h short — 14:35' },
  { id: 'hh:mm:ss a', label: '12h — 02:35:02 PM' },
  { id: 'hh:mm a',   label: '12h short — 02:35 PM' },
]

export const DATE_FORMATS = [
  { id: 'EEE, d MMM', label: 'Mon, 22 Mar' },
  { id: 'd MMMM yyyy', label: '22 March 2026' },
  { id: 'dd/MM/yyyy',  label: '22/03/2026' },
  { id: 'MM/dd/yyyy',  label: '03/22/2026' },
  { id: 'yyyy-MM-dd',  label: '2026-03-22 (ISO)' },
]

const ThemeContext = createContext()

function applyAccentVars(key) {
  const p = ACCENT_PALETTES[key]
  if (!p) return
  const r = document.documentElement
  r.style.setProperty('--primary-50',  p['50'])
  r.style.setProperty('--primary-100', p['100'])
  r.style.setProperty('--primary-400', p['400'])
  r.style.setProperty('--primary-500', p['500'])
  r.style.setProperty('--primary-600', p['600'])
  r.style.setProperty('--primary-700', p['700'])
}

export function ThemeProvider({ children }) {
  const [theme,       setThemeState]       = useState(() => localStorage.getItem('dojoTheme')       || 'light')
  const [accent,      setAccentState]      = useState(() => localStorage.getItem('dojoAccent')      || 'orange')
  const [logo,        setLogoState]        = useState(() => localStorage.getItem('dojoLogo')        || null)
  const [gymName,     setGymNameState]     = useState(() => localStorage.getItem('dojoGymName')     || 'Dojo Patras')
  const [gymSubtitle, setGymSubtitleState] = useState(() => localStorage.getItem('dojoGymSubtitle') || '管理パネル')
  const [gymFooter,   setGymFooterState]   = useState(() => localStorage.getItem('dojoGymFooter')   || '道場管理')
  const [timeFormat,  setTimeFormatState]  = useState(() => localStorage.getItem('dojoTimeFormat')  || 'HH:mm:ss')
  const [dateFormat,  setDateFormatState]  = useState(() => localStorage.getItem('dojoDateFormat')  || 'EEE, d MMM')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('dojoTheme', theme)
  }, [theme])

  useEffect(() => {
    applyAccentVars(accent)
    localStorage.setItem('dojoAccent', accent)
  }, [accent])

  // Re-apply on mount
  useEffect(() => { applyAccentVars(accent) }, []) // eslint-disable-line

  const setTheme  = t => setThemeState(t)
  const setAccent = a => setAccentState(a)

  const setLogo = dataUrl => {
    setLogoState(dataUrl)
    if (dataUrl) localStorage.setItem('dojoLogo', dataUrl)
    else         localStorage.removeItem('dojoLogo')
  }

  const make = (stateSetter, key) => val => {
    stateSetter(val)
    localStorage.setItem(key, val)
  }

  const setGymName     = make(setGymNameState,     'dojoGymName')
  const setGymSubtitle = make(setGymSubtitleState, 'dojoGymSubtitle')
  const setGymFooter   = make(setGymFooterState,   'dojoGymFooter')
  const setTimeFormat  = make(setTimeFormatState,  'dojoTimeFormat')
  const setDateFormat  = make(setDateFormatState,  'dojoDateFormat')

  return (
    <ThemeContext.Provider value={{
      theme, setTheme,
      accent, setAccent,
      logo, setLogo,
      gymName, setGymName,
      gymSubtitle, setGymSubtitle,
      gymFooter, setGymFooter,
      timeFormat, setTimeFormat,
      dateFormat, setDateFormat,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
