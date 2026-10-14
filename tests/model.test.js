import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  coverageEnd, suggestPeriod, periodStart, enrollmentStatus, memberStatus, attentionList,
  paymentGrid, revenueByMonth, joinsAndLeaves, currentBelt, nextBelt, money,
  matchesSearch, planPrice, seminarTotals, beltDistribution, kpis,
  filterMembers, EMPTY_FILTER, isFilterActive, describeFilter,
} from '../src/data/model.js'
import { addMonths, monthRange, daysBetween, fmtRelative } from '../src/data/dates.js'
import { DEFAULT_GROUPS } from '../src/data/defaults.js'

const SETTINGS = { warnDays: 5, pauseDays: 30 }
const MONTH = { id: 'month', unit: 'month', count: 1, price: 50 }
const HALF = { id: 'half', unit: 'day', count: 15, price: 25 }
const WEEK = { id: 'week', unit: 'week', count: 1, price: null }
const DAY = { id: 'day', unit: 'day', count: 1, price: null }

const member = (id, groups = ['bjj'], since = '2026-09-01') => ({
  id, name: id, enrollments: groups.map(g => ({ groupId: g, since, price: null })), createdAt: `${since}T10:00:00Z`,
})
const pay = (memberId, date, from, to, extra = {}) => ({
  id: `${memberId}-${date}`, memberId, groupId: 'bjj', date, amount: 50, from, to, ...extra,
})

test('dates: month arithmetic clamps to the end of the month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29')
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15')
  assert.deepEqual(monthRange('2026-02', 3), ['2025-12', '2026-01', '2026-02'])
  assert.equal(daysBetween('2026-10-14', '2026-10-20'), 6)
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2) // across DST change
  assert.equal(fmtRelative(-3), 'πριν 3 μέρες')
})

test('coverage: each plan covers the expected days', () => {
  assert.equal(coverageEnd('2026-10-20', MONTH), '2026-11-19')
  assert.equal(coverageEnd('2026-01-31', MONTH), '2026-02-27')
  assert.equal(coverageEnd('2026-10-01', HALF), '2026-10-15')
  assert.equal(coverageEnd('2026-10-01', WEEK), '2026-10-07')
  assert.equal(coverageEnd('2026-10-01', DAY), '2026-10-01')
})

test('periodStart: continues by default, falls back to the payment date after a long gap', () => {
  const payments = [pay('a', '2026-09-08', '2026-09-08', '2026-10-07')]
  // early renewal keeps the usual date
  assert.deepEqual(suggestPeriod(payments, 'a', 'bjj', MONTH, '2026-10-05'), { from: '2026-10-08', to: '2026-11-07' })
  // two weeks late: still continues by default — Theofilos changes it if the member didn't come
  assert.deepEqual(periodStart(payments, 'a', 'bjj', MONTH, '2026-10-21'), { continueFrom: '2026-10-08', defaultFrom: '2026-10-08' })
  // back after months: continuing would already be over → starts on the payment date
  assert.deepEqual(periodStart(payments, 'a', 'bjj', MONTH, '2026-12-03'), { continueFrom: '2026-10-08', defaultFrom: '2026-12-03' })
  assert.deepEqual(suggestPeriod(payments, 'a', 'bjj', MONTH, '2026-12-03'), { from: '2026-12-03', to: '2027-01-02' })
  // never paid in this group
  assert.deepEqual(periodStart(payments, 'a', 'judo', MONTH, '2026-10-05'), { continueFrom: null, defaultFrom: '2026-10-05' })
  // a short plan after a gap: a 1-day pass two weeks late starts today
  assert.equal(periodStart(payments, 'a', 'bjj', DAY, '2026-10-21').defaultFrom, '2026-10-21')
})

test('status: ok → soon → expired → paused, never a debt', () => {
  const m = member('a')
  const e = m.enrollments[0]
  const payments = [pay('a', '2026-09-08', '2026-09-08', '2026-10-07')]
  const at = (d) => enrollmentStatus(payments, m, e, SETTINGS, d)
  assert.equal(at('2026-09-20').state, 'ok')
  assert.equal(at('2026-10-02').state, 'soon')
  assert.equal(at('2026-10-02').days, 5)
  assert.equal(at('2026-10-07').state, 'soon')
  assert.equal(at('2026-10-08').state, 'expired')
  assert.equal(at('2026-10-08').days, 1)
  assert.equal(at('2026-11-06').state, 'expired')   // 30 days over
  assert.equal(at('2026-11-07').state, 'paused')    // 31 days over
  // comes back after a skipped month: green again from the new payment
  const back = [...payments, pay('a', '2026-12-03', '2026-12-03', '2027-01-02')]
  assert.equal(enrollmentStatus(back, m, e, SETTINGS, '2026-12-03').state, 'ok')
})

test('status: settings change the thresholds without code changes', () => {
  const m = member('a')
  const payments = [pay('a', '2026-09-08', '2026-09-08', '2026-10-07')]
  const strict = { warnDays: 10, pauseDays: 7 }
  assert.equal(enrollmentStatus(payments, m, m.enrollments[0], strict, '2026-09-28').state, 'soon')
  assert.equal(enrollmentStatus(payments, m, m.enrollments[0], strict, '2026-10-15').state, 'paused')
})

test('status: a new member who never paid is "unpaid", then paused', () => {
  const m = member('a', ['bjj'], '2026-10-01')
  assert.equal(enrollmentStatus([], m, m.enrollments[0], SETTINGS, '2026-10-14').state, 'unpaid')
  assert.equal(enrollmentStatus([], m, m.enrollments[0], SETTINGS, '2026-11-05').state, 'paused')
})

test('memberStatus: overall is the most urgent, paused only if all are paused', () => {
  const m = member('a', ['bjj', 'judo'])
  const payments = [
    pay('a', '2026-10-01', '2026-10-01', '2026-10-31'),
    { ...pay('a', '2026-07-01', '2026-07-01', '2026-07-31'), groupId: 'judo', id: 'j' },
  ]
  const s = memberStatus(payments, m, SETTINGS, '2026-10-14')
  assert.equal(s.overall, 'ok')
  assert.deepEqual(s.items.map(i => i.state), ['ok', 'paused'])
  assert.equal(memberStatus([], { ...m, enrollments: [] }, SETTINGS).overall, 'paused')
})

test('attentionList: one row per enrollment, most recent expiry first', () => {
  const members = [member('a'), member('b'), member('c'), member('d', ['bjj'], '2026-10-10')]
  const payments = [
    pay('a', '2026-09-01', '2026-09-01', '2026-09-30'), // expired 14 days
    pay('b', '2026-09-10', '2026-09-10', '2026-10-09'), // expired 5 days
    pay('c', '2026-09-16', '2026-09-16', '2026-10-15'), // soon
  ]
  const l = attentionList(members, payments, SETTINGS, '2026-10-14')
  assert.deepEqual(l.expired.map(r => r.member.id), ['b', 'a'])
  assert.deepEqual(l.soon.map(r => r.member.id), ['c'])
  assert.deepEqual(l.unpaid.map(r => r.member.id), ['d'])
})

test('paymentGrid: shows payments in their month and marks covered months', () => {
  const members = [member('b'), member('a'), member('x', ['judo'])]
  const payments = [
    pay('a', '2026-09-20', '2026-09-20', '2026-10-19'),
    pay('a', '2026-12-03', '2026-12-03', '2027-01-02'),
  ]
  const rows = paymentGrid(members, payments, 'bjj', ['2026-09', '2026-10', '2026-11', '2026-12'])
  assert.deepEqual(rows.map(r => r.member.id), ['a', 'b'])
  const [sep, oct, nov, dec] = rows[0].cells
  assert.equal(sep.payments.length, 1)
  assert.equal(sep.total, 50)
  assert.equal(oct.payments.length, 0)
  assert.equal(oct.covered, true)       // paid on 20/09, covered until 19/10
  assert.equal(nov.covered, false)      // skipped month: empty, not red
  assert.equal(dec.payments.length, 1)
  assert.equal(rows[1].inWindow, false)
})

test('revenue: by payment date, per group, seminars counted when paid', () => {
  const payments = [
    pay('a', '2026-10-01', null, null, { amount: 50 }),
    { ...pay('b', '2026-10-05', null, null), groupId: 'judo', amount: 40 },
    pay('c', '2026-11-01', null, null, { amount: 25.5 }),
  ]
  const seminars = [{ id: 's', title: 'x', date: '2026-10-10', price: 20, participants: [
    { memberId: 'a', amount: 20, paidOn: '2026-10-10' },
    { memberId: 'b', amount: 20, paidOn: null },
  ] }]
  const r = revenueByMonth(payments, seminars, ['2026-10', '2026-11'])
  assert.equal(r[0].total, 110)
  assert.deepEqual(r[0].groups, { bjj: 50, judo: 40 })
  assert.equal(r[0].seminars, 20)
  assert.equal(r[1].total, 25.5)
  assert.deepEqual(seminarTotals(seminars[0]), { count: 2, paidCount: 1, collected: 20, outstanding: 20 })
})

test('joinsAndLeaves: leaving counts only after the pause threshold', () => {
  const members = [member('a'), member('b')]
  const payments = [
    pay('a', '2026-07-01', '2026-07-01', '2026-07-31'),
    pay('b', '2026-09-01', '2026-09-01', '2026-09-30'),
  ]
  const r = joinsAndLeaves(members, payments, SETTINGS, ['2026-07', '2026-08', '2026-09', '2026-10'], '2026-10-14')
  assert.deepEqual(r.map(x => x.joined), [1, 0, 1, 0])
  assert.deepEqual(r.map(x => x.left), [1, 0, 0, 0]) // b ended 30/09, only 14 days ago
})

test('belts: current = latest promotion, next follows the group order', () => {
  const promos = [
    { id: '1', memberId: 'a', groupId: 'bjj', beltId: 'white', date: '2025-01-01' },
    { id: '2', memberId: 'a', groupId: 'bjj', beltId: 'blue', date: '2026-03-01' },
    { id: '3', memberId: 'a', groupId: 'judo', beltId: 'green', date: '2026-05-01' },
  ]
  assert.equal(currentBelt(promos, 'a', 'bjj').beltId, 'blue')
  const bjj = DEFAULT_GROUPS.find(g => g.id === 'bjj')
  assert.equal(nextBelt(bjj, 'blue').id, 'purple')
  assert.equal(nextBelt(bjj, 'black'), null)
  assert.equal(nextBelt(bjj, undefined).id, 'white')
  const dist = beltDistribution([member('a', ['bjj'])], [pay('a', '2026-10-01', '2026-10-01', '2026-10-31')], promos, DEFAULT_GROUPS, SETTINGS, '2026-10-14')
  assert.equal(dist.find(d => d.group.id === 'bjj').counts.blue, 1)
})

test('money, search and member prices', () => {
  assert.equal(money('25,5'), 25.5)
  assert.equal(money('abc'), 0)
  assert.equal(money(null), 0)
  assert.ok(matchesSearch({ name: 'Παπαδόπουλος Σπύρος' }, 'σπυρος παπαδ'))
  assert.ok(matchesSearch({ name: 'Γιώργος', phone: '6971234567' }, '697'))
  assert.ok(!matchesSearch({ name: 'Γιώργος' }, 'νίκος'))
  assert.equal(planPrice(MONTH, { price: 40 }), 40)       // sibling price
  assert.equal(planPrice(HALF, { price: 40 }), 25)        // only the monthly plan
  assert.equal(planPrice(MONTH, { price: null }), 50)
})

test('kpis: month revenue is compared with the same days of last month', () => {
  const payments = [
    pay('a', '2026-09-05', null, null, { amount: 50 }),
    pay('b', '2026-09-20', null, null, { amount: 50 }),   // after 14/09: not comparable yet
    pay('c', '2026-10-03', null, null, { amount: 40 }),
  ]
  const k = kpis([member('a')], payments, [], SETTINGS, '2026-10-14')
  assert.equal(k.revenueThisMonth, 40)
  assert.equal(k.revenuePrevMonthToDate, 50)
})

test('filterMembers: every criterion, combined with AND', () => {
  const m = (id, groups, since, extra = {}) => ({ ...member(id, groups, since), ...extra })
  const members = [
    m('a', ['bjj'], '2025-01-01'),
    m('b', ['bjj'], '2025-01-01'),
    m('c', ['judo'], '2026-10-02', { enrollments: [{ groupId: 'judo', since: '2026-10-02', price: 40 }] }),
    m('d', ['bjj', 'judo'], '2025-06-01'),
  ]
  const payments = [
    pay('a', '2026-10-01', '2026-10-01', '2026-10-31'),
    pay('b', '2026-07-20', '2026-07-20', '2026-08-19'),
    { ...pay('d', '2026-10-05', '2026-10-05', '2026-11-04'), groupId: 'judo' },
  ]
  const promotions = [
    { id: 'p1', memberId: 'a', groupId: 'bjj', beltId: 'blue', date: '2026-01-01' },
    { id: 'p2', memberId: 'b', groupId: 'bjj', beltId: 'white', date: '2025-01-01' },
  ]
  const seminars = [{ id: 's', date: '2026-10-01', participants: [
    { memberId: 'b', amount: 20, paidOn: null },
    { memberId: 'a', amount: 20, paidOn: '2026-10-01' },
  ] }]
  const ctx = { payments, promotions, seminars, settings: SETTINGS, today: '2026-10-14' }
  const ids = (f) => filterMembers(members, ctx, { ...EMPTY_FILTER, ...f }).map(x => x.id)

  assert.deepEqual(ids({}), ['a', 'b', 'c', 'd'])
  assert.deepEqual(ids({ groups: ['judo'] }), ['c', 'd'])
  assert.deepEqual(ids({ belts: ['bjj:blue'] }), ['a'])
  assert.deepEqual(ids({ states: ['paused'] }), ['b', 'd'])            // d is paused in bjj
  assert.deepEqual(ids({ states: ['paused'], groups: ['judo'] }), [])   // …but not in judo
  // no payment since 14/08 in any group: only b (d paid judo on 05/10)
  assert.deepEqual(ids({ notPaidMonths: 2 }), ['b'])
  // looking at bjj only: d never paid bjj and started in 2025
  assert.deepEqual(ids({ notPaidMonths: 2, groups: ['bjj'] }), ['b', 'd'])
  // a new member who hasn't paid yet is not "2 months without paying"
  assert.equal(ids({ notPaidMonths: 2 }).includes('c'), false)
  assert.deepEqual(ids({ paidFrom: '2026-10-01', paidTo: '2026-10-31' }), ['a', 'd'])
  assert.deepEqual(ids({ joinedFrom: '2026-10-01' }), ['c'])
  assert.deepEqual(ids({ customPrice: true }), ['c'])
  assert.deepEqual(ids({ owesSeminar: true }), ['b'])
  assert.deepEqual(ids({ owesSeminar: true, notPaidMonths: 2 }), ['b'])
  assert.equal(isFilterActive(EMPTY_FILTER), false)
  assert.deepEqual(
    describeFilter({ ...EMPTY_FILTER, notPaidMonths: 2, groups: ['bjj'] }, DEFAULT_GROUPS),
    ['BJJ', 'Δεν πλήρωσαν 2 μήνες'],
  )
})
