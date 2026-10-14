import { test } from 'node:test'
import assert from 'node:assert/strict'

import { migrateLegacy } from '../src/data/migrate.js'

// Rows exactly as the v2 SQLite tables return them (snake_case, JSON-as-text)
const LEGACY = {
  members: [
    {
      id: 'm1', name: 'Γιάννης', phone: '697', email: null,
      categories: '["bjj"]', belts: '{"bjj":"blue"}', service_dates: '{"bjj":"2025-03-10"}',
      join_date: '2025-03-10', status: 'active', custom_fee: '40', notes: 'Αδερφός του Νίκου',
      created_at: '2025-03-10T09:00:00Z', updated_at: '2025-03-10T09:00:00Z',
    },
    {
      id: 'm2', name: 'Μαρία', phone: null, email: null,
      categories: '["judo","bjj"]', belts: '{}', service_dates: '{}',
      join_date: '2026-01-05', status: 'active', custom_fee: '80', notes: null,
      created_at: '2026-01-05T09:00:00Z', updated_at: '2026-01-05T09:00:00Z',
    },
    {
      id: 'm3', name: 'Κώστας', phone: null, email: null,
      categories: '["yoga"]', belts: '{}', service_dates: '{}',
      join_date: '', status: 'inactive', custom_fee: null, notes: null,
      created_at: '2026-02-01T09:00:00Z', updated_at: '2026-02-01T09:00:00Z',
    },
  ],
  payments: [
    { id: 'p1', member_id: 'm1', month: '2026-09', amount: '40', status: 'paid', paid_at: '2026-09-08T17:00:00Z', note: null, created_at: '2026-09-08T17:00:00Z' },
    { id: 'p2', member_id: 'm1', month: '2026-10', amount: '40', status: 'unpaid', paid_at: null, note: null, created_at: '2026-10-01T00:00:00Z' },
    { id: 'p3', member_id: 'm2', month: '2026-09', amount: '81', status: 'paid', paid_at: null, note: null, created_at: '2026-09-01T00:00:00Z' },
    { id: 'p4', member_id: 'm1', month: '2026-06', amount: '20', status: 'paid', paid_at: '2026-06-12T10:00:00Z', note: 'Σεμινάριο Χ (event)', created_at: '2026-06-12T10:00:00Z' },
    { id: 'p5', member_id: 'gone', month: '2026-09', amount: '50', status: 'paid', paid_at: null, note: null, created_at: '2026-09-01T00:00:00Z' },
  ],
  attendance: [{ id: 'a1', member_id: 'm1', date: '2026-09-09', session_type: 'bjj' }],
  belt_history: [
    { id: 'b1', member_id: 'm1', category: 'bjj', from_belt: 'white', to_belt: 'blue', promoted_at: '2026-03-01', notes: 'Καλή δουλειά', created_at: '2026-03-01T10:00:00Z' },
  ],
  member_notes: [{ id: 'n1', member_id: 'm1', text: 'Τραυματισμός γόνατο', created_at: '2026-05-01T10:00:00Z' }],
  comments: [{ id: 'c1', member_id: 'm1', month: '2026-04', text: 'Θα λείψει', updated_at: '2026-04-02T10:00:00Z' }],
  settings: {
    services_config: JSON.stringify({ services: [
      { id: 'judo', name: 'Judo', color: '#3b82f6', monthlyFee: 45, usesBelts: true },
      { id: 'bjj', name: 'BJJ', color: '#f97316', monthlyFee: 50, usesBelts: true },
      { id: 'fitness', name: 'Fitness', color: '#10b981', monthlyFee: 35, usesBelts: false },
    ] }),
  },
}

test('groups come from the old services, missing categories are added', () => {
  const { groups } = migrateLegacy(LEGACY)
  assert.deepEqual(groups.map(g => g.id), ['judo', 'bjj', 'fitness', 'yoga'])
  const judo = groups[0]
  assert.equal(judo.plans.find(p => p.id === 'month').price, 45)
  assert.equal(judo.plans.find(p => p.id === 'half').price, 22.5)
  assert.ok(judo.belts.length > 0)
  assert.equal(groups[2].belts.length, 0)
})

test('members: enrollments, single-service price, merged notes', () => {
  const { members } = migrateLegacy(LEGACY)
  const m1 = members.find(m => m.id === 'm1')
  assert.deepEqual(m1.enrollments, [{ groupId: 'bjj', since: '2025-03-10', price: 40 }])
  assert.equal(m1.notes, 'Αδερφός του Νίκου\n2026-04: Θα λείψει\nΤραυματισμός γόνατο')
  const m2 = members.find(m => m.id === 'm2')
  assert.deepEqual(m2.enrollments.map(e => e.price), [null, null])
  assert.match(m2.notes, /80 €/)
  assert.equal(members.find(m => m.id === 'm3').enrollments[0].since, '2026-02-01')
})

test('payments: only paid move, month coverage, shared payments split exactly', () => {
  const { payments } = migrateLegacy(LEGACY)
  assert.equal(payments.some(p => p.id === 'p2'), false)      // unpaid row was never money
  assert.equal(payments.some(p => p.memberId === 'gone'), false)
  const p1 = payments.find(p => p.id === 'p1')
  assert.deepEqual(
    { date: p1.date, from: p1.from, to: p1.to, amount: p1.amount, groupId: p1.groupId },
    { date: '2026-09-08', from: '2026-09-01', to: '2026-09-30', amount: 40, groupId: 'bjj' },
  )
  const split = payments.filter(p => p.id.startsWith('p3'))
  assert.equal(split.length, 2)
  assert.equal(split.reduce((s, p) => s + p.amount, 0), 81)
  assert.deepEqual(split.map(p => p.groupId), ['judo', 'bjj'])
  assert.equal(split[0].date, '2026-09-01')
  const ev = payments.find(p => p.id === 'p4')
  assert.equal(ev.from, null)
  assert.equal(ev.label, 'Σεμινάριο Χ')
})

test('belts: history kept, current belts without history become a promotion', () => {
  const legacy = structuredClone(LEGACY)
  legacy.members[1].belts = '{"judo":"green"}'
  const { promotions } = migrateLegacy(legacy)
  const b1 = promotions.find(p => p.id === 'b1')
  assert.equal(b1.beltName, 'Μπλε')
  assert.equal(b1.note, 'Καλή δουλειά')
  assert.equal(promotions.filter(p => p.memberId === 'm1').length, 1) // no duplicate from members.belts
  const m2 = promotions.find(p => p.memberId === 'm2')
  assert.deepEqual([m2.groupId, m2.beltId, m2.date], ['judo', 'green', '2026-01-05'])
})

test('no services config: falls back to the default groups', () => {
  const { groups } = migrateLegacy({ ...LEGACY, settings: {} })
  assert.ok(groups.some(g => g.id === 'judokids'))
  assert.ok(groups.some(g => g.id === 'yoga'))
})
