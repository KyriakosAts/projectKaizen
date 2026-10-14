import { test } from 'node:test'
import assert from 'node:assert/strict'

import { phoneDigits, reminderText, reminderLinks } from '../src/data/reminder.js'

test('phone numbers become international digits', () => {
  assert.equal(phoneDigits('697 123 4567'), '306971234567')
  assert.equal(phoneDigits('+30 697-123-4567'), '306971234567')
  assert.equal(phoneDigits('0030 6971234567'), '306971234567')
  assert.equal(phoneDigits('2610 123456'), '302610123456')
  assert.equal(phoneDigits('12345'), null)
  assert.equal(phoneDigits(''), null)
})

test('reminder text and links', () => {
  const text = reminderText('Γεια {όνομα}, το {τμήμα} {λήξη}. {γυμναστήριο}', {
    member: { name: 'Παπαδόπουλος Γιώργος' }, group: { name: 'BJJ' }, until: '2026-10-07', state: 'expired', gymName: 'Dojo Patras',
  })
  assert.equal(text, 'Γεια Γιώργος, το BJJ έληξε στις 07/10/2026. Dojo Patras')
  const soon = reminderText('{λήξη}', { member: { name: 'Α' }, until: '2026-10-17', state: 'soon' })
  assert.equal(soon, 'λήγει στις 17/10/2026')
  const links = reminderLinks('6971234567', 'Γεια σου!')
  assert.equal(links.whatsapp, 'https://wa.me/306971234567?text=%CE%93%CE%B5%CE%B9%CE%B1%20%CF%83%CE%BF%CF%85!')
  assert.equal(links.sms.startsWith('sms:+306971234567?body='), true)
  assert.equal(links.viber, 'viber://chat?number=%2B306971234567')
  assert.equal(reminderLinks('', 'x'), null)
})
