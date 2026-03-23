import { useState, useMemo } from 'react'
import { FileSpreadsheet, Download, Users, CreditCard, Activity, MessageSquare, FileJson, History, RotateCcw } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useServices } from '../contexts/ServicesContext'
import { useSchedule } from '../contexts/ScheduleContext'
import { exportToExcel, exportToJSON, getAutoBackups } from '../utils/export'
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
  const { members, payments, comments, attendance, beltHistory, memberNotes } = useData()
  const { services }                    = useServices()
  const { classes, events }             = useSchedule()
  const [tab,           setTab]         = useState('excel') // 'excel' | 'json' | 'backups'
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter,   setStatusFilter]   = useState('')
  const [exporting,      setExporting]      = useState(false)

  // Auto-backups list
  const autoBackups = useMemo(() => getAutoBackups(), [])

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
    { id: 'backups', label: '🕐 Backups', desc: `${autoBackups.length} saved` },
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
              <strong>Auto-backups</strong> are saved locally each day the app loads. The 3 most recent are kept.
              For a permanent off-device backup, use the JSON export above.
            </p>
          </div>
          {autoBackups.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No auto-backups yet. Backups are created automatically when the app loads each day.</p>
          ) : (
            <div className="space-y-2">
              {autoBackups.map(b => (
                <div key={b.date} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <History size={14} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">{b.date}</p>
                    <p className="text-[11px] text-gray-400">
                      {b.savedAt ? new Date(b.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      {' · '}
                      {b.size > 0 ? `${(b.size / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">saved</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 text-center pt-1">
            To download a backup, switch to the <strong>JSON</strong> tab.
          </p>
        </div>
      )}
    </Modal>
  )
}
