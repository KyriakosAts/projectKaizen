import { useState, useMemo, useEffect } from 'react'
import { FileSpreadsheet, Download, Users, CreditCard, Activity, MessageSquare, FileJson, History, RotateCcw, HardDriveDownload, RefreshCw } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useServices } from '../contexts/ServicesContext'
import { useSchedule } from '../contexts/ScheduleContext'
import * as db from '../services/dataService'
import { exportToExcel, exportToJSON } from '../utils/export'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { CATEGORY_LABELS, CATEGORIES, CATEGORY_COLORS } from '../utils/helpers'

const STATUS_OPTS = [
  { value: '',         label: 'All Members' },
  { value: 'active',   label: 'Active only' },
  { value: 'inactive', label: 'Inactive only' },
]

function PreviewStat({ icon: Icon, label, count, color }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={14} />
      </div>
      <p className="flex-1 text-sm text-gray-700">{label}</p>
      <span className="text-sm font-bold text-gray-900 tabular-nums">{count}</span>
    </div>
  )
}

export default function ExportModal({ onClose }) {
  const { members, payments, comments, attendance, beltHistory, memberNotes, reload } = useData()
  const { services }                    = useServices()
  const { classes, events }             = useSchedule()
  const [tab,           setTab]         = useState('excel') // 'excel' | 'json' | 'backups'
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter,   setStatusFilter]   = useState('')
  const [exporting,      setExporting]      = useState(false)

  // Backup snapshots (files in the backup folder, newest first)
  const [backups,       setBackups]       = useState([])
  const [backupBusy,    setBackupBusy]    = useState(false)
  const [restoringName, setRestoringName] = useState(null)
  const [backupMsg,     setBackupMsg]     = useState(null) // { ok: bool, text: string }

  const refreshBackups = () => db.listBackups().then(setBackups).catch(() => setBackups([]))
  useEffect(() => { refreshBackups() }, [])

  async function handleBackupNow() {
    setBackupBusy(true); setBackupMsg(null)
    try {
      const info = await db.createBackup()
      setBackupMsg({ ok: true, text: info ? `Backup saved: ${info.name}` : 'Backups are only available in the desktop app.' })
      refreshBackups()
    } catch (e) {
      setBackupMsg({ ok: false, text: typeof e === 'string' ? e : e.message ?? 'Backup failed' })
    } finally {
      setBackupBusy(false)
    }
  }

  async function handleRestore(name) {
    const sure = window.confirm(
      `Restore "${name}"?\n\nAll current data will be replaced with this snapshot. ` +
      `A safety backup of the current data is taken automatically first, so you can undo this.`
    )
    if (!sure) return
    setRestoringName(name); setBackupMsg(null)
    try {
      const r = await db.restoreBackup(name)
      setBackupMsg({ ok: true, text: `Restored ${r.members} members, ${r.payments} payments, ${r.attendance} attendance records. Safety snapshot: ${r.safetyBackup}` })
      await reload()
      refreshBackups()
    } catch (e) {
      setBackupMsg({ ok: false, text: typeof e === 'string' ? e : e.message ?? 'Restore failed' })
    } finally {
      setRestoringName(null)
    }
  }

  // Live preview stats based on current filter selection
  const preview = useMemo(() => {
    const filteredMembers = members.filter(m => {
      const matchCat    = !categoryFilter || (m.categories ?? []).includes(categoryFilter)
      const matchStatus = !statusFilter   || m.status === statusFilter
      return matchCat && matchStatus
    })
    const memberIds        = new Set(filteredMembers.map(m => m.id))
    const filteredPayments = payments.filter(p => memberIds.has(p.memberId))
    const filteredComments = (comments ?? []).filter(c => memberIds.has(c.memberId))
    return {
      members:  filteredMembers.length,
      payments: filteredPayments.length,
      comments: filteredComments.length,
    }
  }, [members, payments, comments, categoryFilter, statusFilter])

  async function handleDownloadExcel() {
    setExporting(true)
    try {
      await exportToExcel(members, payments, comments ?? [], { categoryFilter, statusFilter })
      onClose()
    } finally {
      setExporting(false)
    }
  }

  function handleDownloadJSON() {
    exportToJSON({
      members, payments, attendance, beltHistory, memberNotes,
      comments, services, classes, events,
    })
    onClose()
  }

  // Tab labels
  const tabs = [
    { id: 'excel',   label: '📊 Excel',   desc: 'Spreadsheet export' },
    { id: 'json',    label: '{ } JSON',   desc: 'Full backup' },
    { id: 'backups', label: '🕐 Backups', desc: `${backups.length} saved` },
  ]

  return (
    <Modal
      title="Export & Backup"
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {tab === 'excel' && (
            <Button
              size="sm"
              onClick={handleDownloadExcel}
              loading={exporting}
              disabled={preview.members === 0}
            >
              <Download size={13} />
              {exporting ? 'Building…' : 'Download .xlsx'}
            </Button>
          )}
          {tab === 'json' && (
            <Button size="sm" onClick={handleDownloadJSON}>
              <FileJson size={13} /> Download .json
            </Button>
          )}
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex gap-0.5 bg-gray-100 rounded-xl p-0.5 mb-5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Excel tab ── */}
      {tab === 'excel' && (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Filters</p>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Sport</p>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setCategoryFilter('')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    categoryFilter === ''
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >All Sports</button>
                {CATEGORIES.map(cat => {
                  const isActive = categoryFilter === cat
                  const colors   = CATEGORY_COLORS[cat]
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(isActive ? '' : cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isActive
                          ? `${colors.bg} ${colors.text} border-transparent`
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >{CATEGORY_LABELS[cat]}</button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Member Status</p>
              <div className="flex gap-1.5">
                {STATUS_OPTS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      statusFilter === opt.value
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >{opt.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Export Preview</p>
            <div className="bg-gray-50 rounded-xl px-4 py-1">
              <PreviewStat icon={Users}         label="Members"                  count={preview.members}  color="bg-blue-100 text-blue-600" />
              <PreviewStat icon={CreditCard}    label="Payment records"          count={preview.payments} color="bg-emerald-100 text-emerald-600" />
              <PreviewStat icon={MessageSquare} label="Comments (as cell notes)" count={preview.comments} color="bg-primary-100 text-primary-600" />
            </div>
            {preview.members === 0 && (
              <p className="text-xs text-red-500 mt-2 text-center">No members match the selected filters.</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Sheets Included</p>
            <div className="space-y-1.5">
              {[
                { label: '1. Members',       desc: 'Roster, belts, stats, contact info' },
                { label: '2. Payments',      desc: 'All records · color-coded status' },
                { label: '3. Activity Grid', desc: 'Member × month grid · comments' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <FileSpreadsheet size={13} className="text-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-gray-700">{s.label}</span>
                  <span className="text-xs text-gray-400">— {s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── JSON tab ── */}
      {tab === 'json' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-sm font-semibold text-blue-900 mb-1">Full data backup</p>
            <p className="text-xs text-blue-700">
              Exports <strong>all collections</strong> — members, payments, attendance, belt history,
              notes, comments, services, schedule, and instructors — as a single timestamped JSON file.
              Use this to migrate data or restore from a backup.
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-1">
            <PreviewStat icon={Users}         label="Members"           count={members.length}     color="bg-blue-100 text-blue-600" />
            <PreviewStat icon={CreditCard}    label="Payments"          count={payments.length}    color="bg-emerald-100 text-emerald-600" />
            <PreviewStat icon={Activity}      label="Attendance records" count={attendance.length}  color="bg-purple-100 text-purple-600" />
            <PreviewStat icon={MessageSquare} label="Belt + Notes"      count={(beltHistory.length) + (memberNotes.length)} color="bg-amber-100 text-amber-600" />
          </div>
          <p className="text-xs text-gray-400 text-center">
            File: <code className="bg-gray-100 px-1 rounded">dojo-patras-backup-{new Date().toISOString().slice(0,10)}.json</code>
          </p>
        </div>
      )}

      {/* ── Backups tab ── */}
      {tab === 'backups' && (
        <div className="space-y-3">
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-xs text-amber-700">
              <strong>Snapshots</strong> are saved to the backup folder automatically on the first launch of each day
              (the 30 most recent are kept). You can take one manually, or restore any snapshot — a safety copy of the
              current data is always taken first.
            </p>
          </div>

          <button
            onClick={handleBackupNow}
            disabled={backupBusy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white text-xs font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {backupBusy ? <RefreshCw size={13} className="animate-spin" /> : <HardDriveDownload size={13} />}
            {backupBusy ? 'Backing up…' : 'Backup Now'}
          </button>

          {backupMsg && (
            <div className={`p-2.5 rounded-xl text-xs ${backupMsg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {backupMsg.text}
            </div>
          )}

          {backups.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No snapshots yet. One is created automatically each day the app starts.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {backups.map(b => (
                <div key={b.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <History size={14} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate" title={b.name}>{b.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {b.date}{b.sizeBytes ? ` · ${(b.sizeBytes / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(b.name)}
                    disabled={restoringName !== null}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {restoringName === b.name ? <RefreshCw size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
