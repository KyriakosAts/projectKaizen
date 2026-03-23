/**
 * sheetsService.js
 *
 * Unified data service — automatically picks the right backend:
 *   • Tauri desktop app  →  Rust commands → Google Sheets API
 *   • Browser / dev mode →  localStorage  (full CRUD, no network needed)
 *
 * Every export has the exact same signature in both modes, so DataContext
 * never needs to know which backend is active.
 */

// ── Tauri detection ───────────────────────────────────────────────────────────
export const isTauri = () =>
  typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined

// ── localStorage fallback DB ──────────────────────────────────────────────────
// Used automatically when running outside the Tauri webview (browser / npm run dev)

const LS = {
  members:           'dojo_members',
  payments:          'dojo_payments',
  attendance:        'dojo_attendance',
  beltHistory:       'dojo_belt_history',
  notes:             'dojo_member_notes',
  comments:          'dojo_comments',
  servicesConfig:    'dojo_services_config',
  scheduleConfig:    'dojo_schedule_config',
  instructorsConfig: 'dojo_instructors_config',
}

const ls = {
  get: (key, def = []) => {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? def }
    catch { return def }
  },
  set:   (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  getRaw: (key)     => localStorage.getItem(key) ?? null,
  setRaw: (key, v)  => localStorage.setItem(key, v),
  uid:   ()         => `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  now:   ()         => new Date().toISOString(),
}

// Command handlers for localStorage mode — mirror every Tauri command exactly
const LOCAL = {
  // ── Setup ──────────────────────────────────────────────────────────────────
  setup_spreadsheet:       ()   => null,
  get_app_config:          ()   => ({ spreadsheetId: null, backupFolderId: null, lastBackup: null }),
  connect_spreadsheet:     ()   => ({ spreadsheetId: 'local', backupFolderId: '', created: false }),
  get_service_account_email: () => 'local-mode@localStorage',

  // ── Members ────────────────────────────────────────────────────────────────
  get_members: () => ls.get(LS.members, []),

  add_member: ({ data }) => {
    const id = ls.uid()
    const rows = ls.get(LS.members, [])
    rows.unshift({ ...data, id, createdAt: ls.now(), updatedAt: ls.now() })
    ls.set(LS.members, rows)
    return id
  },

  update_member: ({ id, data }) => {
    const rows = ls.get(LS.members, [])
    const i = rows.findIndex(m => m.id === id)
    if (i !== -1) rows[i] = { ...rows[i], ...data, updatedAt: ls.now() }
    ls.set(LS.members, rows)
  },

  delete_member_cascade: ({ id }) => {
    ls.set(LS.members,     ls.get(LS.members,     []).filter(m => m.id       !== id))
    ls.set(LS.payments,    ls.get(LS.payments,    []).filter(p => p.memberId !== id))
    ls.set(LS.attendance,  ls.get(LS.attendance,  []).filter(a => a.memberId !== id))
    ls.set(LS.beltHistory, ls.get(LS.beltHistory, []).filter(b => b.memberId !== id))
    ls.set(LS.notes,       ls.get(LS.notes,       []).filter(n => n.memberId !== id))
    ls.set(LS.comments,    ls.get(LS.comments,    []).filter(c => c.memberId !== id))
  },

  // ── Payments ───────────────────────────────────────────────────────────────
  get_payments: () => ls.get(LS.payments, []),

  add_payment: ({ data }) => {
    const id = ls.uid()
    const rows = ls.get(LS.payments, [])
    rows.unshift({ ...data, id, createdAt: ls.now() })
    ls.set(LS.payments, rows)
    return id
  },

  mark_payment_paid: ({ id }) => {
    const rows = ls.get(LS.payments, [])
    const i = rows.findIndex(p => p.id === id)
    if (i !== -1) rows[i] = { ...rows[i], status: 'paid', paidAt: ls.now() }
    ls.set(LS.payments, rows)
  },

  mark_payment_unpaid: ({ id }) => {
    const rows = ls.get(LS.payments, [])
    const i = rows.findIndex(p => p.id === id)
    if (i !== -1) rows[i] = { ...rows[i], status: 'unpaid', paidAt: null }
    ls.set(LS.payments, rows)
  },

  // ── Attendance ─────────────────────────────────────────────────────────────
  get_attendance: () => ls.get(LS.attendance, []),

  log_attendance: ({ data }) => {
    const id = ls.uid()
    const rows = ls.get(LS.attendance, [])
    rows.unshift({ ...data, id, createdAt: ls.now() })
    ls.set(LS.attendance, rows)
    return id
  },

  remove_attendance: ({ id }) => {
    ls.set(LS.attendance, ls.get(LS.attendance, []).filter(a => a.id !== id))
  },

  // ── Belt History ───────────────────────────────────────────────────────────
  get_belt_history: () => ls.get(LS.beltHistory, []),

  add_belt_promotion: ({ memberId, data }) => {
    const id = ls.uid()
    const rows = ls.get(LS.beltHistory, [])
    rows.unshift({ ...data, id, memberId, createdAt: ls.now() })
    ls.set(LS.beltHistory, rows)
    return id
  },

  // ── Member Notes ───────────────────────────────────────────────────────────
  get_member_notes: () => ls.get(LS.notes, []),

  add_member_note: ({ memberId, text }) => {
    const id = ls.uid()
    const rows = ls.get(LS.notes, [])
    rows.unshift({ id, memberId, text, createdAt: ls.now() })
    ls.set(LS.notes, rows)
    return id
  },

  delete_member_note: ({ noteId }) => {
    ls.set(LS.notes, ls.get(LS.notes, []).filter(n => n.id !== noteId))
  },

  // ── Comments ───────────────────────────────────────────────────────────────
  get_comments: () => ls.get(LS.comments, []),

  upsert_comment: ({ memberId, month, text }) => {
    const rows = ls.get(LS.comments, [])
    const i    = rows.findIndex(c => c.memberId === memberId && c.month === month)
    if (!text?.trim()) {
      if (i !== -1) rows.splice(i, 1)
    } else if (i !== -1) {
      rows[i] = { ...rows[i], text, updatedAt: ls.now() }
    } else {
      rows.push({ id: ls.uid(), memberId, month, text, updatedAt: ls.now() })
    }
    ls.set(LS.comments, rows)
  },

  // ── Config (stored as raw JSON strings, same as Tauri returns them) ────────
  get_services_config:    ()       => ls.getRaw(LS.servicesConfig),
  save_services_config:   ({ json }) => ls.setRaw(LS.servicesConfig,    json),
  get_schedule_config:    ()       => ls.getRaw(LS.scheduleConfig),
  save_schedule_config:   ({ json }) => ls.setRaw(LS.scheduleConfig,    json),
  get_instructors_config: ()       => ls.getRaw(LS.instructorsConfig),
  save_instructors_config:({ json }) => ls.setRaw(LS.instructorsConfig, json),

  // ── Backup (no-op in local mode) ───────────────────────────────────────────
  create_backup: () => null,
  list_backups:  () => [],
}

// ── Unified dispatcher ────────────────────────────────────────────────────────
// Routes to Tauri OR localStorage automatically.
async function call(cmd, args = {}) {
  if (isTauri()) {
    // Dynamic import so the module doesn't crash when loaded outside Tauri
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke(cmd, args)
  }
  const handler = LOCAL[cmd]
  if (!handler) return Promise.reject(new Error(`[sheetsService] Unknown local command: ${cmd}`))
  return Promise.resolve(handler(args))
}

// ── Public API ────────────────────────────────────────────────────────────────
// (identical signatures to the old Tauri-only version)

export const setupSpreadsheet          = ()    => call('setup_spreadsheet')
export const getAppConfig              = ()    => call('get_app_config')
export const connectSpreadsheet        = (id)  => call('connect_spreadsheet', { spreadsheetId: id })
export const getServiceAccountEmail    = ()    => call('get_service_account_email')

export const getMembers           = ()                    => call('get_members')
export const addMember            = (data)                => call('add_member',             { data })
export const updateMember         = (id, data)            => call('update_member',          { id, data })
export const deleteMemberCascade  = (id)                  => call('delete_member_cascade',  { id })

export const getPayments          = ()                    => call('get_payments')
export const addPayment           = (data)                => call('add_payment',            { data })
export const markPaymentPaid      = (id)                  => call('mark_payment_paid',      { id })
export const markPaymentUnpaid    = (id)                  => call('mark_payment_unpaid',    { id })

export const getAttendance        = ()                    => call('get_attendance')
export const logAttendance        = (data)                => call('log_attendance',         { data })
export const removeAttendance     = (id)                  => call('remove_attendance',      { id })

export const getBeltHistory       = ()                    => call('get_belt_history')
export const addBeltPromotion     = (memberId, data)      => call('add_belt_promotion',     { memberId, data })

export const getMemberNotes       = ()                    => call('get_member_notes')
export const addMemberNote        = (memberId, text)      => call('add_member_note',        { memberId, text })
export const deleteMemberNote     = (noteId)              => call('delete_member_note',     { noteId })

export const getComments          = ()                    => call('get_comments')
export const upsertComment        = (memberId, month, text) => call('upsert_comment',      { memberId, month, text })

export const getServicesConfig    = ()                    => call('get_services_config')
export const saveServicesConfig   = (json)                => call('save_services_config',   { json })
export const getScheduleConfig    = ()                    => call('get_schedule_config')
export const saveScheduleConfig   = (json)                => call('save_schedule_config',   { json })
export const getInstructorsConfig = ()                    => call('get_instructors_config')
export const saveInstructorsConfig= (json)                => call('save_instructors_config',{ json })

export const createBackup         = ()                    => call('create_backup')
export const listBackups          = ()                    => call('list_backups')
