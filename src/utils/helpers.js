import { format, parse } from 'date-fns'

// ─── Category ─────────────────────────────────────────────────────────────────
export const CATEGORY_LABELS = {
  judo:     'Judo',
  bjj:      'BJJ',
  fitness:  'Fitness',
  judokids: 'Judo Kids',
}

export const CATEGORIES = ['judo', 'bjj', 'fitness', 'judokids']

// Full static class strings — never interpolate Tailwind classes
export const CATEGORY_COLORS = {
  judo:     { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: '#3b82f6' },
  bjj:      { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: '#f97316' },
  fitness:  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: '#10b981' },
  judokids: { bg: 'bg-purple-100',  text: 'text-purple-700',  dot: '#a855f7' },
}

// Categories that require a belt
export const BELT_CATS = ['judo', 'bjj', 'judokids']

// ─── Belt ─────────────────────────────────────────────────────────────────────
export const BELTS = ['white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black']

export const BELT_COLORS = {
  white:  '#e2e8f0',
  yellow: '#eab308',
  orange: '#f97316',
  green:  '#22c55e',
  blue:   '#3b82f6',
  purple: '#a855f7',
  brown:  '#92400e',
  black:  '#1e293b',
}

export const BELT_LABELS = {
  white:  'White',
  yellow: 'Yellow',
  orange: 'Orange',
  green:  'Green',
  blue:   'Blue',
  purple: 'Purple',
  brown:  'Brown',
  black:  'Black',
}

/**
 * Returns an array of { category, belt } pairs for a member.
 * Supports both old `belt` (string) and new `belts` (object) format.
 * Pass `services` array to dynamically determine which categories use belts;
 * falls back to the hardcoded BELT_CATS list if not provided.
 */
export function getMemberBelts(member, services = null) {
  if (!member) return []
  const beltCats = services
    ? services.filter(s => s.usesBelts).map(s => s.id)
    : BELT_CATS
  const relevantCats = (member.categories ?? []).filter(c => beltCats.includes(c))
  if (relevantCats.length === 0) return []

  // New format: belts is an object { judo: 'blue', bjj: 'white' }
  if (member.belts && typeof member.belts === 'object') {
    return relevantCats
      .filter(c => member.belts[c])
      .map(c => ({ category: c, belt: member.belts[c] }))
  }

  // Legacy format: single belt string
  if (member.belt) {
    return relevantCats.map(c => ({ category: c, belt: member.belt }))
  }

  return []
}

// ─── Payment / Member Status ───────────────────────────────────────────────────
export const STATUS_CLASSES = {
  paid:     { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Paid' },
  unpaid:   { bg: 'bg-red-100',    text: 'text-red-600',    label: 'Unpaid' },
  late:     { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Late' },
  active:   { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Active' },
  inactive: { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Inactive' },
}

// ─── Date / Month helpers ──────────────────────────────────────────────────────

/** "2026-03" → "March 2026" */
export function formatMonth(isoMonth) {
  try {
    return format(parse(isoMonth, 'yyyy-MM', new Date()), 'MMMM yyyy')
  } catch {
    return isoMonth
  }
}

/** "2026-03" → "Mar '26" */
export function formatMonthShort(isoMonth) {
  try {
    return format(parse(isoMonth, 'yyyy-MM', new Date()), "MMM ''yy")
  } catch {
    return isoMonth
  }
}

/** Returns "Jan", "Feb", ... "Dec" for month index 0-11 */
export function monthName(idx) {
  return format(new Date(2000, idx, 1), 'MMM')
}

/** Converts Firestore Timestamp or plain Date to JS Date */
export function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  return new Date(value)
}

/** ISO date string for <input type="date"> */
export function toInputDate(value) {
  const d = toDate(value)
  return d ? d.toISOString().slice(0, 10) : ''
}

/** Formats a date value to "15 Sep 2024" */
export function formatDate(value) {
  const d = toDate(value)
  return d ? format(d, 'd MMM yyyy') : '—'
}

// ─── Currency ─────────────────────────────────────────────────────────────────
export function formatCurrency(amount) {
  return `€${(Number(amount) || 0).toFixed(0)}`
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function getInitials(name = '') {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const AVATAR_COLORS = [
  'bg-primary-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-violet-500', 'bg-rose-500', 'bg-teal-500', 'bg-amber-500',
]
export function getAvatarColor(name = '') {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

// ─── Current month / year ─────────────────────────────────────────────────────
export function currentMonthStr() {
  return format(new Date(), 'yyyy-MM')
}

export function currentYear() {
  return new Date().getFullYear()
}

/** All 12 month strings for a given year, capped at the current month */
export function monthsForYear(year) {
  const now = currentMonthStr()
  return Array.from({ length: 12 }, (_, i) => {
    const m = format(new Date(year, i, 1), 'yyyy-MM')
    return m
  }).filter(m => m <= now)
}

/** Converts a #rrggbb hex color to rgba(r,g,b,alpha) */
export function hexToRgba(hex = '#000000', alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}
