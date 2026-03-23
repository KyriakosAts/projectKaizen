import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

const COL = 'attendance'

/**
 * Fetch all attendance records, sorted by date descending.
 * @returns {Promise<Array>}
 */
export async function getAttendance() {
  const q = query(collection(db, COL), orderBy('date', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Log a new attendance record.
 * @param {{ memberId: string, date: string, sessionType: string, note?: string|null, classId?: string|null }} data
 * @returns {Promise<string>} The new document ID.
 */
export async function logAttendance(data) {
  const ref = await addDoc(collection(db, COL), {
    memberId:    data.memberId,
    date:        data.date,
    sessionType: data.sessionType,
    note:        data.note    ?? null,
    classId:     data.classId ?? null,
    createdAt:   serverTimestamp(),
  })
  return ref.id
}

/**
 * Remove a single attendance record by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function removeAttendance(id) {
  await deleteDoc(doc(db, COL, id))
}

/**
 * Fetch all attendance records for a specific member, sorted by date descending.
 * @param {string} memberId
 * @returns {Promise<Array>}
 */
export async function getAttendanceForMember(memberId) {
  const q = query(
    collection(db, COL),
    where('memberId', '==', memberId),
    orderBy('date', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Batch-delete all attendance records for a member.
 * Handles collections larger than 500 by processing in chunks.
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function deleteAttendanceForMember(memberId) {
  const q = query(collection(db, COL), where('memberId', '==', memberId))
  const snap = await getDocs(q)

  if (snap.empty) return

  const BATCH_LIMIT = 500
  const docs = snap.docs

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT)
    const batch = writeBatch(db)
    chunk.forEach(d => batch.delete(d.ref))
    await batch.commit()
  }
}
