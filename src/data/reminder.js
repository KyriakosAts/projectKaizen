/**
 * Payment reminders through apps already on the device. Nothing is sent by
 * the app itself: it opens WhatsApp / SMS / Viber with the text ready and
 * Theofilos presses send. No server, no account, no cost.
 */

import { fmtDate } from './dates.js'

export const DEFAULT_REMINDER =
  'Γεια σου {όνομα}! Η συνδρομή σου στο {τμήμα} {λήξη}. Σε περιμένουμε στην προπόνηση! — {γυμναστήριο}'

/** International digits for a Greek-style number ("697 123 4567" → "306971234567"). */
export function phoneDigits(phone) {
  let d = String(phone ?? '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10 && (d.startsWith('69') || d.startsWith('2'))) d = `30${d}`
  return d.length >= 10 ? d : null
}

export function reminderText(template, { member, group, until, state, gymName }) {
  const first = String(member.name).trim().split(/\s+/).slice(-1)[0] // "Παπαδόπουλος Γιώργος" → "Γιώργος"
  const when = !until ? 'δεν έχει ξεκινήσει ακόμα'
    : state === 'soon' ? `λήγει στις ${fmtDate(until)}`
    : `έληξε στις ${fmtDate(until)}`
  // split/join, not replaceAll: the tablet's WebView may be Chrome 84
  const fill = { '{όνομα}': first, '{ονοματεπώνυμο}': member.name, '{τμήμα}': group?.name ?? '', '{λήξη}': when, '{γυμναστήριο}': gymName ?? '' }
  return Object.entries(fill).reduce((text, [k, v]) => text.split(k).join(v), String(template || DEFAULT_REMINDER))
}

/** Links that open each app with the message (Viber can't prefill text to a
 *  number — its link opens the chat; the text is copied for pasting). */
export function reminderLinks(phone, text) {
  const d = phoneDigits(phone)
  if (!d) return null
  const msg = encodeURIComponent(text)
  return {
    whatsapp: `https://wa.me/${d}?text=${msg}`,
    sms: `sms:+${d}?body=${msg}`,
    viber: `viber://chat?number=%2B${d}`,
  }
}
