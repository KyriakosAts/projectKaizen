import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Search, Download, Menu, X, ChevronRight, Sun, Moon, Settings2, Check } from 'lucide-react'
import { useData } from '../../contexts/DataContext'
import { useTheme, ACCENT_PALETTES } from '../../contexts/ThemeContext'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import ExportModal from '../ExportModal'
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORIES, hexToRgba } from '../../utils/helpers'
import { useServices } from '../../contexts/ServicesContext'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/members':   'Members',
  '/payments':  'Payments',
  '/activity':  'Activity',
  '/settings':  'Settings',
  '/services':  'Services',
  '/schedule':  'Schedule',
}

// ── Real-time clock ──────────────────────────────────────────────────────────
function DateTime() {
  const [now, setNow] = useState(new Date())
  const { timeFormat, dateFormat } = useTheme()
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="hidden md:flex flex-col items-end shrink-0 select-none">
      <span className="text-xs font-bold text-gray-700 tabular-nums leading-tight tracking-tight">
        {format(now, timeFormat || 'HH:mm:ss')}
      </span>
      <span className="text-xs text-gray-400 leading-tight">
        {format(now, dateFormat || 'EEE, d MMM')}
      </span>
    </div>
  )
}

// ── Settings dropdown ────────────────────────────────────────────────────────
function SettingsMenu() {
  const { theme, setTheme, accent, setAccent } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        title="Preferences"
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
          open
            ? 'bg-primary-100 text-primary-600 rotate-45'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Settings2 size={16} />
      </button>

      {open && (
        <div className="dropdown-appear absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">Preferences</p>
            <p className="text-xs text-gray-400 mt-0.5">Customize your experience</p>
          </div>

          <div className="p-4 space-y-5">
            {/* Theme */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
                Appearance
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                    theme === 'light'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Sun size={14} />
                  Light
                  {theme === 'light' && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-primary-500 rounded-full flex items-center justify-center">
                      <Check size={8} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Moon size={14} />
                  Dark
                  {theme === 'dark' && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-primary-500 rounded-full flex items-center justify-center">
                      <Check size={8} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Accent color */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
                Accent Color
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(ACCENT_PALETTES).map(([key, palette]) => (
                  <button
                    key={key}
                    onClick={() => setAccent(key)}
                    title={palette.name}
                    className={`relative w-8 h-8 rounded-full transition-all duration-150 ${
                      accent === key
                        ? 'scale-110 ring-2 ring-offset-2 ring-gray-400'
                        : 'hover:scale-110 opacity-70 hover:opacity-100'
                    }`}
                    style={{ background: palette.hex }}
                  >
                    {accent === key && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Check size={11} className="text-white" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {ACCENT_PALETTES[accent]?.name ?? 'Custom'}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">Changes apply instantly</p>
            <button
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Highlight matched text ───────────────────────────────────────────────────
function HighlightMatch({ text, query }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-primary-100 text-primary-700 rounded not-italic px-0.5 font-bold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  )
}

// ── Global member search ─────────────────────────────────────────────────────
function GlobalSearch({ onQueryChange }) {
  const [query, setQuery]             = useState('')
  const [open, setOpen]               = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const { members }  = useData()
  const { services } = useServices()
  const navigate     = useNavigate()
  const inputRef     = useRef(null)
  const containerRef = useRef(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return members.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, members])

  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Focus search via configured shortcut (default Ctrl+K)
  useEffect(() => {
    function matchShortcut(e, combo) {
      if (!combo) return false
      const parts   = combo.split('+')
      const mainKey = parts[parts.length - 1]
      return (
        (e.ctrlKey  === parts.includes('Ctrl'))  &&
        (e.shiftKey === parts.includes('Shift')) &&
        (e.altKey   === parts.includes('Alt'))   &&
        (e.metaKey  === parts.includes('Cmd'))   &&
        (e.key.toUpperCase() === mainKey.toUpperCase() || e.key === mainKey)
      )
    }
    function handleGlobalKey(e) {
      try {
        const saved    = localStorage.getItem('dojoShortcuts')
        const custom   = saved ? JSON.parse(saved) : {}
        const searchKey = custom.search ?? 'Ctrl+K'
        if (matchShortcut(e, searchKey)) {
          e.preventDefault()
          inputRef.current?.focus()
          inputRef.current?.select()
        }
      } catch {}
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [])

  function handleSelect(member) {
    navigate(`/members/${member.id}`)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => (h < results.length - 1 ? h + 1 : h))
      if (!open) setOpen(true)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => (h > 0 ? h - 1 : 0))
    } else if (e.key === 'Enter' && highlighted >= 0 && results[highlighted]) {
      e.preventDefault()
      handleSelect(results[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
      onQueryChange?.('')
    }
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
      />
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search members…"
        value={query}
        onChange={e => { setQuery(e.target.value); setHighlighted(-1); setOpen(true); onQueryChange?.(e.target.value) }}
        onFocus={() => { if (query.trim()) setOpen(true) }}
        onKeyDown={handleKeyDown}
        className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl
                   bg-gray-50 placeholder:text-gray-400
                   focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
                   focus:bg-white transition-all duration-150"
      />
      {query && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); onQueryChange?.('') }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={13} />
        </button>
      )}

      {showDropdown && (
        <div className="dropdown-appear absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl shadow-gray-200/70 z-50 overflow-hidden">
          {results.length > 0 ? (
            <>
              {results.map((member, idx) => (
                <button
                  key={member.id}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSelect(member)}
                  onMouseEnter={() => setHighlighted(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    highlighted === idx ? 'bg-primary-50' : 'hover:bg-gray-50/80'
                  } ${idx !== 0 ? 'border-t border-gray-50' : ''}`}
                >
                  <Avatar name={member.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      <HighlightMatch text={member.name} query={query} />
                    </p>
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {(member.categories ?? []).map(c => {
                        const svc = services.find(s => s.id === c)
                        const staticColors = CATEGORY_COLORS[c]
                        const label = svc?.name ?? CATEGORY_LABELS[c] ?? c
                        return (
                          <span
                            key={c}
                            className={`text-xs px-1.5 py-px rounded-md font-medium ${staticColors ? staticColors.bg + ' ' + staticColors.text : 'bg-gray-100 text-gray-600'}`}
                            style={!staticColors && svc ? { background: hexToRgba(svc.color, 0.12), color: svc.color } : {}}
                          >
                            {label}
                          </span>
                        )
                      })}
                      {member.status === 'inactive' && (
                        <span className="text-xs px-1.5 py-px rounded-md font-medium bg-gray-100 text-gray-500">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={14}
                    className={`shrink-0 transition-colors ${highlighted === idx ? 'text-primary-400' : 'text-gray-200'}`}
                  />
                </button>
              ))}
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-400 hidden sm:block">↑↓ · ↵ open · esc</p>
              </div>
            </>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-gray-500">No members found</p>
              <p className="text-xs text-gray-400 mt-1">Try first name, last name, or partial match</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sport filter pills ───────────────────────────────────────────────────────
function CategoryFilter({ value, onChange }) {
  const { services } = useServices()
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-0.5 flex-shrink-0">
      <button
        onClick={() => onChange('')}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          value === '' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        All
      </button>
      {services.filter(s => s.active).map(service => {
        const isActive = value === service.id
        return (
          <button
            key={service.id}
            onClick={() => onChange(isActive ? '' : service.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isActive ? '' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={isActive ? {
              background: hexToRgba(service.color, 0.15),
              color: service.color,
              border: '1.5px solid ' + hexToRgba(service.color, 0.4),
            } : {}}
          >
            {service.name}
          </button>
        )
      })}
    </div>
  )
}

// ── TopBar ───────────────────────────────────────────────────────────────────
export default function TopBar({ activeCategory, onCategoryChange, onMenuOpen, onSearchChange }) {
  const location = useLocation()
  const [showExport, setShowExport] = useState(false)

  const title = PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith('/members/') ? 'Member Profile' : 'Dojo Patras')

  return (
    <>
      <header className="shrink-0 bg-white border-b border-gray-200">
        {/* Main row */}
        <div className="flex items-center gap-3 px-4 md:px-5 h-14">
          {/* Mobile hamburger */}
          <button
            onClick={onMenuOpen}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu size={18} />
          </button>

          <h1 className="text-base font-bold text-gray-900 hidden sm:block shrink-0">{title}</h1>

          {/* Global search */}
          <div className="flex-1 flex justify-center px-0 sm:px-4 min-w-0">
            <GlobalSearch onQueryChange={onSearchChange} />
          </div>

          {/* Clock */}
          <DateTime />

          {/* Export — opens modal */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowExport(true)}
            className="hidden sm:flex shrink-0"
          >
            <Download size={13} />
            Export
          </Button>

          {/* Settings gear */}
          <SettingsMenu />
        </div>

        {/* Sport filter bar */}
        <div className="px-4 md:px-5 pb-2.5 overflow-x-auto">
          <CategoryFilter value={activeCategory} onChange={onCategoryChange} />
        </div>
      </header>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </>
  )
}
