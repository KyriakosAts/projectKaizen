/**
 * One-time conversion of v2 data (SQLite tables, one payment row per member
 * per month) into v3 documents. Pure: takes the legacy snapshot, returns the
 * new collections. The legacy tables are never modified, and the native side
 * keeps a full copy of the old database (backups/pre-v3-dojo.db).
 *
 * What changes on the way:
 *  - services → groups, with plans built from the old monthly fee
 *  - categories → enrollments; a single-service custom fee → member price
 *  - only PAID payments move (v2 "unpaid" rows were never money); a monthly
 *    payment covers its calendar month; a payment of a member in several
 *    services is split evenly across them so totals and coverage stay right
 *  - event payments → plain payments without a covered period
 *  - belt history → promotions; current belts without history → a promotion
 *  - notes, member notes and monthly comments → one notes text
 *  - attendance is dropped (no longer part of the app)
 */

import { DEFAULT_GROUPS, JUDO_BELTS, BJJ_BELTS, BELT_NAMES, plans } from './defaults.js'
import { monthEnd, isValidDate } from './dates.js'
import { money } from './model.js'

function parseJSON(s, fallback) {
  if (s == null || s === '') return fallback
  if (typeof s !== 'string') return s
  try { return JSON.parse(s) } catch { return fallback }
}

const day = (s) => {
  const d = String(s ?? '').slice(0, 10)
  return isValidDate(d) ? d : null
}

function groupFromService(svc, order) {
  const def = DEFAULT_GROUPS.find(g => g.id === svc.id)
  const usesBelts = svc.usesBelts ?? Boolean(def?.belts?.length)
  return {
    id: svc.id,
    name: svc.name || def?.name || svc.id,
    color: svc.color || def?.color || '#64748b',
    order,
    plans: plans(svc.monthlyFee != null ? money(svc.monthlyFee) : null),
    belts: usesBelts ? (def?.belts ?? (svc.id === 'bjj' ? BJJ_BELTS : JUDO_BELTS)) : [],
  }
}

export function migrateLegacy(legacy, nowIso = new Date().toISOString()) {
  const services = parseJSON(legacy.settings?.services_config, null)
  const serviceList = Array.isArray(services?.services) ? services.services
    : Array.isArray(services) ? services : null

  const groups = (serviceList ?? DEFAULT_GROUPS).map((s, i) =>
    serviceList ? groupFromService(s, i + 1) : { ...s })
  const groupIds = new Set(groups.map(g => g.id))

  const oldMembers = legacy.members ?? []

  // Any category a member uses must exist as a group
  for (const m of oldMembers) {
    for (const c of parseJSON(m.categories, [])) {
      if (!groupIds.has(c)) {
        groups.push(groupFromService({ id: c, name: c }, groups.length + 1))
        groupIds.add(c)
      }
    }
  }
  const groupById = new Map(groups.map(g => [g.id, g]))

  // Notes from three old places, oldest first
  const notesByMember = new Map()
  const addNote = (memberId, text, when) => {
    if (!text || !String(text).trim()) return
    if (!notesByMember.has(memberId)) notesByMember.set(memberId, [])
    notesByMember.get(memberId).push({ when: when ?? '', text: String(text).trim() })
  }
  for (const n of legacy.member_notes ?? []) addNote(n.member_id, n.text, day(n.created_at))
  for (const c of legacy.comments ?? []) addNote(c.member_id, `${c.month}: ${c.text}`, `${c.month}-01`)

  const members = []
  const categoriesOf = new Map()
  for (const m of oldMembers) {
    const cats = parseJSON(m.categories, []).filter(c => groupIds.has(c))
    categoriesOf.set(m.id, cats)
    const dates = parseJSON(m.service_dates, {})
    const fallbackSince = day(m.join_date) ?? day(m.created_at)
    const customFee = m.custom_fee != null && m.custom_fee !== '' ? money(m.custom_fee) : null
    const enrollments = cats.map(c => ({
      groupId: c,
      since: day(dates?.[c]) ?? fallbackSince,
      price: cats.length === 1 && customFee ? customFee : null,
    }))

    const extra = (notesByMember.get(m.id) ?? []).sort((a, b) => a.when.localeCompare(b.when)).map(n => n.text)
    if (customFee && cats.length > 1) extra.push(`Ειδική τιμή (παλιά): ${customFee} € για όλα τα τμήματα`)
    const notes = [m.notes, ...extra].filter(x => x && String(x).trim()).join('\n')

    members.push({
      id: m.id,
      name: String(m.name ?? '').trim() || 'Χωρίς όνομα',
      phone: m.phone || '',
      notes,
      enrollments,
      createdAt: m.created_at || nowIso,
    })
  }
  const memberIds = new Set(members.map(m => m.id))

  const payments = []
  for (const p of legacy.payments ?? []) {
    if (p.status !== 'paid' || !memberIds.has(p.member_id)) continue
    const cats = categoriesOf.get(p.member_id) ?? []
    if (cats.length === 0) continue
    const isEvent = String(p.note ?? '').includes('(event)')
    const month = String(p.month ?? '').slice(0, 7)
    const validMonth = isValidDate(`${month}-01`)
    const date = day(p.paid_at) ?? (validMonth ? `${month}-01` : day(p.created_at))
    if (!date) continue
    const total = money(p.amount)
    const targets = isEvent ? [cats[0]] : cats
    const share = Math.round((total / targets.length) * 100) / 100
    targets.forEach((groupId, i) => {
      // Rounding remainder goes on the first share so the total is exact
      const amount = i === 0 ? Math.round((total - share * (targets.length - 1)) * 100) / 100 : share
      const covers = !isEvent && validMonth
      payments.push({
        id: targets.length === 1 ? p.id : `${p.id}-${i}`,
        memberId: p.member_id,
        groupId,
        date,
        amount,
        planId: covers ? 'month' : null,
        label: isEvent ? String(p.note).replace('(event)', '').trim() || 'Event' : 'Μήνας',
        from: covers ? `${month}-01` : null,
        to: covers ? monthEnd(month) : null,
        note: targets.length > 1 ? 'Μοιρασμένο από παλιά κοινή πληρωμή' : (isEvent ? '' : (p.note || '')),
        createdAt: p.created_at || nowIso,
      })
    })
  }

  const promotions = []
  const hasHistory = new Set()
  for (const b of legacy.belt_history ?? []) {
    if (!memberIds.has(b.member_id) || !groupIds.has(b.category)) continue
    const date = day(b.promoted_at) ?? day(b.created_at)
    if (!date || !b.to_belt) continue
    hasHistory.add(`${b.member_id}|${b.category}`)
    promotions.push({
      id: b.id,
      memberId: b.member_id,
      groupId: b.category,
      beltId: b.to_belt,
      beltName: beltName(groupById.get(b.category), b.to_belt),
      date,
      note: b.notes || '',
      createdAt: b.created_at || nowIso,
    })
  }
  for (const m of oldMembers) {
    if (!memberIds.has(m.id)) continue
    const belts = parseJSON(m.belts, {})
    const member = members.find(x => x.id === m.id)
    for (const [cat, beltId] of Object.entries(belts && typeof belts === 'object' ? belts : {})) {
      if (!beltId || !groupIds.has(cat) || hasHistory.has(`${m.id}|${cat}`)) continue
      const since = member.enrollments.find(e => e.groupId === cat)?.since ?? day(m.created_at)
      if (!since) continue
      promotions.push({
        id: `${m.id}-${cat}-belt`,
        memberId: m.id,
        groupId: cat,
        beltId,
        beltName: beltName(groupById.get(cat), beltId),
        date: since,
        note: '',
        createdAt: m.created_at || nowIso,
      })
    }
  }

  return { groups, members, payments, promotions, seminars: [] }
}

function beltName(group, beltId) {
  return group?.belts?.find(b => b.id === beltId)?.name ?? BELT_NAMES[beltId] ?? beltId
}
