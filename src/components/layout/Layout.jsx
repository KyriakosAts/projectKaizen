import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MemberModal from '../MemberModal'
import { useData } from '../../contexts/DataContext'

export default function Layout() {
  const [activeCategory, setActiveCategory] = useState(
    () => localStorage.getItem('dojoCategory') || ''
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const { addMember, beltHistory, addBeltPromotion } = useData()

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
