/**
 * DataContext.jsx
 *
 * Central data layer for the Dojo Patras app.
 * All state is sourced from the local SQLite database via Tauri commands.
 * No Firebase. No mock mode. No localStorage migration.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as sheets from '../services/dataService'
import { saveAutoBackup } from '../utils/export'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [members,     setMembers]     = useState([])
  const [payments,    setPayments]    = useState([])
  const [comments,    setComments]    = useState([])
  const [beltHistory, setBeltHistory] = useState([])
  const [memberNotes, setMemberNotes] = useState([])
  const [attendance,  setAttendance]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [setupLoading, setSetupLoading] = useState(false)

  // ── Initial data load ────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Open the local database (creates it on first launch)
      await sheets.setupDatabase()

      const [m, p, a, bh, mn, c] = await Promise.all([
        sheets.getMembers(),
        sheets.getPayments(),
        sheets.getAttendance(),
        sheets.getBeltHistory(),
        sheets.getMemberNotes(),
        sheets.getComments(),
      ])

      // Normalize Rust camelCase field names to match what the UI expects
      // Members from Rust have snake_case-converted fields; map them here
      const normalizeMembers = (arr) => arr.map(m => ({
        ...m,
        // Rust returns camelCase via serde rename, parse JSON fields
        categories:   safeParseJSON(m.categories,   []),
        belts:        safeParseJSON(m.belts,         {}),
        serviceDates: safeParseJSON(m.serviceDates ?? m.service_dates, {}),
        joinDate:     m.joinDate ?? m.join_date,
        customFee:    (() => { const v = m.customFee ?? m.custom_fee; return (v != null && v !== '') ? Number(v) : null })(),
        createdAt:    m.createdAt ?? m.created_at,
        updatedAt:    m.updatedAt ?? m.updated_at,
      }))

      const normalizePayments = (arr) => arr.map(p => ({
        ...p,
        memberId:  p.memberId  ?? p.member_id,
        paidAt:    p.paidAt    ?? p.paid_at    ?? null,
        createdAt: p.createdAt ?? p.created_at,
        amount:    Number(p.amount) || 0,
      }))

      const normalizeAttendance = (arr) => arr.map(a => ({
        ...a,
        memberId:    a.memberId    ?? a.member_id,
        sessionType: a.sessionType ?? a.session_type,
        classId:     a.classId     ?? a.class_id     ?? null,
        createdAt:   a.createdAt   ?? a.created_at,
      }))

      const normalizeBelt = (arr) => arr.map(b => ({
        ...b,
        memberId:   b.memberId   ?? b.member_id,
        fromBelt:   b.fromBelt   ?? b.from_belt   ?? null,
        toBelt:     b.toBelt     ?? b.to_belt,
        promotedAt: b.promotedAt ?? b.promoted_at,
        createdAt:  b.createdAt  ?? b.created_at,
      }))

      const normalizeNotes = (arr) => arr.map(n => ({
        ...n,
        memberId:  n.memberId  ?? n.member_id,
        createdAt: n.createdAt ?? n.created_at,
      }))

      const normalizeComments = (arr) => arr.map(c => ({
        ...c,
        memberId:  c.memberId  ?? c.member_id,
        updatedAt: c.updatedAt ?? c.updated_at,
      }))

      const nm  = normalizeMembers(m)
      const np  = normalizePayments(p)
      const na  = normalizeAttendance(a)
      const nbh = normalizeBelt(bh)
      const nnn = normalizeNotes(mn)
      const nc  = normalizeComments(c)

      setMembers(nm)
      setPayments(np)
      setAttendance(na)
      setBeltHistory(nbh)
      setMemberNotes(nnn)
      setComments(nc)

      // Daily rolling auto-backup to localStorage (silent, fail-safe)
      saveAutoBackup({ members: nm, payments: np, attendance: na, beltHistory: nbh, memberNotes: nnn, comments: nc })
    } catch (err) {
      console.error('[DataContext] Failed to load data:', err)
      const msg = typeof err === 'string' ? err : err.message ?? 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const retrySetup = useCallback(async () => {
    setSetupLoading(true)
    setError(null)
    try {
      await sheets.setupDatabase()
      await loadData()
    } catch (err) {
      const msg = typeof err === 'string' ? err : err.message ?? 'Unknown error'
      setError(msg)
    } finally {
      setSetupLoading(false)
    }
  }, [loadData])

  useEffect(() => { loadData() }, [loadData])

  // ── Member CRUD ────────────────────────────────────────────────────────────
  const addMember = useCallback(async (data) => {
    try {
      // Serialize array/object fields to JSON strings for Sheets storage
      const input = serializeMemberInput(data)
      const id = await sheets.addMember(input)
      const now = new Date().toISOString()
      setMembers(prev => [{ ...data, id, createdAt: now, updatedAt: now }, ...prev])
      return id
    } catch (err) {
      console.error('[DataContext] addMember failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      throw err
    }
  }, [])

  const updateMember = useCallback(async (id, data) => {
    try {
      const input = serializeMemberInput(data)
      await sheets.updateMember(id, input)
      const now = new Date().toISOString()
      setMembers(prev => prev.map(m => m.id === id ? { ...m, ...data, updatedAt: now } : m))
    } catch (err) {
      console.error('[DataContext] updateMember failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      throw err
    }
  }, [])

  const deleteMember = useCallback(async (id) => {
    try {
      await sheets.deleteMemberCascade(id)
      setMembers(    prev => prev.filter(m => m.id !== id))
      setPayments(   prev => prev.filter(p => p.memberId !== id))
      setAttendance( prev => prev.filter(a => a.memberId !== id))
      setBeltHistory(prev => prev.filter(b => b.memberId !== id))
      setMemberNotes(prev => prev.filter(n => n.memberId !== id))
      setComments(   prev => prev.filter(c => c.memberId !== id))
    } catch (err) {
      console.error('[DataContext] deleteMember failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      throw err
    }
  }, [])

  // ── Payment CRUD ───────────────────────────────────────────────────────────
  const addPayment = useCallback(async (data) => {
    try {
      const input = {
        memberId: data.memberId,
        month:    data.month,
        amount:   String(data.amount ?? 0),
        status:   data.status ?? 'unpaid',
        paidAt:   data.paidAt ?? null,
        note:     data.note ?? null,
      }
      const id = await sheets.addPayment(input)
      if (!id) return null // duplicate event payment
      setPayments(prev => [{ ...data, id, createdAt: new Date().toISOString() }, ...prev])
      return id
    } catch (err) {
      console.error('[DataContext] addPayment failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      throw err
    }
  }, [])

  const markPaymentPaid = useCallback(async (paymentId) => {
    try {
      await sheets.markPaymentPaid(paymentId)
      const now = new Date().toISOString()
      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'paid', paidAt: now } : p))
    } catch (err) {
      console.error('[DataContext] markPaymentPaid failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      throw err
    }
  }, [])

  const markPaymentUnpaid = useCallback(async (paymentId) => {
    try {
      await sheets.markPaymentUnpaid(paymentId)
      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'unpaid', paidAt: null } : p))
    } catch (err) {
      console.error('[DataContext] markPaymentUnpaid failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      throw err
    }
  }, [])

  // ── Comment CRUD ───────────────────────────────────────────────────────────
  const upsertComment = useCallback(async (memberId, month, text) => {
    try {
      const now = new Date().toISOString()
      // Optimistic update
      setComments(prev => {
        const existing = prev.find(c => c.memberId === memberId && c.month === month)
        if (existing) {
          if (!text.trim()) return prev.filter(c => !(c.memberId === memberId && c.month === month))
          return prev.map(c => c.id === existing.id ? { ...c, text, updatedAt: now } : c)
        }
        if (!text.trim()) return prev
        return [...prev, { id: `c_opt_${Date.now()}`, memberId, month, text, updatedAt: now }]
      })
      await sheets.upsertComment(memberId, month, text)
    } catch (err) {
      console.error('[DataContext] upsertComment failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      sheets.getComments().then(c => setComments(c)).catch(() => {})
      throw err
    }
  }, [])

  const getComment = useCallback(
    (memberId, month) => comments.find(c => c.memberId === memberId && c.month === month) ?? null,
    [comments]
  )

  // ── Belt CRUD ──────────────────────────────────────────────────────────────
  const addBeltPromotion = useCallback(async (memberId, { category, fromBelt, toBelt, promotedAt, notes }) => {
    try {
      const id = await sheets.addBeltPromotion(memberId, { category, fromBelt: fromBelt ?? null, toBelt, promotedAt, notes: notes ?? null })
      const entry = { id, memberId, category, fromBelt: fromBelt ?? null, toBelt, promotedAt, notes: notes ?? '' }
      setBeltHistory(prev => [entry, ...prev])
      const now = new Date().toISOString()
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, belts: { ...(m.belts ?? {}), [category]: toBelt }, updatedAt: now } : m
      ))
      return id
    } catch (err) {
      console.error('[DataContext] addBeltPromotion failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      throw err
    }
  }, [])

  // ── Member Notes CRUD ──────────────────────────────────────────────────────
  const addMemberNote = useCallback(async (memberId, text) => {
    try {
      const id = await sheets.addMemberNote(memberId, text)
      setMemberNotes(prev => [{ id, memberId, text, createdAt: new Date().toISOString() }, ...prev])
      return id
    } catch (err) {
      console.error('[DataContext] addMemberNote failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      throw err
    }
  }, [])

  const deleteMemberNote = useCallback(async (noteId) => {
    try {
      await sheets.deleteMemberNote(noteId)
      setMemberNotes(prev => prev.filter(n => n.id !== noteId))
    } catch (err) {
      console.error('[DataContext] deleteMemberNote failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      throw err
    }
  }, [])

  // ── Attendance CRUD ────────────────────────────────────────────────────────
  const logAttendance = useCallback(async (memberId, date, sessionType, note = '', classId = null) => {
    try {
      const id = await sheets.logAttendance({ memberId, date, sessionType, note: note || null, classId })
      setAttendance(prev => [{ id, memberId, date, sessionType, note, classId }, ...prev])
      return id
    } catch (err) {
      console.error('[DataContext] logAttendance failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      throw err
    }
  }, [])

  const removeAttendance = useCallback(async (id) => {
    try {
      await sheets.removeAttendance(id)
      setAttendance(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error('[DataContext] removeAttendance failed:', err)
      setError(typeof err === 'string' ? err : err.message)
      throw err
    }
  }, [])

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    members, payments, comments, beltHistory, memberNotes, attendance, loading, error,
    setupLoading, retrySetup,
    addMember, updateMember, deleteMember,
    addPayment, markPaymentPaid, markPaymentUnpaid,
    upsertComment, getComment,
    addBeltPromotion,
    addMemberNote, deleteMemberNote,
    logAttendance, removeAttendance,
    reload: loadData,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJSON(str, fallback) {
  if (!str) return fallback
  if (typeof str !== 'string') return str // already parsed
  try { return JSON.parse(str) } catch { return fallback }
}

function serializeMemberInput(data) {
  // Normalize any Date object or ISO datetime string to plain YYYY-MM-DD
  function toDateStr(val) {
    if (!val) return ''
    if (val instanceof Date) return val.toISOString().slice(0, 10)
    if (typeof val === 'string') return val.slice(0, 10) // drop any time component
    return String(val).slice(0, 10)
  }

  // serviceDates values may be Date objects (from MemberModal new Date(…))
  const rawDates = data.serviceDates ?? {}
  const normalizedDates = typeof rawDates === 'string'
    ? rawDates
    : JSON.stringify(
        Object.fromEntries(Object.entries(rawDates).map(([k, v]) => [k, toDateStr(v)]))
      )

  return {
    name:         data.name,
    phone:        data.phone     ?? null,
    email:        data.email     ?? null,
    categories:   typeof data.categories === 'string' ? data.categories : JSON.stringify(data.categories ?? []),
    belts:        typeof data.belts       === 'string' ? data.belts       : JSON.stringify(data.belts       ?? {}),
    serviceDates: normalizedDates,
    joinDate:     toDateStr(data.joinDate ?? data.join_date),
    status:       data.status    ?? 'active',
    customFee:    data.customFee != null ? String(data.customFee) : null,
    notes:        data.notes     ?? null,
  }
}
