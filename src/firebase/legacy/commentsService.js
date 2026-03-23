import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

const COL = 'comments'

/**
 * Fetch all comment records.
 * @returns {Promise<Array>}
 */
export async function getComments() {
  const snap = await getDocs(collection(db, COL))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Create or update a comment for a member/month pair.
 * If `text` is an empty string, the existing document is deleted instead.
 * @param {string} memberId
 * @param {string} month  Format: 'YYYY-MM'
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function upsertComment(memberId, month, text) {
  const q = query(
    collection(db, COL),
    where('memberId', '==', memberId),
    where('month', '==', month),
  )
  const snap = await getDocs(q)

  if (!snap.empty) {
    const existing = snap.docs[0]

    if (text === '') {
      await deleteDoc(existing.ref)
    } else {
      await updateDoc(existing.ref, {
        text,
        updatedAt: serverTimestamp(),
      })
    }
  } else {
    // Only create a new doc if there is actual text to store.
    if (text === '') return

    await addDoc(collection(db, COL), {
      memberId,
      month,
      text,
      updatedAt: serverTimestamp(),
    })
  }
}

/**
 * Batch-delete all comments for a member.
 * Handles collections larger than 500 by processing in chunks.
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function deleteCommentsForMember(memberId) {
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
