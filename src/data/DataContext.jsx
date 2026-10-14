/**
 * App state: the five collections + settings, loaded once from the backend.
 * Every change is written to the database FIRST (as one atomic batch) and
 * only then applied to the screen, so what you see is always what is stored.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { backend, errorText } from './backend.js'
import { migrateLegacy } from './migrate.js'
import { DEFAULT_GROUPS, DEFAULT_SETTINGS } from './defaults.js'
import { allStatuses, newId, sortedGroups } from './model.js'
import { today as todayStr } from './dates.js'

export const COLLECTIONS = ['groups', 'members', 'payments', 'promotions', 'seminars']
const SETTINGS_KEY = 'app'
const SCHEMA_KEY = 'schema'
const SCHEMA_VERSION = '3'

const DataContext = createContext(null)

const EMPTY = Object.fromEntries(COLLECTIONS.map(c => [c, []]))

const put = (collection, data) => ({ op: 'put', collection, id: data.id, data })
const del = (collection, id) => ({ op: 'delete', collection, id })

/** Same ops, applied to the in-memory collections. */
function applyLocal(data, ops) {
  const next = { ...data }
  for (const op of ops) {
    const list = next[op.collection] ?? []
    const rest = list.filter(x => x.id !== op.id)
    next[op.collection] = op.op === 'put' ? [...rest, op.data] : rest
  }
  return next
}

/** First launch of v3: migrate v2 tables, or seed a fresh database. */
async function prepareDatabase() {
  const schema = await backend.getSetting(SCHEMA_KEY)
  if (schema === SCHEMA_VERSION) return null
  const legacy = await backend.legacySnapshot()
  let ops = []
  let note = null
  if (legacy) {
    const migrated = migrateLegacy(legacy)
    for (const c of COLLECTIONS) ops.push(...migrated[c].map(d => put(c, d)))
    note = `Τα δεδομένα μεταφέρθηκαν στη νέα έκδοση: ${migrated.members.length} μέλη, ${migrated.payments.length} πληρωμές.`
  } else {
    const existing = await backend.loadAll()
    if (!existing.groups?.length) ops = DEFAULT_GROUPS.map(g => put('groups', g))
  }
  if (ops.length) await backend.apply(ops)
  await backend.setSetting(SCHEMA_KEY, SCHEMA_VERSION)
  return note
}

export function DataProvider({ children }) {
  const [data, setData] = useState(EMPTY)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState(null)
  const [notice, setNotice] = useState(null)
  const [today, setToday] = useState(todayStr)
  // Latest committed data (state lags a render behind) + the write queue
  const dataRef = useRef(EMPTY)
  const queue = useRef(Promise.resolve())

  // Keep "today" right when the app stays open past midnight
  useEffect(() => {
    const t = setInterval(() => setToday(prev => (prev === todayStr() ? prev : todayStr())), 60_000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setFatal(null)
    try {
      const setup = await backend.setup()
      const migrationNote = await prepareDatabase()
      const [docs, rawSettings] = await Promise.all([backend.loadAll(), backend.getSetting(SETTINGS_KEY)])
      let stored = {}
      try { stored = rawSettings ? JSON.parse(rawSettings) : {} } catch { /* keep defaults */ }
      setSettings({ ...DEFAULT_SETTINGS, ...stored })
      dataRef.current = Object.fromEntries(COLLECTIONS.map(c => [c, docs[c] ?? []]))
      setData(dataRef.current)
      setNotice([setup?.warning, migrationNote].filter(Boolean).join('\n') || null)
    } catch (err) {
      setFatal(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /**
   * Write a batch, then show it. Writes run one at a time, in order; pass a
   * function to build the batch from the latest data at its turn (so two quick
   * taps on the same record can never overwrite each other). Throws a
   * readable error on failure; later writes still run.
   */
  const commit = useCallback((opsOrFn) => {
    const run = queue.current.then(async () => {
      const ops = typeof opsOrFn === 'function' ? opsOrFn(dataRef.current) : opsOrFn
      if (!ops || ops.length === 0) return
      try {
        await backend.apply(ops)
      } catch (err) {
        throw new Error(errorText(err))
      }
      dataRef.current = applyLocal(dataRef.current, ops)
      setData(dataRef.current)
    })
    queue.current = run.catch(() => {})
    return run
  }, [])

  const now = () => new Date().toISOString()

  const actions = useMemo(() => ({
    // Members
    saveMember: (member, extraOps = []) => {
      const m = { createdAt: now(), ...member, id: member.id ?? newId() }
      return commit([put('members', m), ...extraOps]).then(() => m)
    },
    /** Removes the member with their payments, belts and seminar places. */
    deleteMember: (id) => commit(d => [
      del('members', id),
      ...d.payments.filter(p => p.memberId === id).map(p => del('payments', p.id)),
      ...d.promotions.filter(p => p.memberId === id).map(p => del('promotions', p.id)),
      ...d.seminars
        .filter(s => (s.participants ?? []).some(p => p.memberId === id))
        .map(s => put('seminars', { ...s, participants: s.participants.filter(p => p.memberId !== id) })),
    ]),

    // Payments
    savePayment: (payment) => {
      const p = { createdAt: now(), ...payment, id: payment.id ?? newId() }
      return commit([put('payments', p)]).then(() => p)
    },
    /** Several payments in one atomic write (family payment). */
    savePayments: (list) => {
      const ps = list.map(p => ({ createdAt: now(), ...p, id: p.id ?? newId() }))
      return commit(ps.map(p => put('payments', p))).then(() => ps)
    },
    deletePayment: (id) => commit([del('payments', id)]),
    deletePayments: (ids) => commit(ids.map(id => del('payments', id))),

    // Belts
    savePromotion: (promo) => {
      const p = { createdAt: now(), ...promo, id: promo.id ?? newId() }
      return commit([put('promotions', p)]).then(() => p)
    },
    deletePromotion: (id) => commit([del('promotions', id)]),

    // Seminars
    saveSeminar: (seminar) => {
      const s = { createdAt: now(), participants: [], ...seminar, id: seminar.id ?? newId() }
      return commit([put('seminars', s)]).then(() => s)
    },
    /** Change a seminar from its latest stored version: fn(seminar) → seminar. */
    updateSeminar: (id, fn) => commit(d => {
      const s = d.seminars.find(x => x.id === id)
      return s ? [put('seminars', fn(s))] : []
    }),
    deleteSeminar: (id) => commit([del('seminars', id)]),

    // Groups
    saveGroup: (group) => {
      const g = { order: dataRef.current.groups.length + 1, plans: [], belts: [], ...group, id: group.id ?? newId() }
      return commit([put('groups', g)]).then(() => g)
    },
    deleteGroup: (id) => commit(d => {
      if (d.members.some(m => (m.enrollments ?? []).some(e => e.groupId === id))) {
        throw new Error('Υπάρχουν μέλη σε αυτό το τμήμα. Βγάλε τα πρώτα από το τμήμα.')
      }
      return [del('groups', id)]
    }),

    // Settings
    saveSettings: async (patch) => {
      const next = { ...settings, ...patch }
      await backend.setSetting(SETTINGS_KEY, JSON.stringify(next))
      setSettings(next)
    },

    reload: load,
    dismissNotice: () => setNotice(null),
  }), [commit, settings, load])

  const groups = useMemo(() => sortedGroups(data.groups), [data.groups])
  const statuses = useMemo(
    () => allStatuses(data.members, data.payments, settings, today),
    [data.members, data.payments, settings, today],
  )

  const value = useMemo(() => ({
    ...data, groups, settings, statuses, today, loading, fatal, notice, ...actions,
  }), [data, groups, settings, statuses, today, loading, fatal, notice, actions])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

export function useGroup(id) {
  const { groups } = useData()
  return groups.find(g => g.id === id) ?? null
}
