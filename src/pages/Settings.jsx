import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Sun, Moon, Palette, Clock, Check, Monitor, Image, Building2, Shield, Upload, FileSpreadsheet, Keyboard, Database, Copy, CheckCircle, XCircle, RefreshCw, FolderOpen, HardDriveDownload } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import * as db from '../services/dataService'
import { useTheme, ACCENT_PALETTES, TIME_FORMATS, DATE_FORMATS } from '../contexts/ThemeContext'
import { useServices } from '../contexts/ServicesContext'
import { useInstructors } from '../contexts/InstructorsContext'
import { useSchedule } from '../contexts/ScheduleContext'
import Card from '../components/ui/Card'

// ── Live clock preview ────────────────────────────────────────────────────────
function LiveClockPreview({ timeFormat, dateFormat }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none tracking-tight">
        {format(now, timeFormat || 'HH:mm:ss')}
      </p>
      <p className="text-sm text-gray-500 mt-1">{format(now, dateFormat || 'EEE, d MMM')}</p>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function SettingSection({ icon: Icon, title, description, children }) {
  return (
    <Card>
      <div className="flex items-start gap-4 pb-4 border-b border-gray-100 mb-5">
        <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon size={16} className="text-primary-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{title}</p>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  )
}

// ── Theme option button ───────────────────────────────────────────────────────
function ThemeOption({ value, current, onSelect, icon: Icon, label, sublabel }) {
  const isActive = current === value
  return (
    <button
      onClick={() => onSelect(value)}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all w-full ${
        isActive
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      {isActive && (
        <span className="absolute top-2 right-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
          <Check size={10} className="text-white" strokeWidth={3} />
        </span>
      )}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
        isActive ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'
      }`}>
        <Icon size={18} />
      </div>
      <div className="text-center">
        <p className={`text-sm font-semibold transition-colors ${isActive ? 'text-primary-700' : 'text-gray-700'}`}>{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>
      </div>
    </button>
  )
}

// ── Format option pill ────────────────────────────────────────────────────────
function FormatOption({ value, current, onSelect, label }) {
  const isActive = current === value
  return (
    <button
      onClick={() => onSelect(value)}
      className={`relative px-3 py-2 rounded-xl text-xs font-medium border-2 transition-all ${
        isActive
          ? 'border-primary-500 bg-primary-50 text-primary-700'
          : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      {isActive && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
          <Check size={8} className="text-white" strokeWidth={3} />
        </span>
      )}
      {label}
    </button>
  )
}

// ── Inline text field ─────────────────────────────────────────────────────────
function IdentityField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400
                   focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
      />
    </div>
  )
}

// ── Import from Excel ─────────────────────────────────────────────────────────
const IMPORT_MODES = [
  { v: 'all',      l: 'Import All' },
  { v: 'new',      l: 'New Members' },
  { v: 'services', l: 'Services & Instructors' },
  { v: 'schedule', l: 'Schedule & Events' },
]

const AI_PROMPTS = {
  all: `I'm migrating my entire gym database to a new management app. Analyze my data and output this exact JSON — first infer all services from the data, then use those service IDs throughout:

{
  "services": [
    {
      "id": "boxing",
      "name": "Boxing",
      "description": "Short description of this program",
      "color": "#ef4444",
      "monthlyFee": 45,
      "usesBelts": false
    }
  ],
  "instructors": [
    {
      "name": "Full Name",
      "phone": "",
      "email": "",
      "bio": "",
      "serviceIds": ["boxing"]
    }
  ],
  "classes": [
    {
      "day": "mon",
      "startTime": "18:00",
      "endTime": "19:30",
      "serviceId": "boxing",
      "title": "",
      "capacity": null
    }
  ],
  "events": [
    {
      "title": "Summer Seminar",
      "date": "2026-06-15",
      "startTime": "10:00",
      "endTime": "16:00",
      "color": "#f59e0b",
      "extraCost": 0,
      "description": ""
    }
  ],
  "members": [
    {
      "name": "Full Name",
      "phone": "",
      "email": "",
      "categories": ["boxing"],
      "belt": "white",
      "joinDate": "2024-01-15",
      "status": "active",
      "notes": ""
    }
  ],
  "payments": [
    {
      "memberName": "Full Name",
      "month": "2025-03",
      "amount": 45,
      "status": "paid",
      "paidAt": "2025-03-05"
    }
  ]
}

Rules:
- Define "services" first — member "categories" must use those exact service IDs (lowercase, no spaces, e.g. "boxing", "yoga", "swim-kids")
- Assign a distinct hex color to each service
- "usesBelts": true only for ranked martial arts (judo, bjj, karate, etc.); false for fitness, yoga, swimming, etc.
- Belt values (only for usesBelts services): white, yellow, orange, green, blue, purple, brown, black
- Dates: joinDate → YYYY-MM-DD; month → YYYY-MM; paidAt → ISO date string or null if unpaid
- Include ALL historical payment records for every member — do not limit to recent months
- If schedule or events aren't in the data, use empty arrays []
- Return ONLY the JSON object, no explanation`,

  new: `Add these new members to my gym management app. Return only the member list — no payment history needed.

{
  "members": [
    {
      "name": "Full Name",
      "phone": "",
      "email": "",
      "categories": ["service-id"],
      "belt": "white",
      "joinDate": "2025-01-10",
      "status": "active",
      "notes": ""
    }
  ],
  "payments": []
}

Rules:
- "categories" must be an array using the service IDs already set up in your app (check Settings → Services for exact IDs, e.g. "boxing", "yoga")
- "belt" only applies to belt-ranked services; values: white, yellow, orange, green, blue, purple, brown, black
- "joinDate": YYYY-MM-DD — use today's date if unknown
- Leave "payments" as an empty array — fees will be tracked separately
- Return ONLY the JSON object, no explanation`,

  services: `Set up the services and instructors for my gym management app. Analyze the data I provide and output this JSON:

{
  "services": [
    {
      "id": "boxing",
      "name": "Boxing",
      "description": "Short description of this program",
      "color": "#ef4444",
      "monthlyFee": 45,
      "usesBelts": false
    }
  ],
  "instructors": [
    {
      "name": "Full Name",
      "phone": "",
      "email": "",
      "bio": "",
      "serviceIds": ["boxing"]
    }
  ]
}

Rules:
- "id" must be lowercase with no spaces (e.g. "kickboxing", "yoga", "swim-kids")
- Assign a distinctive hex color to each service (e.g. "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6")
- "usesBelts": true only for ranked martial arts (judo, bjj, karate, etc.); false for everything else
- "serviceIds" in instructors must match the service IDs you define above
- Return ONLY the JSON object, no explanation

Here is my services and staff data:`,

  schedule: `Set up the weekly class schedule and upcoming events for my gym. Convert the timetable I provide into this JSON:

{
  "classes": [
    {
      "day": "mon",
      "startTime": "18:00",
      "endTime": "19:30",
      "serviceId": "boxing",
      "title": "",
      "capacity": null
    }
  ],
  "events": [
    {
      "title": "Summer Seminar",
      "date": "2026-06-15",
      "startTime": "10:00",
      "endTime": "16:00",
      "color": "#f59e0b",
      "extraCost": 0,
      "description": ""
    }
  ]
}

Rules:
- "day": mon / tue / wed / thu / fri / sat / sun
- Times in "HH:MM" 24-hour format
- "serviceId" must match a service ID already in your app — check Settings → Services for exact IDs
- "capacity": max number of participants as a number, or null for unlimited
- Event "date": YYYY-MM-DD
- Event "extraCost": additional fee in your currency (0 if the event is free)
- Return ONLY the JSON object, no explanation

Here is my class schedule and events:`,
}

function ImportSection() {
  const { addMember, addPayment } = useData()
  const { addService } = useServices()
  const { instructors, addInstructor } = useInstructors()
  const { addClass, addEvent } = useSchedule()
  const [mode, setMode] = useState('all')
  const [status, setStatus] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('loading')
    setError('')
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const firstSheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(firstSheet)
      // Try to auto-detect format
      if (rows.length > 0) {
        setPreview({ raw: rows, members: [], payments: [] })
        setStatus('preview')
      }
    } catch (err) {
      setError('Failed to read file: ' + err.message)
      setStatus('error')
    }
  }

  function handleParseJson() {
    try {
      const parsed = JSON.parse(jsonText)
      // Validate per mode
      if (mode === 'all') {
        const hasAny = parsed.members || parsed.services || parsed.instructors || parsed.classes || parsed.events || parsed.payments
        if (!hasAny) {
          setError('JSON must contain at least one of: members, services, instructors, classes, or events.')
          return
        }
      }
      if (mode === 'new' && (!parsed.members || !Array.isArray(parsed.members))) {
        setError('JSON must have a "members" array.')
        return
      }
      if (mode === 'services' && !parsed.services && !parsed.instructors) {
        setError('JSON must have a "services" or "instructors" array.')
        return
      }
      if (mode === 'schedule' && !parsed.classes && !parsed.events) {
        setError('JSON must have a "classes" or "events" array.')
        return
      }
      setPreview(parsed)
      setStatus('preview')
      setError('')
    } catch {
      setError('Invalid JSON. Please check the format.')
    }
  }

  async function handleImport() {
    setImporting(true)
    try {
      if (mode === 'all') {
        // 1. Services (must come first so their IDs exist for members)
        for (const s of (preview.services ?? [])) {
          addService({ id: s.id, name: s.name ?? '', description: s.description ?? '', color: s.color ?? '#94a3b8', monthlyFee: Number(s.monthlyFee) || 0, usesBelts: !!s.usesBelts })
        }
        // 2. Instructors (skip names that already exist — re-import safe)
        for (const ins of (preview.instructors ?? [])) {
          const exists = instructors.some(i => i.name?.trim().toLowerCase() === (ins.name ?? '').trim().toLowerCase())
          if (exists) continue
          addInstructor({ name: ins.name ?? '', phone: ins.phone ?? '', email: ins.email ?? '', bio: ins.bio ?? '', serviceIds: Array.isArray(ins.serviceIds) ? ins.serviceIds : [] })
        }
        // 3. Classes
        for (const c of (preview.classes ?? [])) {
          addClass({ day: c.day, startTime: c.startTime, endTime: c.endTime, serviceId: c.serviceId ?? '', title: c.title ?? '', capacity: c.capacity ?? null, instructor: '', instructorId: null })
        }
        // 4. Events
        for (const ev of (preview.events ?? [])) {
          addEvent({ title: ev.title ?? '', date: ev.date ?? '', startTime: ev.startTime ?? '', endTime: ev.endTime ?? '', color: ev.color ?? '#f59e0b', extraCost: Number(ev.extraCost) || 0, description: ev.description ?? '' })
        }
        // 5. Members
        const idMap = {}
        for (const m of (preview.members ?? [])) {
          const cats = Array.isArray(m.categories) ? m.categories : [m.categories].filter(Boolean)
          const id = await addMember({
            name: m.name ?? '',
            phone: m.phone ?? '',
            email: m.email ?? '',
            categories: cats,
            // Map the single AI-provided belt onto every selected service
            belts: (m.belts && typeof m.belts === 'object') ? m.belts
              : (m.belt ? Object.fromEntries(cats.map(c => [c, m.belt])) : {}),
            joinDate: m.joinDate ? new Date(m.joinDate) : new Date(),
            status: m.status ?? 'active',
            notes: m.notes ?? '',
          })
          if (id) idMap[m.name] = id
        }
        // 6. Payments
        for (const p of (preview.payments ?? [])) {
          const memberId = idMap[p.memberName]
          if (!memberId) continue
          await addPayment({ memberId, month: p.month, amount: Number(p.amount) || 0, status: p.status ?? 'unpaid', paidAt: p.paidAt ?? null })
        }
      } else if (mode === 'new') {
        const idMap = {}
        for (const m of (preview.members ?? [])) {
          const cats = Array.isArray(m.categories) ? m.categories : [m.categories].filter(Boolean)
          const id = await addMember({
            name: m.name ?? '',
            phone: m.phone ?? '',
            email: m.email ?? '',
            categories: cats,
            belts: (m.belts && typeof m.belts === 'object') ? m.belts
              : (m.belt ? Object.fromEntries(cats.map(c => [c, m.belt])) : {}),
            joinDate: m.joinDate ? new Date(m.joinDate) : new Date(),
            status: m.status ?? 'active',
            notes: m.notes ?? '',
          })
          if (id) idMap[m.name] = id
        }
        for (const p of (preview.payments ?? [])) {
          const memberId = idMap[p.memberName]
          if (!memberId) continue
          await addPayment({ memberId, month: p.month, amount: Number(p.amount) || 0, status: p.status ?? 'unpaid', paidAt: p.paidAt ?? null })
        }
      } else if (mode === 'services') {
        for (const s of (preview.services ?? [])) {
          addService({ id: s.id, name: s.name ?? '', description: s.description ?? '', color: s.color ?? '#94a3b8', monthlyFee: Number(s.monthlyFee) || 0, usesBelts: !!s.usesBelts })
        }
        for (const ins of (preview.instructors ?? [])) {
          addInstructor({ name: ins.name ?? '', phone: ins.phone ?? '', email: ins.email ?? '', bio: ins.bio ?? '', serviceIds: Array.isArray(ins.serviceIds) ? ins.serviceIds : [] })
        }
      } else if (mode === 'schedule') {
        for (const c of (preview.classes ?? [])) {
          addClass({ day: c.day, startTime: c.startTime, endTime: c.endTime, serviceId: c.serviceId ?? '', title: c.title ?? '', capacity: c.capacity ?? null, instructor: '', instructorId: null })
        }
        for (const ev of (preview.events ?? [])) {
          addEvent({ title: ev.title ?? '', date: ev.date ?? '', startTime: ev.startTime ?? '', endTime: ev.endTime ?? '', color: ev.color ?? '#f59e0b', extraCost: Number(ev.extraCost) || 0, description: ev.description ?? '' })
        }
      }
      setStatus('done')
      setPreview(null)
      setJsonText('')
    } catch (err) {
      setError('Import failed: ' + err.message)
      setStatus('error')
    } finally {
      setImporting(false)
    }
  }

  function importSummary() {
    if (!preview) return ''
    if (mode === 'all') {
      const parts = [
        (preview.services?.length ?? 0) && `${preview.services.length} service${preview.services.length !== 1 ? 's' : ''}`,
        (preview.instructors?.length ?? 0) && `${preview.instructors.length} instructor${preview.instructors.length !== 1 ? 's' : ''}`,
        (preview.classes?.length ?? 0) && `${preview.classes.length} class${preview.classes.length !== 1 ? 'es' : ''}`,
        (preview.events?.length ?? 0) && `${preview.events.length} event${preview.events.length !== 1 ? 's' : ''}`,
        (preview.members?.length ?? 0) && `${preview.members.length} member${preview.members.length !== 1 ? 's' : ''}`,
        (preview.payments?.length ?? 0) && `${preview.payments.length} payment records`,
      ].filter(Boolean)
      return parts.join(' · ')
    }
    if (mode === 'new') {
      const m = preview.members?.length ?? 0
      return `${m} member${m !== 1 ? 's' : ''}`
    }
    if (mode === 'services') {
      const s = preview.services?.length ?? 0
      const i = preview.instructors?.length ?? 0
      return [s && `${s} service${s !== 1 ? 's' : ''}`, i && `${i} instructor${i !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')
    }
    if (mode === 'schedule') {
      const c = preview.classes?.length ?? 0
      const e = preview.events?.length ?? 0
      return [c && `${c} class${c !== 1 ? 'es' : ''}`, e && `${e} event${e !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')
    }
    return ''
  }

  function importButtonLabel() {
    if (mode === 'all') {
      const m = preview?.members?.length ?? 0
      const s = preview?.services?.length ?? 0
      return m > 0 && s > 0 ? `Import All Data` : m > 0 ? `Import ${m} Members` : s > 0 ? `Import Services & Members` : 'Import'
    }
    if (mode === 'new') return `Import ${preview?.members?.length ?? 0} Members`
    if (mode === 'services') return `Import Services & Instructors`
    if (mode === 'schedule') return `Import Schedule`
    return 'Import'
  }

  function hasImportableData() {
    if (!preview) return false
    if (mode === 'all') {
      return (preview.members?.length ?? 0) > 0 ||
             (preview.services?.length ?? 0) > 0 ||
             (preview.instructors?.length ?? 0) > 0 ||
             (preview.classes?.length ?? 0) > 0 ||
             (preview.events?.length ?? 0) > 0
    }
    if (mode === 'new') return (preview.members?.length ?? 0) > 0
    if (mode === 'services') return (preview.services?.length ?? 0) > 0 || (preview.instructors?.length ?? 0) > 0
    if (mode === 'schedule') return (preview.classes?.length ?? 0) > 0 || (preview.events?.length ?? 0) > 0
    return false
  }

  return (
    <SettingSection
      icon={FileSpreadsheet}
      title="Import Data"
      description="Full database migration, or selectively import members, services, instructors, and schedule."
    >
      {/* Mode tabs */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {IMPORT_MODES.map(o => (
          <button
            key={o.v}
            onClick={() => { setMode(o.v); setStatus(null); setPreview(null); setError(''); setJsonText(''); if (fileRef.current) fileRef.current.value = '' }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === o.v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>

      {/* AI Prompt section — dynamic per mode */}
      <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs font-bold text-amber-800 mb-1">🤖 Use AI to transform your data</p>
        <p className="text-xs text-amber-700 mb-3 leading-relaxed">
          Open any AI chat (ChatGPT, Claude, Gemini), attach your Excel or paste your data, then copy and send this prompt. Paste the returned JSON below.
        </p>
        <div className="relative">
          <textarea
            readOnly
            value={AI_PROMPTS[mode]}
            rows={7}
            className="w-full text-xs font-mono bg-white border border-amber-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none text-gray-700 leading-relaxed"
          />
          <button
            onClick={() => navigator.clipboard.writeText(AI_PROMPTS[mode])}
            className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-md transition-colors"
          >
            Copy
          </button>
        </div>
      </div>

      {/* JSON paste area */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
          Paste AI-generated JSON here
        </label>
        <textarea
          value={jsonText}
          onChange={e => setJsonText(e.target.value)}
          placeholder={
            mode === 'services'  ? '{\n  "services": [...],\n  "instructors": [...]\n}' :
            mode === 'schedule'  ? '{\n  "classes": [...],\n  "events": [...]\n}' :
                                   '{\n  "members": [...],\n  "payments": [...]\n}'
          }
          rows={6}
          className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 text-gray-700 placeholder:text-gray-300"
        />
        <button
          onClick={handleParseJson}
          disabled={!jsonText.trim()}
          className="mt-2 px-4 py-2 text-xs font-semibold bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 transition-colors"
        >
          Preview Import
        </button>
      </div>

      {/* Or upload Excel directly (members modes only) */}
      {(mode === 'all' || mode === 'new') && (
        <>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">or upload Excel directly</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="flex items-center gap-3">
            <label
              htmlFor="import-excel"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl cursor-pointer transition-colors"
            >
              <Upload size={13} /> Upload .xlsx / .csv
            </label>
            <input
              id="import-excel"
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            {status === 'loading' && <span className="text-xs text-gray-400">Reading file…</span>}
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Preview */}
      {status === 'preview' && preview && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
          <p className="text-xs font-bold text-gray-700">
            Preview: {importSummary()}
            {preview.raw?.length && !preview.members?.length ? ` · ${preview.raw.length} raw rows detected` : ''}
          </p>

          {/* Members preview */}
          {(preview.members?.length ?? 0) > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {preview.members.slice(0, 10).map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0" />
                  {m.name} — {Array.isArray(m.categories) ? m.categories.join(', ') : m.categories} — {m.status}
                </div>
              ))}
              {preview.members.length > 10 && <p className="text-xs text-gray-400">…and {preview.members.length - 10} more</p>}
            </div>
          )}

          {/* Services preview */}
          {(preview.services?.length ?? 0) > 0 && (
            <div className="space-y-1">
              {preview.services.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-3 h-3 rounded-full shrink-0 border border-gray-200" style={{ background: s.color ?? '#94a3b8' }} />
                  {s.name} — €{s.monthlyFee}/mo {s.usesBelts ? '· belts' : ''}
                </div>
              ))}
            </div>
          )}

          {/* Instructors preview */}
          {(preview.instructors?.length ?? 0) > 0 && (
            <div className="space-y-1">
              {preview.instructors.map((ins, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  {ins.name} {ins.email ? `— ${ins.email}` : ''}
                </div>
              ))}
            </div>
          )}

          {/* Classes preview */}
          {(preview.classes?.length ?? 0) > 0 && (
            <div className="space-y-1">
              {preview.classes.slice(0, 8).map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  {c.day?.toUpperCase()} {c.startTime}–{c.endTime} · {c.title || c.serviceId}
                </div>
              ))}
              {preview.classes.length > 8 && <p className="text-xs text-gray-400">…and {preview.classes.length - 8} more</p>}
            </div>
          )}

          {/* Events preview */}
          {(preview.events?.length ?? 0) > 0 && (
            <div className="space-y-1">
              {preview.events.map((ev, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-3 h-3 rounded-full shrink-0 border border-gray-200" style={{ background: ev.color ?? '#f59e0b' }} />
                  {ev.title} — {ev.date} {ev.extraCost > 0 ? `· €${ev.extraCost}` : ''}
                </div>
              ))}
            </div>
          )}

          {/* Raw rows (Excel direct upload before AI transform) */}
          {preview.raw?.length > 0 && !preview.members?.length && (
            <div className="max-h-32 overflow-auto">
              <p className="text-xs text-amber-700 mb-1">Raw Excel rows — paste the AI JSON above to import properly:</p>
              <div className="space-y-0.5">
                {Object.keys(preview.raw[0] ?? {}).map(k => (
                  <span key={k} className="inline-block text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded mr-1">{k}</span>
                ))}
              </div>
            </div>
          )}

          {hasImportableData() && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 text-xs font-semibold bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {importing ? 'Importing…' : importButtonLabel()}
            </button>
          )}
        </div>
      )}

      {status === 'done' && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-xs font-semibold text-emerald-700">✓ Import completed successfully!</p>
        </div>
      )}
    </SettingSection>
  )
}

// ── Shortcuts Section ─────────────────────────────────────────────────────────
const DEFAULT_SHORTCUTS = [
  { id: 'search',    label: 'Open Search',        defaultKey: 'Ctrl+K',  category: 'Navigation' },
  { id: 'dashboard', label: 'Go to Dashboard',    defaultKey: 'Ctrl+D',  category: 'Navigation' },
  { id: 'members',   label: 'Go to Members',      defaultKey: 'Ctrl+M',  category: 'Navigation' },
  { id: 'payments',  label: 'Go to Payments',     defaultKey: 'Ctrl+P',  category: 'Navigation' },
  { id: 'activity',  label: 'Go to Activity',     defaultKey: 'Ctrl+A',  category: 'Navigation' },
  { id: 'schedule',  label: 'Go to Schedule',     defaultKey: 'Ctrl+L',  category: 'Navigation' },
  { id: 'settings',  label: 'Go to Settings',     defaultKey: 'Ctrl+;',  category: 'Navigation' },
  { id: 'new_member',label: 'New Member',          defaultKey: 'Ctrl+N',  category: 'Actions' },
  { id: 'close',     label: 'Close Modal / Back',  defaultKey: 'Escape',  category: 'Actions' },
]

// ── Local database section ────────────────────────────────────────────────────
function PathRow({ label, value }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-gray-600 mb-1.5">{label}</p>
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
        <p className="flex-1 text-xs font-mono text-gray-700 truncate" title={value}>{value || '—'}</p>
        {value && (
          <button onClick={copy} className="shrink-0 text-gray-400 hover:text-gray-700">
            {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}

function DatabaseSection() {
  const [config,  setConfig]  = useState(null)
  const [folder,  setFolder]  = useState('')
  const [status,  setStatus]  = useState(null) // null | 'ok' | 'err'
  const [msg,     setMsg]     = useState('')
  const [saving,  setSaving]  = useState(false)
  const [backing, setBacking] = useState(false)

  useEffect(() => {
    db.getAppConfig().then(setConfig).catch(() => {})
  }, [])

  async function handleChangeFolder() {
    if (!folder.trim()) return
    setSaving(true); setStatus(null); setMsg('')
    try {
      const next = await db.setDataFolder(folder.trim())
      setConfig(next)
      setFolder('')
      setStatus('ok')
      setMsg('Data folder updated. The Excel mirror and future backups will be written there.')
    } catch (e) {
      setStatus('err')
      setMsg(typeof e === 'string' ? e : e.message ?? 'Could not change folder')
    } finally {
      setSaving(false)
    }
  }

  async function handleBackupNow() {
    setBacking(true); setStatus(null); setMsg('')
    try {
      const info = await db.createBackup()
      setStatus('ok')
      setMsg(info ? `Backup saved: ${info.name}` : 'Backups are only available in the desktop app.')
      db.getAppConfig().then(setConfig).catch(() => {})
    } catch (e) {
      setStatus('err')
      setMsg(typeof e === 'string' ? e : e.message ?? 'Backup failed')
    } finally {
      setBacking(false)
    }
  }

  return (
    <SettingSection icon={Database} title="Database & Backups" description="All data is stored in a local database on this PC, mirrored to an Excel file you can open anytime.">
      <PathRow label="Database file" value={config?.dbPath} />
      <PathRow label="Excel mirror (read-only copy, updates automatically)" value={config?.mirrorPath} />
      <PathRow label="Backup folder (daily automatic snapshots)" value={config?.backupFolder} />

      <div className="flex items-center justify-between gap-3 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-700">Last backup</p>
          <p className="text-xs text-gray-500">{config?.lastBackup || 'Never'}</p>
        </div>
        <button
          onClick={handleBackupNow}
          disabled={backing}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-xs font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors shrink-0"
        >
          {backing ? <RefreshCw size={13} className="animate-spin" /> : <HardDriveDownload size={13} />}
          Backup Now
        </button>
      </div>

      {/* Change data folder */}
      <p className="text-xs text-gray-500 mb-2 leading-relaxed">
        <strong className="text-gray-700">Tip:</strong> point the folder below at a OneDrive / Google Drive folder
        (or a USB stick) and every backup automatically leaves this PC — so the data survives even if the computer dies.
      </p>
      <div className="flex gap-2">
        <input
          value={folder}
          onChange={e => setFolder(e.target.value)}
          placeholder="New data folder, e.g. C:\Users\you\OneDrive\Dojo Patras"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button
          onClick={handleChangeFolder}
          disabled={saving || !folder.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-900 disabled:opacity-50 transition-colors"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <FolderOpen size={14} />}
          Change
        </button>
      </div>

      {/* Status */}
      {status && (
        <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${status === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {status === 'ok' ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
          <span className="break-all">{msg}</span>
        </div>
      )}
    </SettingSection>
  )
}

function ShortcutsSection() {
  const [shortcuts, setShortcuts] = useState(() => {
    try {
      const saved = localStorage.getItem('dojoShortcuts')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [recording, setRecording] = useState(null) // id of shortcut being recorded

  function getKey(id) {
    return shortcuts[id] ?? DEFAULT_SHORTCUTS.find(s => s.id === id)?.defaultKey ?? ''
  }

  function handleReset(id) {
    setShortcuts(prev => {
      const next = { ...prev }
      delete next[id]
      localStorage.setItem('dojoShortcuts', JSON.stringify(next))
      return next
    })
  }

  function handleResetAll() {
    setShortcuts({})
    localStorage.setItem('dojoShortcuts', '{}')
  }

  function startRecording(id) {
    setRecording(id)
  }

  function handleKeyCapture(e, id) {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') { setRecording(null); return }
    const parts = []
    if (e.ctrlKey)  parts.push('Ctrl')
    if (e.metaKey)  parts.push('Cmd')
    if (e.altKey)   parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')
    const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key
    if (!['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
      parts.push(key)
      const combo = parts.join('+')
      setShortcuts(prev => {
        const next = { ...prev, [id]: combo }
        localStorage.setItem('dojoShortcuts', JSON.stringify(next))
        return next
      })
      setRecording(null)
    }
  }

  const categories = [...new Set(DEFAULT_SHORTCUTS.map(s => s.category))]

  return (
    <SettingSection
      icon={Keyboard}
      title="Keyboard Shortcuts"
      description="View and customize keyboard shortcuts. Click a shortcut to re-assign it."
    >
      {categories.map(cat => (
        <div key={cat} className="mb-5 last:mb-0">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{cat}</p>
          <div className="space-y-2">
            {DEFAULT_SHORTCUTS.filter(s => s.category === cat).map(s => {
              const isRecording = recording === s.id
              const currentKey = getKey(s.id)
              const isCustom = shortcuts[s.id] != null
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm text-gray-700">{s.label}</span>
                  <div className="flex items-center gap-2">
                    {isCustom && (
                      <button
                        onClick={() => handleReset(s.id)}
                        className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                        title="Reset to default"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={() => startRecording(s.id)}
                      onKeyDown={isRecording ? (e) => handleKeyCapture(e, s.id) : undefined}
                      className={`min-w-[80px] text-center text-xs font-mono font-semibold px-3 py-1.5 rounded-lg border-2 transition-all outline-none ${
                        isRecording
                          ? 'border-primary-400 bg-primary-50 text-primary-700 animate-pulse'
                          : isCustom
                            ? 'border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {isRecording ? 'Press keys…' : currentKey}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
        <p className="text-xs text-gray-400">
          <span className="bg-amber-50 text-amber-600 font-semibold px-1.5 py-0.5 rounded text-[10px]">CUSTOM</span>
          {' '}indicates a customized shortcut
        </p>
        <button
          onClick={handleResetAll}
          className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
        >
          Reset all to defaults
        </button>
      </div>
    </SettingSection>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const {
    theme, setTheme, accent, setAccent,
    logo, setLogo,
    gymName,     setGymName,
    gymSubtitle, setGymSubtitle,
    gymFooter,   setGymFooter,
    timeFormat,  setTimeFormat,
    dateFormat,  setDateFormat,
  } = useTheme()

  const [nameVal,     setNameVal]     = useState(gymName)
  const [subtitleVal, setSubtitleVal] = useState(gymSubtitle)
  const [footerVal,   setFooterVal]   = useState(gymFooter)
  const fileInputRef = useRef(null)

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => setLogo(evt.target.result)
    reader.readAsDataURL(file)
  }

  function handleRemoveLogo() {
    setLogo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSaveIdentity() {
    setGymName(nameVal.trim() || 'My Gym')
    setGymSubtitle(subtitleVal)
    setGymFooter(footerVal)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">Settings</h2>
        <p className="text-xs text-gray-500 mt-0.5">Customize your management experience</p>
      </div>

      {/* ── Gym Identity ──────────────────────────────────────────────────────── */}
      <SettingSection
        icon={Building2}
        title="Identity"
        description="Customize the name and labels displayed in the sidebar."
      >
        <div className="space-y-4">
          <IdentityField
            label="Name"
            value={nameVal}
            onChange={setNameVal}
            placeholder="My Gym"
          />
          <IdentityField
            label="Subtitle"
            value={subtitleVal}
            onChange={setSubtitleVal}
            placeholder="Management Panel"
          />
          <IdentityField
            label="Footer Text"
            value={footerVal}
            onChange={setFooterVal}
            placeholder="Gym Management"
          />
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            {/* Live sidebar preview */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-900 select-none">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary-600/20 ring-2 ring-primary-500/30 shrink-0">
                <Shield size={15} className="text-primary-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white leading-tight truncate max-w-32">
                  {nameVal || 'My Gym'}
                </p>
                <p className="text-xs text-gray-500 leading-tight truncate max-w-32">
                  {subtitleVal || 'Management Panel'}
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveIdentity}
              className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </SettingSection>

      {/* ── Logo ─────────────────────────────────────────────────────────────── */}
      <SettingSection icon={Image} title="Logo" description="Upload a custom logo for the sidebar.">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="shrink-0">
            {logo ? (
              <img src={logo} alt="Logo" className="w-16 h-16 rounded-xl object-cover ring-2 ring-gray-200" />
            ) : (
              <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-primary-600/10 ring-2 ring-primary-500/20">
                <Shield size={28} className="text-primary-400" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label
                htmlFor="logo-upload"
                className="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Upload Logo
              </label>
              <input id="logo-upload" ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              {logo && (
                <button onClick={handleRemoveLogo} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400">PNG, JPG or SVG. Recommended: 128×128px.</p>
          </div>
        </div>
      </SettingSection>

      {/* ── Appearance ───────────────────────────────────────────────────────── */}
      <SettingSection icon={Monitor} title="Appearance" description="Choose between light and dark mode.">
        <div className="grid grid-cols-2 gap-3">
          <ThemeOption value="light" current={theme} onSelect={setTheme} icon={Sun}  label="Light" sublabel="Clean & bright" />
          <ThemeOption value="dark"  current={theme} onSelect={setTheme} icon={Moon} label="Dark"  sublabel="Easy on the eyes" />
        </div>
      </SettingSection>

      {/* ── Accent Color ─────────────────────────────────────────────────────── */}
      <SettingSection icon={Palette} title="Accent Color" description="Personalize the highlight color used throughout the app.">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {Object.entries(ACCENT_PALETTES).map(([key, palette]) => {
            const isActive = accent === key
            return (
              <button
                key={key}
                onClick={() => setAccent(key)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                  isActive ? 'border-gray-300 bg-gray-50' : 'border-transparent hover:border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-full shadow-sm transition-all ${isActive ? 'scale-110' : 'hover:scale-105'}`} style={{ background: palette.hex }} />
                {isActive && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-white/90 rounded-full flex items-center justify-center shadow-sm ring-1 ring-gray-200">
                    <Check size={9} style={{ color: palette.hex }} strokeWidth={3} />
                  </span>
                )}
                <span className="text-xs font-medium text-gray-600">{palette.name}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
          Currently using <span className="font-bold" style={{ color: ACCENT_PALETTES[accent]?.hex }}>{ACCENT_PALETTES[accent]?.name}</span>. Changes apply instantly.
        </p>
      </SettingSection>

      {/* ── Date & Time Format ────────────────────────────────────────────────── */}
      <SettingSection icon={Clock} title="Date & Time Format" description="Configure how time and date appear in the top bar.">
        {/* Live preview */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl flex-wrap gap-4 mb-5">
          <LiveClockPreview timeFormat={timeFormat} dateFormat={dateFormat} />
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Preview</p>
            <p className="text-xs font-mono text-gray-500">{timeFormat}</p>
            <p className="text-xs font-mono text-gray-500">{dateFormat}</p>
          </div>
        </div>

        {/* Time format */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-2.5">Time Format</p>
          <div className="flex flex-wrap gap-2">
            {TIME_FORMATS.map(f => (
              <FormatOption key={f.id} value={f.id} current={timeFormat} onSelect={setTimeFormat} label={f.label} />
            ))}
          </div>
        </div>

        {/* Date format */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-2.5">Date Format</p>
          <div className="flex flex-wrap gap-2">
            {DATE_FORMATS.map(f => (
              <FormatOption key={f.id} value={f.id} current={dateFormat} onSelect={setDateFormat} label={f.label} />
            ))}
          </div>
        </div>
      </SettingSection>

      {/* ── Import Data ───────────────────────────────────────────────────────── */}
      <ImportSection />

      {/* ── Keyboard Shortcuts ───────────────────────────────────────────────── */}
      <ShortcutsSection />

      {/* Footer */}
      <DatabaseSection />

      <div className="text-center py-4">
        <p className="text-xs text-gray-400">All preferences are saved locally and persist across sessions.</p>
        <p className="text-xs text-gray-400 mt-1">{gymName} · v2.0.0</p>
      </div>
    </div>
  )
}
