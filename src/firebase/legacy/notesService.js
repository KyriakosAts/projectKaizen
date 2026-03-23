import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

const COL = 'memberNotes'

/**
 * Fetch all member notes.
 * @returns {Promise<Array>}
 */
export async function getMemberNotes() {
  const snap = await getDocs(collection(db, COL))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Add a note for a member.
 * @param {string} memberId
 * @param {string} text
 * @returns {Promise<string>} The new document ID.
 */
export async function addMemberNote(memberId, text) {
  const ref = await addDoc(collection(db, COL), {
    memberId,
    text,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Delete a single note by document ID.
 * @param {string} noteId
 * @returns {Promise<void>}
 */
export async function deleteMemberNote(noteId) {
  await deleteDoc(doc(db, COL, noteId))
}

/**
 * Batch-delete all notes for a member.
 * Handles collections larger than 500 by processing in chunks.
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function deleteMemberNotesForMember(memberId) {
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
