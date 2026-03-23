/**
 * Dojo Patras — Excel Export Utility
 *
 * Uses ExcelJS (lazy-loaded) for full cell styling support.
 * Produces a single .xlsx with three sheets:
 *   1. Members    — roster with belts, stats, contact info
 *   2. Payments   — individual records, color-coded by status
 *   3. Activity   — member × month grid, color-coded, with comments as cell notes
 */

import { formatDate, formatMonth, CATEGORY_LABELS, getMemberBelts, BELT_LABELS } from './helpers'

// ── Color palette (ARGB hex, no #) ────────────────────────────────────────────
const C = {
  headerBg: 'FF1E293B', headerFg: 'FFFFFFFF',
  subHeaderBg: 'FF334155', subHeaderFg: 'FFE2E8F0',
  paid:     { bg: 'FFC6EFCE', fg: 'FF276221' },
  late:     { bg: 'FFFFEB9C', fg: 'FF9C6500' },
  unpaid:   { bg: 'FFFFC7CE', fg: 'FF9C0006' },
  inactive: { bg: 'FFF2F2F2', fg: 'FF808080' },
  active:   { bg: 'FFC6EFCE', fg: 'FF276221' },
  empty:    { bg: 'FFFFFFFF', fg: 'FFCCCCCC' },
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function headerCell() {
  return {
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } },
    font:      { bold: true, color: { argb: C.headerFg }, size: 10 },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false },
    border:    { bottom: { style: 'medium', color: { argb: 'FF475569' } } },
  }
}

function statusCell(status) {
  const col = status === 'paid'     ? C.paid
            : status === 'late'     ? C.late
            : status === 'unpaid'   ? C.unpaid
            : status === 'active'   ? C.active
            : status === 'inactive' ? C.inactive
            : C.empty
  return {
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: col.bg } },
    font:      { bold: true, color: { argb: col.fg }, size: 10 },
    alignment: { horizontal: 'center', vertical: 'middle' },
  }
}

function applyHeader(row) {
  row.eachCell(cell => Object.assign(cell, { style: headerCell() }))
  row.height = 22
}

function setColWidths(sheet, widths) {
  sheet.columns = widths.map(width => ({ width }))
}

// ── Sheet 1: Members ──────────────────────────────────────────────────────────
function buildMembersSheet(wb, members, payments) {
  const ws = wb.addWorksheet('Members', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  // Build payment stats per member
  const statsMap = {}
  for (const p of payments) {
    if (!statsMap[p.memberId]) statsMap[p.memberId] = { total: 0, paid: 0, revenue: 0 }
    statsMap[p.memberId].total++
    if (p.status === 'paid' || p.status === 'late') {
      statsMap[p.memberId].paid++
      statsMap[p.memberId].revenue += p.amount ?? 0
    }
  }

  ws.addRow([
    'Name', 'Phone', 'Email', 'Sports',
    'Judo Belt', 'BJJ Belt', 'Judo Kids Belt',
    'Join Date', 'Status', 'Notes',
    'Months Tracked', 'Months Paid', 'Collection Rate', 'Total Revenue (€)',
  ])
  applyHeader(ws.lastRow)
  setColWidths(ws, [24, 16, 28, 22, 14, 14, 16, 14, 10, 30, 15, 13, 16, 18])

  for (const m of members) {
    const belts = getMemberBelts(m)
    const beltFor = cat => {
      const b = belts.find(x => x.category === cat)
      return b ? BELT_LABELS[b.belt] : ''
    }
    const cats  = (m.categories ?? []).map(c => CATEGORY_LABELS[c]).join(', ')
    const stats = statsMap[m.id] ?? { total: 0, paid: 0, revenue: 0 }
    const rate  = stats.total > 0 ? `${Math.round((stats.paid / stats.total) * 100)}%` : '—'

    const row = ws.addRow([
      m.name,
      m.phone || '',
      m.email || '',
      cats,
      beltFor('judo'),
      beltFor('bjj'),
      beltFor('judokids'),
      formatDate(m.joinDate),
      m.status,
      m.notes || '',
      stats.total,
      stats.paid,
      rate,
      stats.revenue,
    ])

    // Color-code the Status column (col 9)
    const statusCol = row.getCell(9)
    statusCol.style = statusCell(m.status)

    // Shade revenue cell
    row.getCell(14).font = { bold: true }

    row.height = 18
  }
}

// ── Sheet 2: Payments ─────────────────────────────────────────────────────────
function buildPaymentsSheet(wb, members, payments) {
  const ws = wb.addWorksheet('Payments', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))

  ws.addRow(['Member', 'Sports', 'Month', 'Amount (€)', 'Status', 'Paid On'])
  applyHeader(ws.lastRow)
  setColWidths(ws, [24, 22, 14, 14, 10, 16])

  // Sort by month desc, then member name
  const sorted = [...payments].sort((a, b) =>
    b.month.localeCompare(a.month) || (memberMap[a.memberId]?.name ?? '').localeCompare(memberMap[b.memberId]?.name ?? '')
  )

  for (const p of sorted) {
    const member = memberMap[p.memberId]
    const cats   = ((member?.categories ?? []).map(c => CATEGORY_LABELS[c])).join(', ')
    const row = ws.addRow([
      member?.name ?? p.memberId,
      cats,
      formatMonth(p.month),
      p.amount ?? 0,
      p.status,
      p.paidAt ? formatDate(p.paidAt) : '',
    ])

    // Color the Status cell (col 5)
    row.getCell(5).style = statusCell(p.status)

    // Bold amount
    row.getCell(4).font  = { bold: true }
    row.getCell(4).alignment = { horizontal: 'right' }
    row.height = 18
  }
}

// ── Sheet 3: Activity Grid ────────────────────────────────────────────────────
function buildActivitySheet(wb, members, payments, comments) {
  const ws = wb.addWorksheet('Activity Grid', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1, topLeftCell: 'B2' }],
  })

  // Collect all unique months from payments, sorted
  const monthSet = new Set(payments.map(p => p.month))
  const months   = [...monthSet].sort()

  if (months.length === 0) {
    ws.addRow(['No activity data available'])
    return
  }

  // Build lookup maps
  const payMap     = {}  // 'memberId:month' → payment
  const commentMap = {}  // 'memberId:month' → comment text
  for (const p of payments) payMap[`${p.memberId}:${p.month}`] = p
  for (const c of (comments ?? [])) commentMap[`${c.memberId}:${c.month}`] = c.text

  // Header row: "Member" + one column per month
  const headerRow = ws.addRow(['Member', ...months.map(m => {
    // Format "2026-03" → "Mar '26"
    try {
      const [y, mo] = m.split('-')
      const d = new Date(+y, +mo - 1, 1)
      return d.toLocaleString('en', { month: 'short', year: '2-digit' })
    } catch { return m }
  })])
  applyHeader(headerRow)

  // Set column widths: name col = 24, month cols = 8 each
  ws.getColumn(1).width = 24
  for (let i = 2; i <= months.length + 1; i++) ws.getColumn(i).width = 8

  // Status display labels
  const LABELS = { paid: '✓', late: '!', unpaid: '✕' }

  const sorted = [...members].sort((a, b) => {
    if (a.status === b.status) return a.name.localeCompare(b.name)
    return a.status === 'active' ? -1 : 1
  })

  for (const m of sorted) {
    const rowData = [m.name]

    for (const month of months) {
      const p = payMap[`${m.id}:${month}`]
      if (m.status === 'inactive') {
        rowData.push('—')
      } else if (!p) {
        rowData.push('')
      } else {
        rowData.push(LABELS[p.status] ?? p.status)
      }
    }

    const row = ws.addRow(rowData)
    row.height = 18

    // Bold member name
    row.getCell(1).font = { bold: m.status === 'active', color: { argb: m.status === 'inactive' ? 'FF94A3B8' : 'FF1E293B' } }

    // Color each month cell
    months.forEach((month, idx) => {
      const cell = row.getCell(idx + 2)
      const p    = payMap[`${m.id}:${month}`]

      if (m.status === 'inactive') {
        cell.style = statusCell('inactive')
      } else if (p) {
        cell.style = statusCell(p.status)
      } else {
        cell.style = {
          fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
          alignment: { horizontal: 'center' },
        }
      }

      // Add Excel cell note if there's a comment
      const comment = commentMap[`${m.id}:${month}`]
      if (comment) {
        cell.note = { texts: [{ font: { size: 9 }, text: comment }] }
      }
    })
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * @param {object[]} members
 * @param {object[]} payments
 * @param {object[]} comments
 * @param {object}   options   { categoryFilter, statusFilter }
 */
export async function exportToExcel(members, payments, comments = [], options = {}) {
  const { categoryFilter = '', statusFilter = '' } = options

  // Apply filters
  const filteredMembers = members.filter(m => {
    const matchCat    = !categoryFilter || (m.categories ?? []).includes(categoryFilter)
    const matchStatus = !statusFilter   || m.status === statusFilter
    return matchCat && matchStatus
  })
  const memberIds       = new Set(filteredMembers.map(m => m.id))
  const filteredPayments = payments.filter(p => memberIds.has(p.memberId))
  const filteredComments = comments.filter(c => memberIds.has(c.memberId))

  // Lazy-load ExcelJS (keeps initial JS bundle small)
  const ExcelJS   = (await import('exceljs')).default
  const wb        = new ExcelJS.Workbook()
  wb.creator      = 'Dojo Patras'
  wb.lastModifiedBy = 'Dojo Patras'
  wb.created      = new Date()
  wb.modified     = new Date()

  buildMembersSheet(wb, filteredMembers, filteredPayments)
  buildPaymentsSheet(wb, filteredMembers, filteredPayments)
  buildActivitySheet(wb, filteredMembers, filteredPayments, filteredComments)

  // Write to browser download
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  const date = new Date().toISOString().slice(0, 10)
  const tag  = categoryFilter ? `-${categoryFilter}` : ''
  a.download = `dojo-patras${tag}-${date}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── JSON Full Backup ──────────────────────────────────────────────────────────
/**
 * Export entire dataset as a downloadable JSON backup file.
 * Includes all collections with ISO date strings (Firebase Timestamps are converted).
 */
export function exportToJSON({ members, payments, attendance, beltHistory, memberNotes, comments, services, classes, events, instructors }) {
  const toPlain = (val) => {
    if (!val) return val
    if (typeof val.toDate === 'function') return val.toDate().toISOString()
    if (val instanceof Date) return val.toISOString()
    if (Array.isArray(val)) return val.map(toPlain)
    if (typeof val === 'object') {
      return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, toPlain(v)]))
    }
    return val
  }

  const backup = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    data: {
      members:     toPlain(members     ?? []),
      payments:    toPlain(payments    ?? []),
      attendance:  toPlain(attendance  ?? []),
      beltHistory: toPlain(beltHistory ?? []),
      memberNotes: toPlain(memberNotes ?? []),
      comments:    toPlain(comments    ?? []),
      services:    toPlain(services    ?? []),
      classes:     toPlain(classes     ?? []),
      events:      toPlain(events      ?? []),
      instructors: toPlain(instructors ?? []),
    }
  }

  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `dojo-patras-backup-${new Date().toISOString().slice(0,10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Auto-backup to localStorage (rolling 7-day window) ───────────────────────
/**
 * Saves a lightweight snapshot to localStorage as a safety net.
 * Keeps the 3 most recent daily backups.
 * Called automatically on app load after data is fetched.
 */
export function saveAutoBackup(data) {
  try {
    const today = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
    const KEY_PREFIX = 'dojo_autobackup_'
    const KEY_INDEX  = 'dojo_autobackup_index'

    // Don't save more than once per day
    const index = JSON.parse(localStorage.getItem(KEY_INDEX) ?? '[]')
    if (index.includes(today)) return

    const toPlain = (val) => {
      if (!val) return val
      if (typeof val.toDate === 'function') return val.toDate().toISOString()
      if (val instanceof Date) return val.toISOString()
      if (Array.isArray(val)) return val.map(toPlain)
      if (typeof val === 'object') return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, toPlain(v)]))
      return val
    }

    const snapshot = JSON.stringify({ savedAt: new Date().toISOString(), data: toPlain(data) })
    localStorage.setItem(KEY_PREFIX + today, snapshot)

    // Keep only 3 most recent backups
    const newIndex = [...index, today].slice(-3)
    newIndex.forEach((d, i) => {
      if (!newIndex.slice(-3).includes(d)) localStorage.removeItem(KEY_PREFIX + d)
    })
    // Clean old entries not in new index
    index.filter(d => !newIndex.includes(d)).forEach(d => localStorage.removeItem(KEY_PREFIX + d))
    localStorage.setItem(KEY_INDEX, JSON.stringify(newIndex))
  } catch (e) {
    // Storage quota exceeded or other error — fail silently
    console.warn('Auto-backup failed:', e)
  }
}

/**
 * Get list of available auto-backups from localStorage
 */
export function getAutoBackups() {
  const KEY_INDEX = 'dojo_autobackup_index'
  const KEY_PREFIX = 'dojo_autobackup_'
  const index = JSON.parse(localStorage.getItem(KEY_INDEX) ?? '[]')
  return index.map(date => {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + date)
      const parsed = JSON.parse(raw)
      return { date, savedAt: parsed.savedAt, size: raw.length }
    } catch {
      return { date, savedAt: null, size: 0 }
    }
  }).filter(b => b.savedAt)
}

/**
 * Restore from a specific auto-backup date (returns parsed data object)
 */
export function restoreAutoBackup(date) {
  const KEY_PREFIX = 'dojo_autobackup_'
  const raw = localStorage.getItem(KEY_PREFIX + date)
  if (!raw) throw new Error('Backup not found for ' + date)
  return JSON.parse(raw)
}
