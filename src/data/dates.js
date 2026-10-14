/**
 * Calendar-date helpers. Every date in the data is a local "YYYY-MM-DD"
 * string — never a Date or an ISO timestamp — so a payment made at 23:30
 * can't drift to the next day through a timezone conversion.
 */

const pad = (n) => String(n).padStart(2, '0')

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false
  return toISODate(parseDate(s)) === s
}

export function today() {
  return toISODate(new Date())
}

export function addDays(s, n) {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Adds calendar months, clamping to the month's last day (31/01 + 1 → 28/02). */
export function addMonths(s, n) {
  const d = parseDate(s)
  const day = d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, lastDay))
  return toISODate(target)
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86_400_000)
}

/** "YYYY-MM" of a date string. */
export const monthOf = (s) => String(s).slice(0, 7)

export function addMonthKeys(month, n) {
  return monthOf(addMonths(`${month}-01`, n))
}

/** The `count` month keys ending with `lastMonth`, oldest first. */
export function monthRange(lastMonth, count) {
  return Array.from({ length: count }, (_, i) => addMonthKeys(lastMonth, i - count + 1))
}

/** Last day of a "YYYY-MM" month. */
export function monthEnd(month) {
  return addDays(addMonths(`${month}-01`, 1), -1)
}

const MONTHS_SHORT = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ']
const MONTHS_LONG = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος']
const WEEKDAYS = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο']

/** 14/10 */
export function fmtDay(s) {
  if (!s) return ''
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}

/** 14/10/2026 */
export function fmtDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

/** "Οκτ" or "Οκτ 26" */
export function fmtMonthShort(month, withYear = false) {
  const [y, m] = month.split('-')
  return withYear ? `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}` : MONTHS_SHORT[Number(m) - 1]
}

/** "Οκτώβριος 2026" */
export function fmtMonthLong(month) {
  const [y, m] = month.split('-')
  return `${MONTHS_LONG[Number(m) - 1]} ${y}`
}

/** "Τρίτη 14 Οκτωβρίου" style heading, kept simple: "Τρίτη 14/10" */
export function fmtWeekday(s) {
  return `${WEEKDAYS[parseDate(s).getDay()]} ${fmtDay(s)}`
}

/** Human distance: "σήμερα", "αύριο", "σε 3 μέρες", "πριν 5 μέρες". */
export function fmtRelative(fromToday) {
  const n = fromToday
  if (n === 0) return 'σήμερα'
  if (n === 1) return 'αύριο'
  if (n === -1) return 'χθες'
  if (n > 1) return `σε ${n} μέρες`
  return `πριν ${-n} μέρες`
}
