import { useState } from 'react'
import { format, addMonths, startOfMonth } from 'date-fns'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Input, { Textarea, Select } from './ui/Input'
import {
  BELT_COLORS, BELT_LABELS, BELTS, CATEGORY_LABELS, BELT_CATS,
  toInputDate, currentMonthStr,
} from '../utils/helpers'
import { useServices } from '../contexts/ServicesContext'
import { useData } from '../contexts/DataContext'

const EMPTY_FORM = {
  name: '', phone: '', email: '',
  categories: [],
  belts: {},
  joinDate: format(new Date(), 'yyyy-MM-dd'),
  serviceDates: {},
  notes: '',
  status: 'active',
  customFee: '',
}

function initForm(member) {
  if (!member) return { ...EMPTY_FORM, belts: {} }

  // Backwards compat: if member has old single `belt` field, convert
  let belts = member.belts ?? {}
  if (!member.belts && member.belt) {
    const relevantCats = (member.categories ?? []).filter(c => BELT_CATS.includes(c))
    belts = Object.fromEntries(relevantCats.map(c => [c, member.belt]))
  }

  // Build serviceDates: use stored serviceDates or fall back to joinDate per category
  const baseJoinDate = toInputDate(member.joinDate) || format(new Date(), 'yyyy-MM-dd')
  const serviceDates = {}
  if (member.serviceDates) {
    Object.entries(member.serviceDates).forEach(([k, v]) => {
      serviceDates[k] = toInputDate(v) || baseJoinDate
    })
  }

  return {
    name:     member.name ?? '',
    phone:    member.phone ?? '',
    email:    member.email ?? '',
    categories: member.categories ?? [],
    belts,
    joinDate: baseJoinDate,
    serviceDates,
    notes:    member.notes ?? '',
    status:   member.status ?? 'active',
    customFee: member.customFee != null ? String(member.customFee) : '',
  }
}

export default function MemberModal({ member, onClose, onSave, addBeltPromotion, existingBeltHistory }) {
  const [form, setForm] = useState(() => initForm(member))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [backfillStep, setBackfillStep] = useState(null) // { memberId, monthList, fee }
  const { services, getMemberFee } = useServices()
  const { addPayment } = useData()

  const beltCats = form.categories.filter(c => services.find(s => s.id === c)?.usesBelts)

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: '' }))
  }

  function toggleCategory(cat) {
    const next = form.categories.includes(cat)
      ? form.categories.filter(c => c !== cat)
      : [...form.categories, cat]
    // Remove belts for deselected categories
    const nextBelts = Object.fromEntries(
      Object.entries(form.belts).filter(([k]) => next.includes(k) && services.find(s => s.id === k)?.usesBelts)
    )
    setForm(prev => ({ ...prev, categories: next, belts: nextBelts }))
    setErrors(prev => ({ ...prev, categories: '' }))
  }

  function setBelt(cat, belt) {
    setForm(prev => ({ ...prev, belts: { ...prev.belts, [cat]: belt } }))
  }

  function validate() {
    const e = {}
    if (!form.name.trim())           e.name = 'Name is required'
    if (form.categories.length === 0) e.categories = 'Select at least one category'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setErrors({})
    try {
      const validBelts = Object.fromEntries(
        Object.entries(form.belts).filter(([cat]) =>
          form.categories.includes(cat) && services.find(s => s.id === cat)?.usesBelts
        )
      )
      const data = {
        ...form,
        // Keep joinDate as a plain YYYY-MM-DD string — DataContext serializer normalizes it
        joinDate: form.joinDate,
        // Per-service start dates — plain strings, not Date objects
        serviceDates: Object.fromEntries(
          beltCats.map(cat => [
            cat,
            form.serviceDates[cat] || form.joinDate,
          ])
        ),
        // Only keep belts for currently selected belt-requiring categories
        belts: validBelts,
        belt: undefined, // Remove legacy field
        customFee: form.customFee !== '' ? Number(form.customFee) : null,
      }
      const returnedId = await onSave(data)
      const effectiveMemberId = returnedId ?? member?.id

      // Auto-create "Joined" belt history entry for new belt service assignments.
      // The member is already saved at this point — a failure here must not
      // look like a failed save (resubmitting would create a duplicate member).
      if (addBeltPromotion && effectiveMemberId) {
        try {
          for (const cat of beltCats) {
            const belt = validBelts[cat]
            if (!belt) continue
            // Skip if there's already a history entry for this member + category
            const hasHistory = (existingBeltHistory ?? []).some(
              h => h.memberId === effectiveMemberId && h.category === cat
            )
            if (hasHistory) continue
            await addBeltPromotion(effectiveMemberId, {
              category:   cat,
              fromBelt:   null,
              toBelt:     belt,
              promotedAt: form.serviceDates[cat] || form.joinDate,
              notes:      'Started journey',
            })
          }
        } catch (err) {
          console.error('[MemberModal] Member saved, but starting belt history failed:', err)
        }
      }

      // For new members with a join date before the current month,
      // ask whether to backfill payment records for all past months
      if (!member && effectiveMemberId) {
        const joinDate = new Date(form.joinDate)
        const joinMonth = format(joinDate, 'yyyy-MM')
        const cm = currentMonthStr()
        if (joinMonth < cm) {
          const monthList = []
          let d = startOfMonth(joinDate)
          while (format(d, 'yyyy-MM') <= cm) {
            monthList.push(format(d, 'yyyy-MM'))
            d = addMonths(d, 1)
          }
          const fee = getMemberFee({
            categories: form.categories,
            customFee: form.customFee !== '' ? Number(form.customFee) : null,
          }) || 0
          setBackfillStep({ memberId: effectiveMemberId, monthList, fee })
          return // stay open for the backfill prompt
        }
      }

      onClose()
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.message ?? 'Failed to save member. Please try again.'
      setErrors(prev => ({ ...prev, _general: msg }))
    } finally {
      setSaving(false)
    }
  }

  async function handleBackfillAll() {
    if (!backfillStep) return
    setSaving(true)
    // Work through a mutable list so a mid-loop failure keeps only the
    // remaining months — retrying never re-creates already-added payments
    const remaining = [...backfillStep.monthList]
    try {
      while (remaining.length > 0) {
        await addPayment({
          memberId: backfillStep.memberId,
          month:    remaining[0],
          amount:   backfillStep.fee,
          status:   'unpaid',
        })
        remaining.shift()
      }
      onClose()
    } catch (err) {
      setBackfillStep(prev => (prev ? { ...prev, monthList: remaining } : prev))
      const msg = typeof err === 'string' ? err : err?.message ?? 'Unknown error'
      setErrors(prev => ({ ...prev, _general: `Backfill stopped (${remaining.length} months left): ${msg}. Click again to add the rest.` }))
    } finally {
      setSaving(false)
    }
  }

  function handleBackfillSkip() {
    onClose()
  }

  // ── Backfill payment prompt (shown after saving a new member with old join date) ──
  if (backfillStep) {
    const pastMonths = backfillStep.monthList.length - 1 // exclude current month
    const joinLabel  = format(new Date(backfillStep.monthList[0] + '-01'), 'MMMM yyyy')
    return (
      <Modal
        title="Payment History"
        onClose={handleBackfillSkip}
        size="sm"
        footer={
          <div className="flex gap-2 w-full justify-end">
            <Button variant="secondary" onClick={handleBackfillSkip} disabled={saving}>
              Start fresh
            </Button>
            <Button onClick={handleBackfillAll} loading={saving}>
              Add {backfillStep.monthList.length} months
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <span className="text-amber-500 text-lg mt-0.5">📅</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Member joined in {joinLabel}</p>
              <p className="text-xs text-gray-500 mt-1">
                That's {pastMonths} month{pastMonths !== 1 ? 's' : ''} before today. Would you like to create
                payment records for all <span className="font-semibold">{backfillStep.monthList.length}</span> months
                (from {joinLabel} to now) or start tracking from this month only?
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
            <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
              <p className="font-semibold text-gray-700 mb-1">Add all past payments</p>
              <p>Creates <span className="font-semibold text-gray-900">{backfillStep.monthList.length}</span> unpaid
                records starting {joinLabel}. You can then mark each month paid individually.</p>
            </div>
            <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
              <p className="font-semibold text-gray-700 mb-1">Start fresh</p>
              <p>No historical records. Payments will only be tracked from the current month forward.</p>
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title={member ? 'Edit Member' : 'Add New Member'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>
            {member ? 'Save Changes' : 'Add Member'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* General error banner */}
        {errors._general && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>{errors._general}</span>
          </div>
        )}
        {/* Name */}
        <Input
          label="Full Name"
          required
          value={form.name}
          onChange={e => set('name', e.target.value)}
          error={errors.name}
          placeholder="e.g. Νίκος Παπαδόπουλος"
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="6940001111"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="name@example.com"
          />
        </div>

        {/* Categories */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600">
            Categories <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {services.filter(s => s.active).map(service => {
              const selected = form.categories.includes(service.id)
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleCategory(service.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selected
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {service.name}
                </button>
              )
            })}
          </div>
          {errors.categories && <p className="text-xs text-red-500">{errors.categories}</p>}
        </div>

        {/* Belts (one per relevant category) */}
        {beltCats.length > 0 && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-600">Belts</label>
            {beltCats.map(cat => (
              <div key={cat} className="space-y-1.5">
                <p className="text-xs text-gray-500 font-medium">{services.find(s => s.id === cat)?.name ?? CATEGORY_LABELS[cat] ?? cat}</p>
                <div className="flex flex-wrap gap-2">
                  {BELTS.map(belt => (
                    <button
                      key={belt}
                      type="button"
                      onClick={() => setBelt(cat, belt)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        form.belts[cat] === belt
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0"
                        style={{ background: BELT_COLORS[belt] }}
                      />
                      {BELT_LABELS[belt]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Per-service start dates */}
        {beltCats.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-600">Service Start Dates</label>
            <p className="text-xs text-gray-400">When did this member start each belt discipline?</p>
            {beltCats.map(cat => {
              const svc = services.find(s => s.id === cat)
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-lg shrink-0"
                    style={{ background: (svc?.color ?? '#94a3b8') + '20', color: svc?.color ?? '#94a3b8' }}
                  >
                    {svc?.name ?? CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <input
                    type="date"
                    value={form.serviceDates[cat] || form.joinDate}
                    onChange={e => setForm(f => ({ ...f, serviceDates: { ...f.serviceDates, [cat]: e.target.value } }))}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary-400 bg-white"
                  />
                </div>
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Join Date"
            type="date"
            value={form.joinDate}
            onChange={e => set('joinDate', e.target.value)}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={e => set('status', e.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        <Textarea
          label="Notes"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          placeholder="Any relevant notes…"
        />

        {/* Custom Monthly Fee */}
        <div className="pt-2 border-t border-gray-100">
          <Input
            label="Custom Monthly Fee (€) — optional"
            type="number"
            min={0}
            step={5}
            value={form.customFee}
            onChange={e => set('customFee', e.target.value)}
            placeholder="Leave blank to use service rates"
          />
          <p className="text-xs text-gray-400 mt-1">
            Override the auto-calculated fee. Useful for members on special plans or taking multiple services at a discount.
          </p>
        </div>
      </form>
    </Modal>
  )
}
