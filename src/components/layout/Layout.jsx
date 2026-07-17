import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw, CloudUpload, X } from 'lucide-react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MemberModal from '../MemberModal'
import { useData } from '../../contexts/DataContext'
import { isAndroid } from '../../utils/platform'

// Android is a sole device — nag every 7 days to copy a backup off it.
// "I did it" stamps localStorage; the reminder returns a week later.
const SHARE_NAG_KEY = 'dojo_backup_share_ack'
const SHARE_NAG_DAYS = 7

function BackupShareReminder() {
  const [dismissed, setDismissed] = useState(false)
  if (!isAndroid() || dismissed) return null
  const last = Number(localStorage.getItem(SHARE_NAG_KEY) || 0)
  const daysAgo = (Date.now() - last) / 86_400_000
  if (daysAgo < SHARE_NAG_DAYS) return null

  function acknowledge() {
    localStorage.setItem(SHARE_NAG_KEY, String(Date.now()))
    setDismissed(true)
  }
  return (
    <div className="mx-4 mt-3 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
      <CloudUpload size={16} className="text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-800">Ώρα για backup εκτός tablet</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Άνοιξε την εφαρμογή <strong>Files</strong> → Documents → Dojo Patras → backups και
          μοίρασε το πιο πρόσφατο αρχείο στο Gmail ή στο Drive. Αν χαθεί το tablet, τα δεδομένα σώζονται.
        </p>
      </div>
      <button
        onClick={acknowledge}
        className="shrink-0 flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 px-2 py-1.5"
      >
        <X size={12} /> Το έκανα
      </button>
    </div>
  )
}

export default function Layout() {
  const [activeCategory, setActiveCategory] = useState(
    () => localStorage.getItem('dojoCategory') || ''
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const { addMember, beltHistory, addBeltPromotion, error, retrySetup, setupLoading } = useData()

  // Persist selected category
  useEffect(() => {
    localStorage.setItem('dojoCategory', activeCategory)
  }, [activeCategory])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // ── Global keyboard shortcuts ────────────────────────────────────────────────
  // Reads from localStorage 'dojoShortcuts' on every keydown so changes in
  // Settings take effect immediately without page reload.
  useEffect(() => {
    function getShortcuts() {
      try {
        const saved = localStorage.getItem('dojoShortcuts')
        return saved ? JSON.parse(saved) : {}
      } catch { return {} }
    }

    const DEFAULTS = {
      search:    'Ctrl+K',
      dashboard: 'Ctrl+D',
      members:   'Ctrl+M',
      payments:  'Ctrl+P',
      activity:  'Ctrl+A',
      schedule:  'Ctrl+L',
      settings:  'Ctrl+;',
      new_member:'Ctrl+N',
    }

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

    function handleKeyDown(e) {
      const tag = e.target.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      const custom = getShortcuts()
      function key(id) { return custom[id] ?? DEFAULTS[id] ?? '' }

      // Search shortcut is allowed even when typing (handled by TopBar)
      if (!isTyping) {
        if (matchShortcut(e, key('new_member'))) { e.preventDefault(); setShowAddModal(true); return }
        if (matchShortcut(e, key('dashboard')))  { e.preventDefault(); navigate('/dashboard'); return }
        if (matchShortcut(e, key('members')))    { e.preventDefault(); navigate('/members');   return }
        if (matchShortcut(e, key('payments')))   { e.preventDefault(); navigate('/payments');  return }
        if (matchShortcut(e, key('activity')))   { e.preventDefault(); navigate('/activity');  return }
        if (matchShortcut(e, key('schedule')))   { e.preventDefault(); navigate('/schedule');  return }
        if (matchShortcut(e, key('settings')))   { e.preventDefault(); navigate('/settings');  return }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 lg:static lg:z-auto
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onMenuOpen={() => setSidebarOpen(true)}
          onSearchChange={setMemberSearch}
        />
        {/* Database connection error banner */}
        {error && (
          <div className="mx-4 mt-3 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-700">Database connection failed</p>
              <p className="text-xs text-red-600 mt-0.5 break-words">{error}</p>
            </div>
            <button
              onClick={retrySetup}
              disabled={setupLoading}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              <RefreshCw size={12} className={setupLoading ? 'animate-spin' : ''} />
              Retry
            </button>
          </div>
        )}
        <BackupShareReminder />
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ activeCategory, setActiveCategory, showGlobalAddMember: showAddModal, setShowGlobalAddMember: setShowAddModal, memberSearch }} />
        </main>
      </div>

      {/* Global Add Member modal (keyboard shortcut N) */}
      {showAddModal && (
        <MemberModal
          member={null}
          onClose={() => setShowAddModal(false)}
          onSave={addMember}
          addBeltPromotion={addBeltPromotion}
          existingBeltHistory={beltHistory}
        />
      )}
    </div>
  )
}
