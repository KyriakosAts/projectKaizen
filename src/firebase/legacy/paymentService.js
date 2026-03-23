import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'

const COL = 'payments'

export async function getPayments() {
  const snap = await getDocs(collection(db, COL))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function markPaid(id) {
  await updateDoc(doc(db, COL, id), {
    status: 'paid',
    paidAt: serverTimestamp(),
  })
}

export async function markUnpaid(id) {
  await updateDoc(doc(db, COL, id), {
    status: 'unpaid',
    paidAt: null,
  })
}

export async function updatePaymentStatus(id, status) {
  await updateDoc(doc(db, COL, id), {
    status,
    paidAt: status === 'paid' ? serverTimestamp() : null,
  })
}

/**
 * For each active member, ensures a payment record exists for the given month.
 * Creates one with status 'unpaid' if missing.
 * Call this when opening the Payments page for the current month.
 */
export async function ensurePaymentsExist(members, monthStr, defaultAmount = 50) {
  const activeMembers = members.filter(m => m.status === 'active')

  // Fetch all existing payment records for this month
  const q = query(collection(db, COL), where('month', '==', monthStr))
  const snap = await getDocs(q)
  const existingMemberIds = new Set(snap.docs.map(d => d.data().memberId))

  const creates = activeMembers
    .filter(m => !existingMemberIds.has(m.id))
    .map(m =>
      addDoc(collection(db, COL), {
        memberId:  m.id,
        month:     monthStr,
        amount:    defaultAmount,
        status:    'unpaid',
        paidAt:    null,
        createdAt: serverTimestamp(),
      })
    )

  await Promise.all(creates)
}

/**
 * Batch-delete all payment records for a member.
 * Handles collections larger than 500 by processing in chunks.
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function deletePaymentsForMember(memberId) {
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
