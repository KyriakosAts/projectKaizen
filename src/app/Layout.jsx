import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  House, Users, Table2, GraduationCap, ChartColumn, Settings, Plus, CloudUpload, X, AlertTriangle, RefreshCw, Lock,
} from 'lucide-react'
import { useData } from '../data/DataContext.jsx'
import { monthOf } from '../data/dates.js'
import { isAndroid } from '../utils/platform.js'
import PaymentSheet from './PaymentSheet.jsx'
import { LockScreen } from './Lock.jsx'
import { exportExcel } from './exportExcel.js'
import { Button, Toaster, toast, cx } from './ui.jsx'

const LOCKED_PATHS = ['/stats', '/settings']

/**
 * Monthly Excel on a chosen day (e.g. every 16th). The app can't run while
 * closed, so it happens on the first opening on/after that day.
 */
function useMonthlyExport() {
  const data = useData()
  const { loading, fatal, settings, today, saveSettings } = data
  const running = useRef(false)
  useEffect(() => {
    const day = settings.autoExportDay
    const month = monthOf(today)
    if (loading || fatal || !day || running.current) return
    if (Number(today.slice(8)) < day || settings.lastAutoExport === month) return
    running.current = true
    exportExcel({ ...data, name: `dojo-patras-${today}-mhniaio.xlsx` })
      .then(() => saveSettings({ lastAutoExport: month }))
      .then(() => toast('Το μηνιαίο Excel αποθηκεύτηκε'))
      .catch(err => console.error('[monthly export]', err))
      .finally(() => { running.current = false })
  }, [loading, fatal, settings.autoExportDay, settings.lastAutoExport, today]) // eslint-disable-line react-hooks/exhaustive-deps
}

export const NAV = [
  { to: '/',          label: 'Σήμερα',     icon: House, end: true },
  { to: '/members',   label: 'Μέλη',       icon: Users },
  { to: '/grid',      label: 'Πληρωμές',   icon: Table2 },
  { to: '/seminars',  label: 'Σεμινάρια',  icon: GraduationCap },
  { to: '/stats',     label: 'Στατιστικά', icon: ChartColumn },
]

function Logo({ settings, size = 44 }) {
  if (settings.logo) {
    return <img src={settings.logo} alt="" className="rounded-xl object-cover bg-white" style={{ width: size, height: size }} />
  }
  return (
    <span className="inline-flex items-center justify-center rounded-xl bg-white text-ink font-black" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {String(settings.gymName ?? 'D').trim().charAt(0).toUpperCase()}
    </span>
  )
}

function RailLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cx(
        'flex flex-col items-center justify-center gap-1 w-full py-3 rounded-2xl text-[13px] font-semibold transition-colors',
        isActive ? 'bg-white text-ink' : 'text-stone-300 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon size={24} strokeWidth={2} />
      {label}
    </NavLink>
  )
}

// Android: the tablet is the only device — remind weekly to copy a backup off it
const SHARE_KEY = 'dojo_backup_share_ack'
function BackupReminder() {
  const [hidden, setHidden] = useState(false)
  if (!isAndroid() || hidden) return null
  let last = 0
  try { last = Number(localStorage.getItem(SHARE_KEY) || 0) } catch { /* private storage */ }
  if ((Date.now() - last) / 86_400_000 < 7) return null
  const ack = () => {
    try { localStorage.setItem(SHARE_KEY, String(Date.now())) } catch { /* ignore */ }
    setHidden(true)
  }
  return (
    <Banner tone="amber" icon={CloudUpload} onClose={ack} closeLabel="Το έκανα">
      <b>Ώρα για αντίγραφο εκτός tablet.</b> Άνοιξε την εφαρμογή <b>Files</b> → Documents → Dojo Patras → backups
      και στείλε το πιο πρόσφατο αρχείο στο Gmail ή στο Drive σου.
    </Banner>
  )
}

function Banner({ tone, icon: Icon, children, onClose, closeLabel }) {
  const tones = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    sky: 'bg-sky-50 border-sky-200 text-sky-900',
  }
  return (
    <div className={cx('flex items-start gap-3 border rounded-2xl px-4 py-3 mb-5', tones[tone])}>
      <Icon size={20} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 whitespace-pre-line">{children}</div>
      <button type="button" onClick={onClose} className="shrink-0 flex items-center gap-1 font-semibold h-9 px-2 rounded-lg hover:bg-black/5">
        <X size={16} /> {closeLabel}
      </button>
    </div>
  )
}

export default function Layout() {
  const { settings, loading, fatal, notice, dismissNotice, reload } = useData()
  const [paying, setPaying] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const location = useLocation()
  useMonthlyExport()

  // Lock again whenever the tablet sleeps or the app goes to the background
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') setUnlocked(false) }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  const lock = settings.pin
  const wholeAppLocked = Boolean(lock?.lockAll) && !unlocked && !loading
  const pageLocked = Boolean(lock) && !unlocked && LOCKED_PATHS.some(p => location.pathname.startsWith(p))

  if (fatal) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle size={40} className="mx-auto text-rose-500" />
          <h1 className="text-xl font-bold">Η εφαρμογή δεν μπόρεσε να ανοίξει τα δεδομένα</h1>
          <p className="text-stone-600 break-words">{fatal}</p>
          <Button variant="primary" icon={RefreshCw} onClick={reload}>Δοκίμασε ξανά</Button>
        </div>
      </div>
    )
  }

  if (wholeAppLocked) {
    return (
      <div className="h-full overflow-y-auto">
        <LockScreen onUnlock={() => setUnlocked(true)} />
        <Toaster />
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* Side rail — tablets and desktop */}
      <aside className="hidden md:flex flex-col items-center w-28 shrink-0 bg-ink px-3 py-4 gap-2">
        <Logo settings={settings} />
        <Button variant="pay" size="md" icon={Plus} onClick={() => setPaying(true)}
          className="w-full flex-col h-auto py-3 gap-1 text-[13px] mt-3 mb-2">
          Πληρωμή
        </Button>
        <nav className="flex flex-col gap-1 w-full">
          {NAV.map(n => <RailLink key={n.to} {...n} />)}
        </nav>
        <div className="flex-1" />
        {lock && unlocked && (
          <button type="button" onClick={() => setUnlocked(false)}
            className="flex flex-col items-center justify-center gap-1 w-full py-3 rounded-2xl text-[13px] font-semibold text-stone-300 hover:bg-white/10 hover:text-white">
            <Lock size={22} /> Κλείδωμα
          </button>
        )}
        <RailLink to="/settings" label="Ρυθμίσεις" icon={Settings} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-5 md:py-8 pb-28 md:pb-10">
            {notice && <Banner tone="sky" icon={AlertTriangle} onClose={dismissNotice} closeLabel="OK">{notice}</Banner>}
            <BackupReminder />
            {loading ? <p className="text-stone-500 py-20 text-center">Φόρτωση…</p>
              : pageLocked ? <LockScreen onUnlock={() => setUnlocked(true)} />
              : <Outlet />}
          </div>
        </main>

        {/* Bottom bar — phones / narrow windows */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 flex items-stretch">
          {NAV.slice(0, 2).map(n => <BottomLink key={n.to} {...n} />)}
          <button type="button" onClick={() => setPaying(true)} className="flex-1 flex flex-col items-center justify-center py-2 text-emerald-700 font-semibold text-xs gap-0.5">
            <span className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center -mt-5 shadow-sheet"><Plus size={24} /></span>
            Πληρωμή
          </button>
          {[NAV[2], { to: '/settings', label: 'Ρυθμίσεις', icon: Settings }].map(n => <BottomLink key={n.to} {...n} />)}
        </nav>
      </div>

      {paying && <PaymentSheet onClose={() => setPaying(false)} />}
      <Toaster />
    </div>
  )
}

function BottomLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => cx('flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold',
        isActive ? 'text-ink' : 'text-stone-400')}>
      <Icon size={22} />
      {label}
    </NavLink>
  )
}
