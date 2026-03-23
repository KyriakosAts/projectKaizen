import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

const COL = 'config'

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

/**
 * Retrieve the services configuration document.
 * @returns {Promise<{ services: Array }|null>}
 */
export async function getServicesConfig() {
  const snap = await getDoc(doc(db, COL, 'services'))
  if (!snap.exists()) return null
  return snap.data()
}

/**
 * Persist the services configuration.
 * @param {Array} services
 * @returns {Promise<void>}
 */
export async function saveServicesConfig(services) {
  await setDoc(doc(db, COL, 'services'), {
    services,
    updatedAt: serverTimestamp(),
  })
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/**
 * Retrieve the schedule configuration document.
 * @returns {Promise<{ classes: Array, events: Array }|null>}
 */
export async function getScheduleConfig() {
  const snap = await getDoc(doc(db, COL, 'schedule'))
  if (!snap.exists()) return null
  return snap.data()
}

/**
 * Persist the schedule configuration.
 * @param {Array} classes
 * @param {Array} events
 * @returns {Promise<void>}
 */
export async function saveScheduleConfig(classes, events) {
  await setDoc(doc(db, COL, 'schedule'), {
    classes,
    events,
    updatedAt: serverTimestamp(),
  })
}

// ---------------------------------------------------------------------------
// Instructors
// ---------------------------------------------------------------------------

/**
 * Retrieve the instructors configuration document.
 * @returns {Promise<{ instructors: Array }|null>}
 */
export async function getInstructorsConfig() {
  const snap = await getDoc(doc(db, COL, 'instructors'))
  if (!snap.exists()) return null
  return snap.data()
}

/**
 * Persist the instructors configuration.
 * @param {Array} instructors
 * @returns {Promise<void>}
 */
export async function saveInstructorsConfig(instructors) {
  await setDoc(doc(db, COL, 'instructors'), {
    instructors,
    updatedAt: serverTimestamp(),
  })
}
