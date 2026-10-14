import { useState } from 'react'
import { Delete, Lock, KeyRound } from 'lucide-react'
import { useData } from '../data/DataContext.jsx'
import { checkPin, checkRecovery, makeLock, newRecoveryCode } from '../data/pin.js'
import { Button, Choice, ErrorNote, Field, Sheet, TextInput, toast, useAction, cx } from './ui.jsx'

const PIN_LENGTH = 4

/** Big on-screen keypad — no system keyboard needed. */
function PinPad({ value, onChange, error }) {
  const press = (d) => { if (value.length < PIN_LENGTH) onChange(value + d) }
  return (
    <div className="flex flex-col items-center gap-6">
      <div className={cx('flex gap-4', error && 'animate-pulse')}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={cx('w-5 h-5 rounded-full border-2',
            i < value.length ? 'bg-ink border-ink' : 'border-stone-400', error && 'border-rose-500')} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <PadKey key={d} onClick={() => press(d)}>{d}</PadKey>
        ))}
        <span />
        <PadKey onClick={() => press('0')}>0</PadKey>
        <PadKey onClick={() => onChange(value.slice(0, -1))} label="Σβήσιμο"><Delete size={26} /></PadKey>
      </div>
    </div>
  )
}

function PadKey({ children, onClick, label }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="w-20 h-20 rounded-2xl bg-white border border-stone-200 text-3xl font-bold flex items-center justify-center hover:bg-stone-50 active:bg-stone-200 shadow-card">
      {children}
    </button>
  )
}

/** Shown instead of a locked page. */
export function LockScreen({ onUnlock }) {
  const { settings, saveSettings } = useData()
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [code, setCode] = useState('')
  const { busy, error, run, setError } = useAction()

  function change(v) {
    setWrong(false)
    setPin(v)
    if (v.length === PIN_LENGTH) {
      if (checkPin(settings.pin, v)) onUnlock()
      else { setWrong(true); setTimeout(() => setPin(''), 400) }
    }
  }

  const recover = () => run(async () => {
    if (!checkRecovery(settings.pin, code)) {
      setError('Ο κωδικός ανάκτησης δεν είναι σωστός.')
      return
    }
    await saveSettings({ pin: null })
    toast('Το PIN αφαιρέθηκε — βάλε νέο από τις Ρυθμίσεις')
    onUnlock()
  })

  if (forgot) {
    return (
      <div className="max-w-md mx-auto py-10 space-y-5">
        <KeyRound size={40} className="text-stone-400" />
        <h1 className="text-2xl font-extrabold">Ξέχασες το PIN;</h1>
        <p className="text-stone-600">Γράψε τον κωδικό ανάκτησης που σου έδειξε η εφαρμογή όταν έβαλες το PIN, ή τον κεντρικό κωδικό του γυμναστηρίου. Το PIN θα αφαιρεθεί.</p>
        <Field label="Κωδικός ανάκτησης">
          <TextInput inputMode="numeric" value={code} onChange={e => setCode(e.target.value)} placeholder="μόνο τα ψηφία, οι παύλες δεν χρειάζονται" autoFocus />
        </Field>
        <ErrorNote error={error} />
        <div className="flex gap-2">
          <Button variant="primary" onClick={recover} busy={busy}>Ξεκλείδωμα</Button>
          <Button variant="ghost" onClick={() => { setForgot(false); setError(null) }}>Πίσω</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-10 gap-6">
      <Lock size={36} className="text-stone-400" />
      <h1 className="text-2xl font-extrabold">Γράψε το PIN</h1>
      <PinPad value={pin} onChange={change} error={wrong} />
      <p className={cx('h-6 font-semibold', wrong ? 'text-rose-600' : 'text-transparent')}>Λάθος PIN</p>
      <Button variant="ghost" onClick={() => setForgot(true)}>Ξέχασα το PIN</Button>
    </div>
  )
}

/** Set (or change) the PIN: type it twice, then write down the recovery code. */
export function PinSetupSheet({ onClose }) {
  const { settings, saveSettings } = useData()
  const [step, setStep] = useState('first')   // first → again → code
  const [first, setFirst] = useState('')
  const [again, setAgain] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const [code] = useState(newRecoveryCode)
  const [lockAll, setLockAll] = useState(settings.pin?.lockAll ? 'all' : 'money')
  const [wrote, setWrote] = useState(false)
  const { busy, error, run } = useAction()

  const save = () => run(async () => {
    await saveSettings({ pin: makeLock(first, code, lockAll === 'all') })
    toast('Το PIN μπήκε')
    onClose()
  })

  return (
    <Sheet title="PIN" onClose={onClose} onSave={step === 'code' ? save : undefined} saving={busy} canSave={wrote}>
      {step === 'first' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-lg font-semibold">Διάλεξε ένα PIN με {PIN_LENGTH} αριθμούς</p>
          <PinPad value={first} onChange={v => { setFirst(v); if (v.length === PIN_LENGTH) setTimeout(() => setStep('again'), 200) }} />
        </div>
      )}
      {step === 'again' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-lg font-semibold">Γράψε το ξανά</p>
          <PinPad value={again} error={mismatch} onChange={v => {
            setMismatch(false)
            setAgain(v)
            if (v.length === PIN_LENGTH) {
              if (v === first) setTimeout(() => setStep('code'), 200)
              else { setMismatch(true); setTimeout(() => { setAgain(''); setFirst(''); setStep('first') }, 900) }
            }
          }} />
          <p className={cx('h-6 font-semibold', mismatch ? 'text-rose-600' : 'text-transparent')}>Δεν ταιριάζουν — ξανά από την αρχή</p>
        </div>
      )}
      {step === 'code' && (
        <div className="space-y-5">
          <Field label="Τι κλειδώνει">
            <Choice value={lockAll} onChange={setLockAll} options={[
              { value: 'money', label: 'Στατιστικά & Ρυθμίσεις', sub: 'οι πληρωμές μένουν ανοιχτές' },
              { value: 'all', label: 'Όλη την εφαρμογή', sub: 'PIN σε κάθε άνοιγμα' },
            ]} />
          </Field>
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 space-y-3">
            <p className="font-bold text-amber-900">Κωδικός ανάκτησης — γράψ' τον σε χαρτί</p>
            <p className="text-4xl font-extrabold tracking-widest text-center py-2 select-all">{code}</p>
            <p className="text-amber-900">Αν ξεχάσεις το PIN, με αυτόν τον κωδικό ξεκλειδώνεις. Δεν θα ξαναεμφανιστεί.
              Καλό είναι να έχει μια φωτογραφία του και κάποιος δεύτερος.</p>
            <label className="flex items-center gap-3 h-12 font-semibold cursor-pointer">
              <input type="checkbox" className="w-6 h-6 accent-ink" checked={wrote} onChange={e => setWrote(e.target.checked)} />
              Τον έγραψα
            </label>
          </div>
          <ErrorNote error={error} />
        </div>
      )}
    </Sheet>
  )
}
