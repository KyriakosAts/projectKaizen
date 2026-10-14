/**
 * The app's business rules — the ONLY place they live. Pages call these;
 * they never re-derive status, coverage or totals themselves.
 *
 * Core idea: a payment covers a period (from → to). A member's standing in a
 * group is read from the latest `to`. Nothing is ever "owed": a member who
 * stops paying turns red for `pauseDays` and then quietly goes "σε παύση".
 */

import {
  addDays, addMonths, daysBetween, monthOf, monthRange, monthEnd, today as todayStr,
} from './dates.js'

// ── Ids & money ──────────────────────────────────────────────────────────────

/** Sortable unique id. crypto.randomUUID is missing in the Android WebView
 *  (tauri.localhost is not a secure context), so build our own. */
export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** Euros with at most two decimals, never NaN. */
export function money(n) {
  const v = Number(String(n ?? '').replace(',', '.'))
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0
}

export function fmtMoney(n) {
  const v = money(n)
  return `${v.toLocaleString('el-GR', { maximumFractionDigits: 2 })} €`
}

// ── Lookups ──────────────────────────────────────────────────────────────────

export function byId(list) {
  const m = new Map()
  for (const x of list) m.set(x.id, x)
  return m
}

export function sortedGroups(groups) {
  return [...groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
}

const collator = new Intl.Collator('el', { sensitivity: 'base' })
export const byName = (a, b) => collator.compare(a.name, b.name)

/** Accent- and case-insensitive Greek/Latin search key. */
export function searchKey(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
}

/** Likely relatives: same surname stem (first word, so Τσέλας/Τσέλα,
 *  Τουλιάτος/Τουλιάτου match). Only a suggestion — any member can be added. */
export function relatives(members, member) {
  const stem = (m) => {
    const first = searchKey(m.name).trim().split(/\s+/)[0] ?? ''
    return first.length >= 5 ? first.slice(0, 6) : null
  }
  const mine = stem(member)
  if (!mine) return []
  return members.filter(m => m.id !== member.id && stem(m) === mine).sort(byName)
}

export function matchesSearch(member, query) {
  const q = searchKey(query).trim()
  if (!q) return true
  const hay = searchKey(`${member.name} ${member.phone ?? ''}`)
  return q.split(/\s+/).every(part => hay.includes(part))
}

// ── Plans & coverage ─────────────────────────────────────────────────────────

/** Price a member is offered for a plan: a member's own monthly price
 *  overrides the group's monthly plan only. */
export function planPrice(plan, enrollment) {
  if (plan.unit === 'month' && plan.count === 1 && enrollment?.price != null) return enrollment.price
  return plan.price
}

/** Last day covered by a plan starting on `from`. */
export function coverageEnd(from, plan) {
  if (plan.unit === 'month') return addDays(addMonths(from, plan.count), -1)
  if (plan.unit === 'week') return addDays(from, plan.count * 7 - 1)
  return addDays(from, plan.count - 1)
}

/** Latest covered day for one member in one group, or null if never paid. */
export function coveredUntil(payments, memberId, groupId) {
  let max = null
  for (const p of payments) {
    if (p.memberId === memberId && p.groupId === groupId && p.to && (!max || p.to > max)) max = p.to
  }
  return max
}

/**
 * Where a new payment's period can start.
 *  - continueFrom: the day after the member's current coverage (keeps their
 *    usual date), or null if they never paid in this group
 *  - defaultFrom:  what the form pre-selects — the continuation, unless it
 *    would already be over on the payment date (someone back after months),
 *    in which case the payment date itself
 * Theofilos knows whether the member actually came; he can switch to "from
 * today" or any date with one tap, so a 2-week absence is never charged.
 */
export function periodStart(payments, memberId, groupId, plan, date) {
  const until = coveredUntil(payments, memberId, groupId)
  if (!until) return { continueFrom: null, defaultFrom: date }
  const continueFrom = addDays(until, 1)
  const stillUseful = coverageEnd(continueFrom, plan) >= date
  return { continueFrom, defaultFrom: stillUseful ? continueFrom : date }
}

/** Default period for a new payment (see periodStart). */
export function suggestPeriod(payments, memberId, groupId, plan, date) {
  const { defaultFrom } = periodStart(payments, memberId, groupId, plan, date)
  return { from: defaultFrom, to: coverageEnd(defaultFrom, plan) }
}

// ── Status ───────────────────────────────────────────────────────────────────

export const STATUS = {
  expired: { label: 'Έληξε',          rank: 0 },
  unpaid:  { label: 'Χωρίς πληρωμή',  rank: 1 },
  soon:    { label: 'Λήγει',          rank: 2 },
  ok:      { label: 'Ενήμερος',       rank: 3 },
  paused:  { label: 'Σε παύση',       rank: 4 },
}

/**
 * Standing of one enrollment.
 * Returns { state, until, days } where `days` is:
 *   ok/soon  → days left until `until`
 *   expired  → days since coverage ended
 *   unpaid   → days since enrolling
 *   paused   → days since coverage ended (or since enrolling)
 */
export function enrollmentStatus(payments, member, enrollment, settings, today = todayStr()) {
  const until = coveredUntil(payments, member.id, enrollment.groupId)
  if (!until) {
    const since = enrollment.since || String(member.createdAt ?? today).slice(0, 10)
    const days = Math.max(0, daysBetween(since, today))
    return { state: days > settings.pauseDays ? 'paused' : 'unpaid', until: null, days }
  }
  const left = daysBetween(today, until)
  if (left > settings.warnDays) return { state: 'ok', until, days: left }
  if (left >= 0) return { state: 'soon', until, days: left }
  const over = -left
  return { state: over > settings.pauseDays ? 'paused' : 'expired', until, days: over }
}

/** Every enrollment's status plus the member's overall (most urgent, with
 *  "paused" only when every enrollment is paused). */
export function memberStatus(payments, member, settings, today = todayStr()) {
  const items = (member.enrollments ?? []).map(e => ({
    groupId: e.groupId,
    ...enrollmentStatus(payments, member, e, settings, today),
  }))
  if (items.length === 0) return { overall: 'paused', items }
  const best = [...items].sort((a, b) => STATUS[a.state].rank - STATUS[b.state].rank)[0]
  return { overall: best.state, items }
}

export function isActive(status) {
  return status.overall !== 'paused'
}

/** Statuses for all members, keyed by member id. */
export function allStatuses(members, payments, settings, today = todayStr()) {
  const map = new Map()
  for (const m of members) map.set(m.id, memberStatus(payments, m, settings, today))
  return map
}

/**
 * The "Σήμερα" lists: enrollments that need attention, one row per
 * (member, group). Expired first (most recent first — the ones most likely
 * to come back), then soon-to-expire, then new members who never paid.
 */
export function attentionList(members, payments, settings, today = todayStr()) {
  const rows = { expired: [], soon: [], unpaid: [] }
  for (const m of members) {
    for (const e of m.enrollments ?? []) {
      const s = enrollmentStatus(payments, m, e, settings, today)
      if (rows[s.state]) rows[s.state].push({ member: m, groupId: e.groupId, ...s })
    }
  }
  rows.expired.sort((a, b) => a.days - b.days)
  rows.soon.sort((a, b) => a.days - b.days)
  rows.unpaid.sort((a, b) => a.days - b.days)
  return rows
}

// ── Belts ────────────────────────────────────────────────────────────────────

/** Latest promotion of a member in a group, or null. */
export function currentBelt(promotions, memberId, groupId) {
  let cur = null
  for (const p of promotions) {
    if (p.memberId !== memberId || p.groupId !== groupId) continue
    if (!cur || p.date > cur.date || (p.date === cur.date && (p.createdAt ?? '') > (cur.createdAt ?? ''))) cur = p
  }
  return cur
}

/** The belt after the current one in the group's order (null at the top). */
export function nextBelt(group, currentBeltId) {
  const belts = group?.belts ?? []
  if (belts.length === 0) return null
  const i = belts.findIndex(b => b.id === currentBeltId)
  if (i === -1) return belts[0]
  return belts[i + 1] ?? null
}

// ── Payments grid ("ποιος πλήρωσε ποιον μήνα") ───────────────────────────────

/**
 * One row per member enrolled in the group; one cell per month.
 * cell.payments = payments dated in that month (what his spreadsheet shows);
 * cell.covered  = the month is covered by an earlier payment (no new money,
 *                 but the member was in good standing).
 */
export function paymentGrid(members, payments, groupId, months) {
  const first = `${months[0]}-01`
  const last = monthEnd(months[months.length - 1])
  const rows = []
  for (const m of members) {
    if (!(m.enrollments ?? []).some(e => e.groupId === groupId)) continue
    const mine = payments.filter(p => p.memberId === m.id && p.groupId === groupId)
    const cells = months.map(month => {
      const start = `${month}-01`
      const end = monthEnd(month)
      const paid = mine.filter(p => monthOf(p.date) === month).sort((a, b) => a.date.localeCompare(b.date))
      const covered = mine.some(p => p.from && p.to && p.from <= end && p.to >= start)
      return { month, payments: paid, covered, total: paid.reduce((s, p) => s + money(p.amount), 0) }
    })
    const inWindow = mine.some(p => p.date >= first && p.date <= last)
    rows.push({ member: m, cells, inWindow })
  }
  return rows.sort((a, b) => byName(a.member, b.member))
}

// ── Seminars & extras ────────────────────────────────────────────────────────

export function seminarTotals(seminar) {
  const parts = seminar.participants ?? []
  const paid = parts.filter(p => p.paidOn)
  return {
    count: parts.length,
    paidCount: paid.length,
    collected: paid.reduce((s, p) => s + money(p.amount), 0),
    outstanding: parts.filter(p => !p.paidOn).reduce((s, p) => s + money(p.amount), 0),
  }
}

/** Seminars that still have unpaid participants. */
export function openSeminars(seminars) {
  return seminars
    .filter(s => (s.participants ?? []).some(p => !p.paidOn))
    .sort((a, b) => b.date.localeCompare(a.date))
}

// ── Statistics ───────────────────────────────────────────────────────────────

/** Money in per month (by payment date), split by group, plus seminars. */
export function revenueByMonth(payments, seminars, months) {
  const rows = months.map(month => ({ month, total: 0, seminars: 0, groups: {} }))
  const idx = new Map(months.map((m, i) => [m, i]))
  for (const p of payments) {
    const i = idx.get(monthOf(p.date))
    if (i === undefined) continue
    const amt = money(p.amount)
    rows[i].total += amt
    rows[i].groups[p.groupId] = (rows[i].groups[p.groupId] ?? 0) + amt
  }
  for (const s of seminars) {
    for (const part of s.participants ?? []) {
      const i = part.paidOn ? idx.get(monthOf(part.paidOn)) : undefined
      if (i === undefined) continue
      const amt = money(part.amount)
      rows[i].total += amt
      rows[i].seminars += amt
    }
  }
  return rows
}

/** Active members per group. */
export function activeByGroup(members, payments, groups, settings, today = todayStr()) {
  return sortedGroups(groups).map(g => {
    let count = 0
    for (const m of members) {
      const e = (m.enrollments ?? []).find(x => x.groupId === g.id)
      if (e && enrollmentStatus(payments, m, e, settings, today).state !== 'paused') count++
    }
    return { group: g, count }
  })
}

/** Belt counts per group among active members (members with no recorded belt
 *  are counted under the group's first belt). */
export function beltDistribution(members, payments, promotions, groups, settings, today = todayStr()) {
  return sortedGroups(groups)
    .filter(g => (g.belts ?? []).length > 0)
    .map(g => {
      const counts = Object.fromEntries(g.belts.map(b => [b.id, 0]))
      for (const m of members) {
        const e = (m.enrollments ?? []).find(x => x.groupId === g.id)
        if (!e || enrollmentStatus(payments, m, e, settings, today).state === 'paused') continue
        const cur = currentBelt(promotions, m.id, g.id)
        const id = cur && counts[cur.beltId] !== undefined ? cur.beltId : g.belts[0].id
        counts[id]++
      }
      return { group: g, counts }
    })
}

/**
 * Per month: members who paid for the first time ("νέοι") and members whose
 * coverage ended that month and never renewed ("σταμάτησαν" — counted only
 * once they are past pauseDays, so it never flags someone still expected back).
 */
export function joinsAndLeaves(members, payments, settings, months, today = todayStr()) {
  const rows = months.map(month => ({ month, joined: 0, left: 0 }))
  const idx = new Map(months.map((m, i) => [m, i]))
  for (const m of members) {
    const mine = payments.filter(p => p.memberId === m.id)
    if (mine.length === 0) continue
    const first = mine.reduce((a, p) => (p.date < a ? p.date : a), mine[0].date)
    const ji = idx.get(monthOf(first))
    if (ji !== undefined) rows[ji].joined++
    const lastTo = mine.reduce((a, p) => (p.to && p.to > a ? p.to : a), '')
    if (lastTo && daysBetween(lastTo, today) > settings.pauseDays) {
      const li = idx.get(monthOf(lastTo))
      if (li !== undefined) rows[li].left++
    }
  }
  return rows
}

/** Money in between two dates (inclusive), payments + paid seminar places. */
export function revenueBetween(payments, seminars, from, to) {
  let total = 0
  for (const p of payments) if (p.date >= from && p.date <= to) total += money(p.amount)
  for (const s of seminars) {
    for (const part of s.participants ?? []) {
      if (part.paidOn && part.paidOn >= from && part.paidOn <= to) total += money(part.amount)
    }
  }
  return total
}

/**
 * Headline numbers for the statistics page. This month's money is compared
 * with the SAME days of last month (1st → same day), never with a whole
 * month — mid-month that would always look like a drop.
 */
export function kpis(members, payments, seminars, settings, today = todayStr()) {
  const monthStart = `${monthOf(today)}-01`
  const prevToday = addMonths(today, -1)
  const prevStart = `${monthOf(prevToday)}-01`
  let active = 0, paused = 0
  for (const m of members) {
    if (memberStatus(payments, m, settings, today).overall === 'paused') paused++
    else active++
  }
  return {
    active,
    paused,
    revenueThisMonth: revenueBetween(payments, seminars, monthStart, today),
    revenuePrevMonthToDate: revenueBetween(payments, seminars, prevStart, prevToday),
  }
}

// ── Member filter (shared by Μέλη, Πληρωμές and the Excel export) ────────────

export const EMPTY_FILTER = {
  groups: [],          // group ids — member is in any of them
  belts: [],           // "groupId:beltId" — current belt is any of them
  states: [],          // enrollment states (ok, soon, expired, unpaid, paused)
  notPaidMonths: null, // no payment for at least this many months
  paidFrom: '',        // paid at least once in [paidFrom, paidTo]
  paidTo: '',
  joinedFrom: '',      // started on/after this date
  customPrice: false,  // has a price of their own
  owesSeminar: false,  // an unpaid seminar place
}

export function isFilterActive(f) {
  return Boolean(f.groups.length || f.belts.length || f.states.length || f.notPaidMonths
    || f.paidFrom || f.paidTo || f.joinedFrom || f.customPrice || f.owesSeminar)
}

/** Ready-made filters for the common questions. */
export function filterPresets(today = todayStr()) {
  return [
    { id: 'notpaid2', label: 'Δεν πλήρωσαν 2 μήνες', filter: { ...EMPTY_FILTER, notPaidMonths: 2 } },
    { id: 'expired', label: 'Έληξαν', filter: { ...EMPTY_FILTER, states: ['expired'] } },
    { id: 'new', label: 'Νέοι του μήνα', filter: { ...EMPTY_FILTER, joinedFrom: `${monthOf(today)}-01` } },
    { id: 'seminar', label: 'Χρωστάνε σεμινάριο', filter: { ...EMPTY_FILTER, owesSeminar: true } },
    { id: 'price', label: 'Με δική τους τιμή', filter: { ...EMPTY_FILTER, customPrice: true } },
  ]
}

/**
 * Members matching every set criterion. When groups are chosen, the
 * payment/state/belt criteria look only at those groups.
 * ctx = { payments, promotions, seminars, settings, today }
 */
export function filterMembers(members, ctx, f) {
  const today = ctx.today ?? todayStr()
  const inGroups = (gid) => f.groups.length === 0 || f.groups.includes(gid)
  const cutoff = f.notPaidMonths ? addMonths(today, -f.notPaidMonths) : null
  const owing = f.owesSeminar ? new Set(ctx.seminars.flatMap(s =>
    (s.participants ?? []).filter(p => !p.paidOn).map(p => p.memberId))) : null

  return members.filter(m => {
    const enr = (m.enrollments ?? []).filter(e => inGroups(e.groupId))
    if (f.groups.length && enr.length === 0) return false
    const mine = ctx.payments.filter(p => p.memberId === m.id && inGroups(p.groupId))

    if (f.states.length) {
      const hit = enr.some(e => f.states.includes(enrollmentStatus(ctx.payments, m, e, ctx.settings, today).state))
      if (!hit) return false
    }
    if (f.belts.length) {
      const hit = f.belts.some(key => {
        const [gid, beltId] = key.split(':')
        return enr.some(e => e.groupId === gid) && currentBelt(ctx.promotions, m.id, gid)?.beltId === beltId
      })
      if (!hit) return false
    }
    if (cutoff) {
      // last payment, or the start date for someone who never paid
      const last = mine.reduce((a, p) => (p.date > a ? p.date : a), '')
      const since = enr.map(e => e.since).filter(Boolean).sort()[0] ?? String(m.createdAt ?? '').slice(0, 10)
      if ((last || since) >= cutoff) return false
    }
    if (f.paidFrom || f.paidTo) {
      const from = f.paidFrom || '0000-01-01'
      const to = f.paidTo || '9999-12-31'
      if (!mine.some(p => p.date >= from && p.date <= to)) return false
    }
    if (f.joinedFrom) {
      const since = enr.map(e => e.since).filter(Boolean).sort()[0] ?? ''
      if (!since || since < f.joinedFrom) return false
    }
    if (f.customPrice && !enr.some(e => e.price != null)) return false
    if (owing && !owing.has(m.id)) return false
    return true
  })
}

const dmy = (s) => s.split('-').reverse().join('/')

/** Short human labels of the active criteria, for chips. */
export function describeFilter(f, groups) {
  const name = (gid) => groups.find(g => g.id === gid)?.name ?? gid
  const out = []
  if (f.groups.length) out.push(f.groups.map(name).join(' / '))
  if (f.states.length) out.push(f.states.map(s => STATUS[s]?.label ?? s).join(' / '))
  if (f.belts.length) {
    out.push(f.belts.map(key => {
      const [gid, bid] = key.split(':')
      const belt = groups.find(g => g.id === gid)?.belts?.find(b => b.id === bid)
      return `${belt?.name ?? bid} (${name(gid)})`
    }).join(' / '))
  }
  if (f.notPaidMonths) out.push(`Δεν πλήρωσαν ${f.notPaidMonths} ${f.notPaidMonths === 1 ? 'μήνα' : 'μήνες'}`)
  if (f.paidFrom || f.paidTo) {
    out.push(['Πλήρωσαν', f.paidFrom && `από ${dmy(f.paidFrom)}`, f.paidTo && `έως ${dmy(f.paidTo)}`].filter(Boolean).join(' '))
  }
  if (f.joinedFrom) out.push(`Νέοι από ${dmy(f.joinedFrom)}`)
  if (f.customPrice) out.push('Με δική τους τιμή')
  if (f.owesSeminar) out.push('Χρωστάνε σεμινάριο')
  return out
}
