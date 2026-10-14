/**
 * Shared building blocks. Touch-first: every control is at least 44px tall,
 * forms open as full-height sheets with the save button at the TOP, so the
 * on-screen keyboard can never hide it.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Loader2 } from 'lucide-react'
import { STATUS } from '../data/model.js'
import { errorText } from '../data/backend.js'

const cx = (...c) => c.filter(Boolean).join(' ')
export { cx }

// ── Buttons ──────────────────────────────────────────────────────────────────

const VARIANTS = {
  primary:   'bg-ink text-white hover:bg-stone-800 active:bg-stone-700',
  pay:       'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
  secondary: 'bg-white text-ink border border-stone-300 hover:bg-stone-50 active:bg-stone-100',
  ghost:     'text-stone-700 hover:bg-stone-200/60 active:bg-stone-200',
  danger:    'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 active:bg-rose-100',
}
const SIZES = {
  sm: 'h-10 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-12 px-4 text-base gap-2 rounded-xl',
  lg: 'h-14 px-6 text-lg gap-2.5 rounded-2xl',
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, busy, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors select-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant], SIZES[size], className,
      )}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <Loader2 size={size === 'lg' ? 22 : 18} className="animate-spin" />
        : Icon && <Icon size={size === 'lg' ? 22 : 18} strokeWidth={2.2} />}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, label, className, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex items-center justify-center w-11 h-11 rounded-xl text-stone-600 hover:bg-stone-200/60 active:bg-stone-200', className)}
      {...props}
    >
      <Icon size={20} />
    </button>
  )
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

export function Card({ className, children, ...props }) {
  return <div className={cx('bg-white rounded-2xl shadow-card border border-stone-200/70', className)} {...props}>{children}</div>
}

export function SectionTitle({ children, count, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3 px-1">
      <h2 className="text-lg font-bold text-ink">
        {children}
        {count != null && <span className="ml-2 text-stone-400 font-semibold">{count}</span>}
      </h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-stone-500 mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 text-stone-500">
      {Icon && <Icon size={36} className="text-stone-300 mb-3" />}
      <p className="font-semibold text-stone-700">{title}</p>
      {children && <div className="mt-1 text-sm max-w-sm">{children}</div>}
    </div>
  )
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export const STATUS_STYLE = {
  ok:      { pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  soon:    { pill: 'bg-amber-50 text-amber-800 ring-amber-200',       dot: 'bg-amber-500',   bar: 'bg-amber-400' },
  expired: { pill: 'bg-rose-50 text-rose-800 ring-rose-200',          dot: 'bg-rose-500',    bar: 'bg-rose-500' },
  unpaid:  { pill: 'bg-sky-50 text-sky-800 ring-sky-200',             dot: 'bg-sky-500',     bar: 'bg-sky-500' },
  paused:  { pill: 'bg-stone-100 text-stone-600 ring-stone-200',      dot: 'bg-stone-400',   bar: 'bg-stone-300' },
}

export function StatusPill({ state, children, className }) {
  const s = STATUS_STYLE[state] ?? STATUS_STYLE.paused
  return (
    <span className={cx('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-sm font-semibold ring-1 whitespace-nowrap', s.pill, className)}>
      <span className={cx('w-2 h-2 rounded-full', s.dot)} />
      {children ?? STATUS[state]?.label}
    </span>
  )
}

export function GroupTag({ group, className }) {
  if (!group) return null
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-sm font-semibold text-stone-700 whitespace-nowrap', className)}>
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: group.color }} />
      {group.name}
    </span>
  )
}

export function BeltTag({ name, color, className }) {
  if (!name) return null
  return (
    <span className={cx('inline-flex items-center gap-2 text-sm font-semibold text-stone-700 whitespace-nowrap', className)}>
      <span className="w-6 h-2.5 rounded-sm ring-1 ring-black/10" style={{ background: color ?? '#e5e7eb' }} />
      {name}
    </span>
  )
}

export function Avatar({ name, color = '#57534e', size = 44 }) {
  const initials = String(name ?? '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  )
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="block text-sm font-semibold text-stone-700 mb-1.5">{label}</span>}
      {children}
      {hint && <span className="block text-sm text-stone-500 mt-1.5">{hint}</span>}
    </label>
  )
}

export function TextInput(props) {
  return <input type="text" className="field" {...props} />
}

/** Amount input: decimal keypad on tablets, accepts "25,5". */
export function MoneyInput({ value, onChange, ...props }) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        className="field pr-10 text-lg font-semibold"
        value={value ?? ''}
        onChange={e => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        {...props}
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-semibold">€</span>
    </div>
  )
}

export function DateInput(props) {
  return <input type="date" className="field" {...props} />
}

/** Big tappable choices (plans, groups, belts). */
export function Choice({ options, value, onChange, multiple = false, className }) {
  const isOn = (v) => (multiple ? (value ?? []).includes(v) : value === v)
  const toggle = (v) => {
    if (!multiple) return onChange(v)
    const cur = value ?? []
    onChange(cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v])
  }
  return (
    <div className={cx('flex flex-wrap gap-2', className)}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o.value)}
          className={cx(
            'min-h-12 px-4 py-2 rounded-xl border-2 text-left transition-colors',
            isOn(o.value) ? 'border-ink bg-ink text-white' : 'border-stone-200 bg-white text-ink hover:border-stone-300',
          )}
        >
          <span className="flex items-center gap-2 font-semibold">
            {o.color && <span className="w-3 h-3 rounded-full ring-1 ring-black/10" style={{ background: o.color }} />}
            {o.label}
          </span>
          {o.sub && <span className={cx('block text-sm', isOn(o.value) ? 'text-stone-300' : 'text-stone-500')}>{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Αναζήτηση μέλους…', autoFocus, className, big }) {
  return (
    <div className={cx('relative', className)}>
      <Search size={big ? 22 : 18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cx('field pl-12 pr-11', big && 'h-14 text-lg rounded-2xl')}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Καθαρισμός"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100">
          <X size={18} />
        </button>
      )}
    </div>
  )
}

// ── Sheet (full-height form) ─────────────────────────────────────────────────

/**
 * A form on its own layer. On a tablet it fills the height with the title
 * bar and the save button pinned at the top; the body scrolls. When the
 * keyboard opens the page shrinks (adjustResize) and the focused field is
 * scrolled into view.
 */
export function Sheet({ title, onClose, onSave, saveLabel = 'Αποθήκευση', saving, canSave = true, wide, children, footer }) {
  const bodyRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const onFocus = (e) => {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return
      setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
    }
    body.addEventListener('focusin', onFocus)
    return () => body.removeEventListener('focusin', onFocus)
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center bg-ink/40" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={cx('flex flex-col w-full h-full bg-paper shadow-sheet md:my-4 md:h-auto md:max-h-[calc(100%-2rem)] md:rounded-3xl overflow-hidden',
        wide ? 'md:max-w-4xl' : 'md:max-w-2xl')}>
        <div className="flex items-center gap-3 px-4 md:px-6 h-16 shrink-0 bg-white border-b border-stone-200">
          <Button variant="ghost" onClick={onClose} className="-ml-2">Άκυρο</Button>
          <h2 className="flex-1 min-w-0 text-lg font-bold text-center truncate">{title}</h2>
          {onSave
            ? <Button variant="primary" onClick={onSave} busy={saving} disabled={!canSave}>{saveLabel}</Button>
            : <span className="w-20" />}
        </div>
        <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 py-5 space-y-5">
          {children}
        </div>
        {footer && <div className="shrink-0 px-4 md:px-6 py-3 bg-white border-t border-stone-200">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ErrorNote({ error }) {
  if (!error) return null
  return <div className="rounded-xl bg-rose-50 text-rose-800 border border-rose-200 px-4 py-3 text-sm font-medium">{errorText(error)}</div>
}

/** Runs an async action with a busy flag and a readable error. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      setError(err)
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run, setError }
}

// ── Toast ────────────────────────────────────────────────────────────────────

let pushToast = () => {}
/** Short confirmation. With `action` ({ label, onClick }) it stays longer and
 *  carries a button — e.g. «Αναίρεση» right after a payment. */
export const toast = (text, action) => pushToast(text, action)

export function Toaster() {
  const [items, setItems] = useState([])
  useEffect(() => {
    pushToast = (text, action) => {
      const id = Math.random()
      setItems(prev => [...prev, { id, text, action }])
      setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), action ? 8000 : 2600)
    }
    return () => { pushToast = () => {} }
  }, [])
  const close = (id) => setItems(prev => prev.filter(i => i.id !== id))
  return createPortal(
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none">
      {items.map(i => (
        <div key={i.id} className="flex items-center gap-4 bg-ink text-white pl-5 pr-2 py-2 min-h-12 rounded-2xl shadow-sheet font-semibold pointer-events-auto">
          <span className="py-1">{i.text}</span>
          {i.action && (
            <button type="button" onClick={() => { close(i.id); i.action.onClick() }}
              className="h-10 px-4 rounded-xl bg-white/15 hover:bg-white/25 font-bold">
              {i.action.label}
            </button>
          )}
          {!i.action && <span className="w-3" />}
        </div>
      ))}
    </div>,
    document.body,
  )
}
