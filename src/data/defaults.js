/**
 * Starting configuration for a fresh database. Everything here is editable
 * from Ρυθμίσεις — nothing in the app depends on these exact values.
 */

export const DEFAULT_SETTINGS = {
  gymName: 'Dojo Patras',
  logo: null,          // data: URL of a small image, or null
  warnDays: 5,         // "λήγει" this many days before coverage ends
  pauseDays: 30,       // after this many days without paying → "σε παύση"
  autoExportDay: null, // day of month for the automatic Excel (null = off)
  lastAutoExport: null,// "YYYY-MM" of the last automatic Excel
  reminderText: null,  // null = DEFAULT_REMINDER
  pin: null,           // see data/pin.js — hashes only
}

export const JUDO_BELTS = [
  { id: 'white',  name: 'Λευκή',     color: '#e5e7eb' },
  { id: 'yellow', name: 'Κίτρινη',   color: '#facc15' },
  { id: 'orange', name: 'Πορτοκαλί', color: '#fb923c' },
  { id: 'green',  name: 'Πράσινη',   color: '#22c55e' },
  { id: 'blue',   name: 'Μπλε',      color: '#3b82f6' },
  { id: 'brown',  name: 'Καφέ',      color: '#92400e' },
  { id: 'black',  name: 'Μαύρη',     color: '#111827' },
]

export const BJJ_BELTS = [
  { id: 'white',  name: 'Λευκή', color: '#e5e7eb' },
  { id: 'blue',   name: 'Μπλε',  color: '#3b82f6' },
  { id: 'purple', name: 'Μωβ',   color: '#9333ea' },
  { id: 'brown',  name: 'Καφέ',  color: '#92400e' },
  { id: 'black',  name: 'Μαύρη', color: '#111827' },
]

/** Plans: what a payment can cover. `price: null` = typed at payment time. */
export function plans(monthly) {
  return [
    { id: 'month', label: 'Μήνας',      unit: 'month', count: 1,  price: monthly },
    { id: 'half',  label: '15 ημέρες',  unit: 'day',   count: 15, price: monthly == null ? null : monthly / 2 },
    { id: 'week',  label: 'Εβδομάδα',   unit: 'week',  count: 1,  price: null },
    { id: 'day',   label: 'Ημέρα',      unit: 'day',   count: 1,  price: null },
  ]
}

export const DEFAULT_GROUPS = [
  { id: 'judokids', name: 'Judo Kids', color: '#2a78d6', order: 1, plans: plans(40), belts: JUDO_BELTS },
  { id: 'judo',     name: 'Judo',      color: '#eb6834', order: 2, plans: plans(50), belts: JUDO_BELTS },
  { id: 'bjj',      name: 'BJJ',       color: '#1baf7a', order: 3, plans: plans(50), belts: BJJ_BELTS },
]

/** Greek names for the belt ids used before v3. */
export const BELT_NAMES = {
  white: 'Λευκή', yellow: 'Κίτρινη', orange: 'Πορτοκαλί', green: 'Πράσινη',
  blue: 'Μπλε', purple: 'Μωβ', brown: 'Καφέ', black: 'Μαύρη',
}

/** Group colors, in the order new groups take them. Checked for colour-blind
 *  separation as a set (dataviz validator); violet is kept for seminars. */
export const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#e34948']
export const SEMINAR_COLOR = '#6250d6'
