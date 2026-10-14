import { useEffect, useState } from 'react'
import { Plus, ChevronRight, Download, HardDrive, RotateCcw, ImagePlus, Trash2, FolderOpen, Lock } from 'lucide-react'
import { useData } from '../../data/DataContext.jsx'
import { backend, errorText } from '../../data/backend.js'
import { fmtMoney } from '../../data/model.js'
import { confirmDialog, alertDialog } from '../../utils/dialogs.js'
import { isAndroid } from '../../utils/platform.js'
import GroupSheet from '../GroupSheet.jsx'
import { PinSetupSheet } from '../Lock.jsx'
import { DEFAULT_REMINDER } from '../../data/reminder.js'
import { exportExcel } from '../exportExcel.js'
import { Button, Card, ErrorNote, Field, PageHeader, SectionTitle, TextInput, toast, useAction } from '../ui.jsx'

const VERSION = '3.0.0'

/** Shrinks a picked image to a small square data URL (stored in the database). */
function readLogo(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const size = 160
      const c = document.createElement('canvas')
      c.width = size
      c.height = size
      const ctx = c.getContext('2d')
      const s = Math.min(img.width, img.height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Η εικόνα δεν διαβάστηκε')) }
    img.src = url
  })
}

function NumberSetting({ label, hint, value, onSave, min = 0, max = 365 }) {
  const [v, setV] = useState(String(value))
  useEffect(() => setV(String(value)), [value])
  const n = Number(v)
  const valid = v !== '' && Number.isInteger(n) && n >= min && n <= max
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label={label} hint={hint} className="flex-1 min-w-56">
        <input className="field w-32 text-lg font-semibold" inputMode="numeric" value={v} onChange={e => setV(e.target.value.replace(/\D/g, ''))} />
      </Field>
      {valid && n !== value && <Button variant="primary" onClick={() => onSave(n)} className="mb-7">Αποθήκευση</Button>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <Card className="p-5 space-y-5">{children}</Card>
    </section>
  )
}

export default function SettingsPage() {
  const data = useData()
  const { groups, settings, saveSettings, reload } = data
  const [gymName, setGymName] = useState(settings.gymName)
  const [groupSheet, setGroupSheet] = useState(null)   // group | 'new'
  const [pinSheet, setPinSheet] = useState(false)
  const [reminder, setReminder] = useState(settings.reminderText ?? DEFAULT_REMINDER)
  const [config, setConfig] = useState(null)
  const [backups, setBackups] = useState([])
  const [folder, setFolder] = useState('')
  const { busy, error, run } = useAction()

  async function refreshBackups() {
    try {
      const [cfg, list] = await Promise.all([backend.getAppConfig(), backend.listBackups()])
      setConfig(cfg)
      setFolder(cfg?.dataFolder ?? '')
      setBackups(list)
    } catch (err) {
      setConfig({ error: errorText(err) })
    }
  }
  useEffect(() => { refreshBackups() }, [])

  const saveName = () => run(async () => { await saveSettings({ gymName: gymName.trim() || 'Dojo Patras' }); toast('Αποθηκεύτηκε') })
  const pickLogo = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) run(async () => { await saveSettings({ logo: await readLogo(file) }); toast('Το λογότυπο άλλαξε') })
  }

  const backupNow = () => run(async () => {
    const b = await backend.createBackup()
    toast('Το αντίγραφο δημιουργήθηκε')
    await refreshBackups()
    return b
  })

  const restore = (name) => run(async () => {
    const ok = await confirmDialog(`Επαναφορά από το «${name}»;\n\nΤα τωρινά δεδομένα θα αντικατασταθούν. Πριν από αυτό κρατιέται αυτόματα αντίγραφο των τωρινών.`)
    if (!ok) return
    const r = await backend.restoreBackup(name)
    await reload()
    await refreshBackups()
    await alertDialog(`Έγινε επαναφορά (${r.records} εγγραφές). Τα προηγούμενα δεδομένα κρατήθηκαν στο «${r.safetyBackup}».`)
  })

  const doExport = () => run(async () => {
    const path = await exportExcel(data)
    await alertDialog(`Το Excel αποθηκεύτηκε:\n\n${path}`)
  })

  const changeFolder = () => run(async () => {
    const cfg = await backend.setDataFolder(folder)
    setConfig(cfg)
    toast('Ο φάκελος άλλαξε')
    await refreshBackups()
  })

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader title="Ρυθμίσεις" />
      <ErrorNote error={error} />

      <Section title="Γυμναστήριο">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Όνομα" className="flex-1 min-w-56"><TextInput value={gymName} onChange={e => setGymName(e.target.value)} /></Field>
          {gymName.trim() !== settings.gymName && <Button variant="primary" onClick={saveName} busy={busy}>Αποθήκευση</Button>}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {settings.logo
            ? <img src={settings.logo} alt="" className="w-20 h-20 rounded-2xl object-cover border border-stone-200" />
            : <span className="w-20 h-20 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400"><ImagePlus /></span>}
          <label className="inline-flex items-center gap-2 h-12 px-4 rounded-xl border border-stone-300 bg-white font-semibold cursor-pointer hover:bg-stone-50">
            <ImagePlus size={18} /> {settings.logo ? 'Άλλο λογότυπο' : 'Λογότυπο'}
            <input type="file" accept="image/*" className="hidden" onChange={pickLogo} />
          </label>
          {settings.logo && <Button variant="ghost" icon={Trash2} onClick={() => run(() => saveSettings({ logo: null }))}>Αφαίρεση</Button>}
        </div>
      </Section>

      <Section title="Συνδρομές">
        <NumberSetting
          label="Ειδοποίηση πριν λήξει (μέρες)"
          hint="Τόσες μέρες πριν τη λήξη, το μέλος εμφανίζεται στο «Σήμερα» ως «Λήγει»."
          value={settings.warnDays}
          max={60}
          onSave={n => run(async () => { await saveSettings({ warnDays: n }); toast('Αποθηκεύτηκε') })}
        />
        <NumberSetting
          label="Σε παύση μετά από (μέρες)"
          hint="Όταν περάσουν τόσες μέρες από τη λήξη χωρίς πληρωμή, το μέλος φεύγει από το «Σήμερα» και μπαίνει «σε παύση». Δεν χρεώνεται τίποτα."
          value={settings.pauseDays}
          min={1}
          onSave={n => run(async () => { await saveSettings({ pauseDays: n }); toast('Αποθηκεύτηκε') })}
        />
      </Section>

      <Section title="Μήνυμα υπενθύμισης">
        <Field label="Κείμενο" hint="Αντικαθίστανται αυτόματα: {όνομα} {ονοματεπώνυμο} {τμήμα} {λήξη} {γυμναστήριο}">
          <textarea className="field" rows={3} value={reminder} onChange={e => setReminder(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          {reminder !== (settings.reminderText ?? DEFAULT_REMINDER) && (
            <Button variant="primary" onClick={() => run(async () => { await saveSettings({ reminderText: reminder.trim() || null }); toast('Αποθηκεύτηκε') })}>Αποθήκευση</Button>
          )}
          {settings.reminderText && (
            <Button variant="ghost" onClick={() => run(async () => { await saveSettings({ reminderText: null }); setReminder(DEFAULT_REMINDER) })}>Αρχικό κείμενο</Button>
          )}
        </div>
      </Section>

      <Section title="Κλείδωμα με PIN">
        {settings.pin ? (
          <>
            <p className="flex items-center gap-2 font-semibold"><Lock size={18} />
              Ενεργό — κλειδώνει {settings.pin.lockAll ? 'όλη την εφαρμογή' : 'τα Στατιστικά και τις Ρυθμίσεις'}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setPinSheet(true)}>Αλλαγή PIN</Button>
              <Button variant="danger" onClick={() => run(async () => {
                if (!(await confirmDialog('Να αφαιρεθεί το PIN;'))) return
                await saveSettings({ pin: null })
                toast('Το PIN αφαιρέθηκε')
              })}>Αφαίρεση PIN</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-stone-600">Προαιρετικό. Κρύβει τα έσοδα και τις ρυθμίσεις από όποιον πιάσει το tablet. Αν το ξεχάσεις, ξεκλειδώνεις με τον κωδικό ανάκτησης που θα σου δείξει.</p>
            <Button variant="primary" icon={Lock} onClick={() => setPinSheet(true)}>Βάλε PIN</Button>
          </>
        )}
      </Section>

      <section>
        <SectionTitle action={<Button size="sm" icon={Plus} onClick={() => setGroupSheet('new')}>Νέο τμήμα</Button>}>Τμήματα, τιμές & ζώνες</SectionTitle>
        <Card className="divide-y divide-stone-100 overflow-hidden">
          {groups.map(g => (
            <button key={g.id} type="button" onClick={() => setGroupSheet(g)} className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-stone-50">
              <span className="w-4 h-4 rounded-full shrink-0" style={{ background: g.color }} />
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-lg">{g.name}</span>
                <span className="block text-sm text-stone-500 truncate">
                  {(g.plans ?? []).map(p => `${p.label} ${p.price != null ? fmtMoney(p.price) : '—'}`).join(' · ')}
                </span>
                {g.belts?.length > 0 && (
                  <span className="flex gap-1 mt-1.5">
                    {g.belts.map(b => <span key={b.id} title={b.name} className="w-5 h-2 rounded-sm ring-1 ring-black/10" style={{ background: b.color }} />)}
                  </span>
                )}
              </span>
              <ChevronRight className="text-stone-300" />
            </button>
          ))}
        </Card>
      </section>

      <Section title="Δεδομένα & αντίγραφα">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={HardDrive} onClick={backupNow} busy={busy}>Αντίγραφο τώρα</Button>
          <Button icon={Download} onClick={doExport} busy={busy}>Εξαγωγή σε Excel</Button>
        </div>
        <NumberSetting
          label="Αυτόματο Excel κάθε μήνα, τη μέρα (0 = ποτέ)"
          hint="π.χ. 16. Γράφεται στο πρώτο άνοιγμα της εφαρμογής από εκείνη τη μέρα και μετά, στον φάκελο exports."
          value={settings.autoExportDay ?? 0}
          max={28}
          onSave={n => run(async () => { await saveSettings({ autoExportDay: n || null }); toast('Αποθηκεύτηκε') })}
        />
        <div className="text-sm text-stone-600 space-y-1">
          <p>Ένα αντίγραφο ασφαλείας φτιάχνεται αυτόματα κάθε μέρα με το πρώτο άνοιγμα (κρατιούνται τα 30 τελευταία).</p>
          {config?.backupFolder && <p className="break-all">Φάκελος: <b>{config.backupFolder}</b></p>}
          {config?.lastBackup && <p>Τελευταίο: <b>{config.lastBackup}</b></p>}
          {config?.error && <p className="text-rose-700">{config.error}</p>}
        </div>

        {!isAndroid() && config && !config.error && config.dbPath !== 'browser' && (
          <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-stone-100">
            <Field label="Φάκελος αντιγράφων & εξαγωγών" hint="π.χ. φάκελος OneDrive ή USB, ώστε τα αντίγραφα να φεύγουν από τον υπολογιστή." className="flex-1 min-w-64">
              <TextInput value={folder} onChange={e => setFolder(e.target.value)} />
            </Field>
            {folder.trim() && folder.trim() !== config.dataFolder && <Button icon={FolderOpen} onClick={changeFolder} className="mb-7">Αλλαγή</Button>}
          </div>
        )}

        {backups.length > 0 && (
          <div className="pt-2 border-t border-stone-100">
            <p className="font-semibold mb-2">Επαναφορά από αντίγραφο</p>
            <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 rounded-xl border border-stone-200">
              {backups.map(b => (
                <div key={b.name} className="flex items-center gap-3 px-4 py-2">
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">{b.date}</span>
                    <span className="block text-xs text-stone-500 truncate">{b.name}{b.sizeBytes ? ` · ${Math.round(b.sizeBytes / 1024)} KB` : ''}</span>
                  </span>
                  <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => restore(b.name)}>Επαναφορά</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <p className="text-sm text-stone-400 px-1">Dojo Patras · έκδοση {VERSION}</p>

      {pinSheet && <PinSetupSheet onClose={() => setPinSheet(false)} />}
      {groupSheet && <GroupSheet group={groupSheet === 'new' ? null : groupSheet} onClose={() => setGroupSheet(null)} />}
    </div>
  )
}
