/**
 * Excel export, laid out like the gym's own register: one sheet per group
 * (members down, months across, "50 € · 08/10" in each cell), plus flat
 * sheets of all payments, members and seminars.
 */

import { backend } from '../data/backend.js'
import { allStatuses, byName, money, paymentGrid, sortedGroups, STATUS } from '../data/model.js'
import { fmtDate, fmtDay, fmtMonthShort, monthOf, monthRange, today as todayStr } from '../data/dates.js'

/**
 * `members` may be a filtered list: then only their payments and seminar
 * places are exported, and `title` (the filter, in words) heads a first sheet.
 * `name` overrides the file name (e.g. the monthly automatic export).
 */
export async function exportExcel({ groups, members, payments: allPayments, seminars: allSeminars, settings, title, name: fileName }) {
  const ExcelJS = (await import('exceljs')).default
  const ids = new Set(members.map(m => m.id))
  const payments = allPayments.filter(p => ids.has(p.memberId))
  const seminars = allSeminars
    .map(s => ({ ...s, participants: (s.participants ?? []).filter(p => ids.has(p.memberId)) }))
    .filter(s => s.participants.length > 0)
  const wb = new ExcelJS.Workbook()
  wb.creator = settings.gymName
  const bold = { bold: true }
  const today = todayStr()
  const months = monthRange(monthOf(today), 12)
  const memberName = new Map(members.map(m => [m.id, m.name]))
  const groupName = new Map(groups.map(g => [g.id, g.name]))
  const sheetNames = new Set()
  const safeName = (name) => {
    let n = String(name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || 'Τμήμα'
    while (sheetNames.has(n)) n = `${n.slice(0, 26)}_`
    sheetNames.add(n)
    return n
  }

  if (title) {
    const info = wb.addWorksheet(safeName('Λίστα'))
    info.addRow([settings.gymName]).font = bold
    info.addRow([`Φίλτρο: ${title}`])
    info.addRow([`Μέλη: ${members.length}`])
    info.addRow([`Ημερομηνία: ${fmtDate(today)}`])
    info.getColumn(1).width = 60
  }

  for (const g of sortedGroups(groups)) {
    if (title && !members.some(m => (m.enrollments ?? []).some(e => e.groupId === g.id))) continue
    const ws = wb.addWorksheet(safeName(g.name))
    ws.addRow([g.name, ...months.map(m => fmtMonthShort(m, true))]).font = bold
    for (const row of paymentGrid(members, payments, g.id, months)) {
      ws.addRow([
        row.member.name,
        ...row.cells.map(c => (c.payments.length
          ? c.payments.map(p => `${money(p.amount)} € · ${fmtDay(p.date)}`).join(' + ')
          : c.covered ? '✓' : '')),
      ])
    }
    ws.getColumn(1).width = 30
    for (let i = 2; i <= months.length + 1; i++) ws.getColumn(i).width = 14
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  }

  const pays = wb.addWorksheet(safeName('Πληρωμές'))
  pays.addRow(['Ημερομηνία', 'Μέλος', 'Τμήμα', 'Τι', 'Καλύπτει από', 'έως', 'Ποσό €', 'Σημείωση']).font = bold
  for (const p of [...payments].sort((a, b) => b.date.localeCompare(a.date))) {
    pays.addRow([fmtDate(p.date), memberName.get(p.memberId) ?? '', groupName.get(p.groupId) ?? '', p.label ?? '',
      fmtDate(p.from), fmtDate(p.to), money(p.amount), p.note ?? ''])
  }
  ;[12, 30, 14, 14, 14, 12, 10, 30].forEach((w, i) => { pays.getColumn(i + 1).width = w })

  const statuses = allStatuses(members, payments, settings, today)
  const mem = wb.addWorksheet(safeName('Μέλη'))
  mem.addRow(['Όνομα', 'Τηλέφωνο', 'Τμήματα', 'Κατάσταση', 'Πληρωμένος έως', 'Σημειώσεις']).font = bold
  for (const m of [...members].sort(byName)) {
    const st = statuses.get(m.id)
    const until = (st?.items ?? []).map(i => (i.until ? `${groupName.get(i.groupId)}: ${fmtDate(i.until)}` : '')).filter(Boolean).join(', ')
    mem.addRow([m.name, m.phone ?? '', (m.enrollments ?? []).map(e => groupName.get(e.groupId)).join(', '),
      STATUS[st?.overall ?? 'paused'].label, until, m.notes ?? ''])
  }
  ;[30, 16, 24, 16, 30, 50].forEach((w, i) => { mem.getColumn(i + 1).width = w })

  if (seminars.length) {
    const sem = wb.addWorksheet(safeName('Σεμινάρια'))
    sem.addRow(['Σεμινάριο', 'Ημερομηνία', 'Μέλος', 'Ποσό €', 'Πλήρωσε']).font = bold
    for (const s of [...seminars].sort((a, b) => b.date.localeCompare(a.date))) {
      for (const p of s.participants ?? []) {
        sem.addRow([s.title, fmtDate(s.date), memberName.get(p.memberId) ?? '', money(p.amount), p.paidOn ? fmtDate(p.paidOn) : 'όχι'])
      }
    }
    ;[30, 12, 30, 10, 12].forEach((w, i) => { sem.getColumn(i + 1).width = w })
  }

  const buffer = await wb.xlsx.writeBuffer()
  const name = fileName ?? (title ? `dojo-patras-lista-${today}.xlsx` : `dojo-patras-${today}.xlsx`)
  return backend.saveExport(name, new Uint8Array(buffer))
}
