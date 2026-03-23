import {
  collection,
  doc,
  getDocs,
  addDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './config'

const COL = 'beltHistory'

/**
 * Fetch all belt promotion history records.
 * @returns {Promise<Array>}
 */
export async function getBeltHistory() {
  const snap = await getDocs(collection(db, COL))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Add a belt promotion record for a member.
 * @param {string} memberId
 * @param {{ category: string, fromBelt?: string|null, toBelt: string, promotedAt: Date|string|Timestamp, notes?: string }} data
 * @returns {Promise<string>} The new document ID.
 */
export async function addBeltPromotion(memberId, data) {
  let promotedAt

  if (data.promotedAt instanceof Timestamp) {
    promotedAt = data.promotedAt
  } else if (data.promotedAt instanceof Date) {
    promotedAt = Timestamp.fromDate(data.promotedAt)
  } else if (typeof data.promotedAt === 'string') {
    promotedAt = Timestamp.fromDate(new Date(data.promotedAt))
  } else {
    promotedAt = Timestamp.now()
  }

  const ref = await addDoc(collection(db, COL), {
    memberId,
    category:   data.category,
    fromBelt:   data.fromBelt ?? null,
    toBelt:     data.toBelt,
    promotedAt,
    notes:      data.notes ?? '',
    createdAt:  serverTimestamp(),
  })
  return ref.id
}

/**
 * Batch-delete all belt history records for a member.
 * Handles collections larger than 500 by processing in chunks.
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function deleteBeltHistoryForMember(memberId) {
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
