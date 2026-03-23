import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, CreditCard, Activity,
  Settings, X, Layers, CalendarDays, Shield,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/members',   label: 'Members',   icon: Users },
  { path: '/payments',  label: 'Payments',  icon: CreditCard },
  { path: '/services',  label: 'Services',  icon: Layers },
  { path: '/schedule',  label: 'Schedule',  icon: CalendarDays },
  { path: '/activity',  label: 'Activity',  icon: Activity },
]

function NavItem({ path, label, icon: Icon, onClick }) {
  return (
    <NavLink
      to={path}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-primary-500/20 text-primary-400 border border-primary-500/20'
            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
        }`
      }
    >
      <Icon size={17} className="shrink-0" />
      {label}
    </NavLink>
  )
}

// Logo with priority: context logo > /logo.png > 道 kanji fallback
function DojoLogo() {
  const { logo } = useTheme()
  const [imgError, setImgError] = useState(false)

  if (logo) {
    return (
      <img
        src={logo}
        alt="Dojo Logo"
        className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
      />
    )
  }

  if (!imgError) {
    return (
      <img
        src="/logo.png"
        alt="Dojo Logo"
        className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
        onError={() => setImgError(true)}
      />
    )
  }

  // Generic fallback: shield icon
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-600/20 ring-2 ring-primary-500/30 shadow-md">
      <Shield size={20} className="text-primary-400" />
    </div>
  )
}

export default function Sidebar({ onClose }) {
  const { gymName, gymSubtitle, gymFooter } = useTheme()

  return (
    <aside
      className="w-60 shrink-0 flex flex-col h-full border-r border-white/5"
      style={{ background: 'linear-gradient(180deg, #0d1117 0%, #131a24 100%)' }}
    >
      {/* Red accent line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-red-700/60 to-transparent" />

      {/* Logo / gym name */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DojoLogo />
            <div className="min-w-0">
              <p
                className="text-sm font-bold text-white leading-tight tracking-wide truncate"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                {gymName}
              </p>
              <p className="text-xs text-gray-500 leading-tight tracking-wider truncate">{gymSubtitle}</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 lg:hidden shrink-0">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest px-3 mb-3">
          Navigation
        </p>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.path} {...item} onClick={onClose} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/5 space-y-0.5">
        <NavLink
          to="/settings"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all duration-150"
        >
          <Settings size={17} className="shrink-0" />
          Settings
        </NavLink>
        <div className="px-3 pt-2">
          <p className="text-xs text-gray-600">v0.oneAndOnly</p>
          <p className="text-xs text-gray-700 mt-0.5 truncate" style={{ fontFamily: "'Noto Serif JP', serif" }}>
            {gymFooter}
          </p>
        </div>
      </div>
    </aside>
  )
}
