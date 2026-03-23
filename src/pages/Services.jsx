import { useState } from 'react'
import {
  Pencil, Plus, CheckCircle, XCircle, X, Trash2,
  Phone, Mail, UserCircle2, Award,
} from 'lucide-react'
import { useServices } from '../contexts/ServicesContext'
import { useInstructors } from '../contexts/InstructorsContext'
import { useData } from '../contexts/DataContext'
import { useSchedule } from '../contexts/ScheduleContext'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input, { Textarea } from '../components/ui/Input'
import { formatCurrency, hexToRgba } from '../utils/helpers'

// ── Color presets ─────────────────────────────────────────────────────────────
const COLOR_PRESETS = [
  '#3b82f6', '#f97316', '#10b981', '#a855f7',
  '#ef4444', '#eab308', '#14b8a6', '#f43f5e',
  '#6366f1', '#0ea5e9', '#ec4899', '#84cc16',
]

// ──────────────────────────────────────────────────────────────────────────────
// SERVICE MODAL
// ──────────────────────────────────────────────────────────────────────────────
function ServiceModal({ service, onClose, onSave }) {
  const isEdit = !!service
  const [form, setForm] = useState({
    name:        service?.name        ?? '',
    description: service?.description ?? '',
    color:       service?.color       ?? '#3b82f6',
    monthlyFee:  service?.monthlyFee  ?? 0,
    usesBelts:   service?.usesBelts   ?? false,
    active:      service?.active      ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key, val) { setForm(p => ({ ...p, [key]: val })) }

  async function handleSave() {
    if (!form.name.trim()) { setError('Service name is required'); return }
    setSaving(true)
    try {
      await onSave({ ...form, monthlyFee: Number(form.monthlyFee) || 0 })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={isEdit ? `Edit — ${service.name}` : 'Add New Service'}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} loading={saving}>
            {isEdit ? 'Save Changes' : 'Add Service'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Service Name"
          value={form.name}
          onChange={e => { set('name', e.target.value); setError('') }}
          placeholder="e.g. Kickboxing"
          error={error}
          autoFocus
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Brief description of this service..."
          rows={3}
        />
        <Input
          label="Monthly Fee (€)"
          type="number"
          min={0}
          step={5}
          value={form.monthlyFee}
          onChange={e => set('monthlyFee', e.target.value)}
          placeholder="40"
        />
        {/* Color picker */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map(hex => (
              <button
                key={hex}
                type="button"
                onClick={() => set('color', hex)}
                className={`w-8 h-8 rounded-full transition-all ${form.color === hex ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-105'}`}
                style={{ background: hex }}
                title={hex}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Selected: {form.color}</p>
        </div>
        {/* Uses Belts toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <div>
            <p className="text-xs font-medium text-gray-700">Uses Belt System</p>
            <p className="text-xs text-gray-400">Members of this service can have belts assigned</p>
          </div>
          <button
            type="button"
            onClick={() => set('usesBelts', !form.usesBelts)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${form.usesBelts ? 'bg-primary-500' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${form.usesBelts ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
        {/* Active toggle (edit only) */}
        {isEdit && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <div>
              <p className="text-xs font-medium text-gray-700">Active</p>
              <p className="text-xs text-gray-400">Inactive services won't appear in new member forms</p>
            </div>
            <button
              type="button"
              onClick={() => set('active', !form.active)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${form.active ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${form.active ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Service card ──────────────────────────────────────────────────────────────
function ServiceCard({ service, memberCount, monthlyRevenue, onEdit }) {
  return (
    <Card>
      <div className="h-1 -mx-5 -mt-5 mb-4 rounded-t-xl" style={{ background: service.color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
            style={{ background: service.color }}
          >
            {service.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900 break-words">{service.name}</p>
              {service.active
                ? <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                : <XCircle    size={13} className="text-gray-300 shrink-0" />}
              {service.usesBelts && (
                <Award size={12} className="text-amber-500 shrink-0" title="Uses belt system" />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{service.description}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onEdit} className="shrink-0">
          <Pencil size={12} /> Edit
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">{formatCurrency(service.monthlyFee)}</p>
          <p className="text-xs text-gray-400">per month</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">{memberCount}</p>
          <p className="text-xs text-gray-400">members</p>
        </div>
      </div>
    </Card>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// INSTRUCTOR MODAL
// ──────────────────────────────────────────────────────────────────────────────
function InstructorModal({ instructor, services, onClose, onSave, onDelete }) {
  const isEdit = !!instructor
  const activeServices = services.filter(s => s.active)

  const [form, setForm] = useState({
    name:       instructor?.name       ?? '',
    phone:      instructor?.phone      ?? '',
    email:      instructor?.email      ?? '',
    bio:        instructor?.bio        ?? '',
    serviceIds: instructor?.serviceIds ?? [],
    active:     instructor?.active     ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(key, val) { setForm(p => ({ ...p, [key]: val })) }

  function toggleService(id) {
    setForm(p => ({
      ...p,
      serviceIds: p.serviceIds.includes(id)
        ? p.serviceIds.filter(s => s !== id)
        : [...p.serviceIds, id],
    }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try { await onSave(form); onClose() }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove ${instructor.name}?`)) return
    setSaving(true)
    try { await onDelete(); onClose() }
    finally { setSaving(false) }
  }

  return (
    <Modal
      title={isEdit ? `Edit — ${instructor.name}` : 'Add Instructor'}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {isEdit && (
              <Button variant="danger" size="sm" onClick={handleDelete} loading={saving}>
                <Trash2 size={12} /> Remove
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              {isEdit ? 'Save Changes' : 'Add Instructor'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Full Name"
          value={form.name}
          onChange={e => { set('name', e.target.value); setError('') }}
          placeholder="e.g. Sensei Kostas"
          error={error}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Phone (optional)"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="+30 694..."
          />
          <Input
            label="Email (optional)"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="name@gym.com"
          />
        </div>
        <Textarea
          label="Bio / Notes (optional)"
          value={form.bio}
          onChange={e => set('bio', e.target.value)}
          placeholder="e.g. 4th Dan Judo. Training since 1998..."
          rows={3}
        />

        {/* Services */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Linked Services</label>
          <div className="flex flex-wrap gap-2">
            {activeServices.map(s => {
              const isLinked = form.serviceIds.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all"
                  style={isLinked ? {
                    background: hexToRgba(s.color, 0.15),
                    borderColor: s.color,
                    color: s.color,
                  } : {
                    background: 'transparent',
                    borderColor: '#e5e7eb',
                    color: '#9ca3af',
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Active toggle (edit only) */}
        {isEdit && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <div>
              <p className="text-xs font-medium text-gray-700">Active</p>
              <p className="text-xs text-gray-400">Show in schedule assignments</p>
            </div>
            <button
              type="button"
              onClick={() => set('active', !form.active)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${form.active ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${form.active ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Instructor card ───────────────────────────────────────────────────────────
function InstructorCard({ instructor, services, classes, onEdit }) {
  const linkedServices = services.filter(s => (instructor.serviceIds ?? []).includes(s.id))
  const initials = instructor.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // Calculate weekly hours from assigned classes
  // Check both instructorId (single/backward-compat) and instructorIds (multi-array)
  const assignedClasses = classes.filter(c =>
    c.instructorId === instructor.id ||
    (Array.isArray(c.instructorIds) && c.instructorIds.includes(instructor.id))
  )
  const weeklyMinutes = assignedClasses.reduce((sum, c) => {
    const [sh, sm] = (c.startTime ?? '00:00').split(':').map(Number)
    const [eh, em] = (c.endTime   ?? '00:00').split(':').map(Number)
    return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
  }, 0)
  const weeklyHours = (weeklyMinutes / 60).toFixed(1)
  const classCount  = assignedClasses.length

  return (
    <Card>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900 truncate">{instructor.name}</p>
            {instructor.active
              ? <CheckCircle size={12} className="text-emerald-500 shrink-0" />
              : <XCircle size={12} className="text-gray-300 shrink-0" />}
          </div>
          {/* Contact */}
          <div className="flex flex-col gap-0.5 mt-1">
            {instructor.phone && (
              <a href={`tel:${instructor.phone}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors">
                <Phone size={10} /> {instructor.phone}
              </a>
            )}
            {instructor.email && (
              <a href={`mailto:${instructor.email}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors truncate">
                <Mail size={10} /> {instructor.email}
              </a>
            )}
          </div>
          {/* Bio */}
          {instructor.bio && (
            <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{instructor.bio}</p>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={onEdit} className="shrink-0">
          <Pencil size={12} /> Edit
        </Button>
      </div>

      {/* Linked services */}
      {linkedServices.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
          {linkedServices.map(s => (
            <span
              key={s.id}
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: hexToRgba(s.color, 0.12), color: s.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      {/* Hours metrics */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-gray-900">{classCount}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Classes/week</p>
        </div>
        <div className="w-px h-8 bg-gray-100" />
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-primary-600">{weeklyHours}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Hrs/week</p>
        </div>
        <div className="w-px h-8 bg-gray-100" />
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-gray-900">{(parseFloat(weeklyHours) * 4).toFixed(0)}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Hrs/month</p>
        </div>
      </div>
    </Card>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────
export default function ServicesPage() {
  const { services, updateService, addService } = useServices()
  const { instructors, addInstructor, updateInstructor, removeInstructor } = useInstructors()
  const { members } = useData()
  const { classes } = useSchedule()

  const [activeTab,    setActiveTab]    = useState('services') // 'services' | 'instructors'
  const [editService,  setEditService]  = useState(null)
  const [showAdd,      setShowAdd]      = useState(false)
  const [editInstructor, setEditInstructor] = useState(null)
  const [showAddIns,   setShowAddIns]   = useState(false)

  function getMemberCount(serviceId) {
    return members.filter(m => m.status === 'active' && (m.categories ?? []).includes(serviceId)).length
  }

  function getMonthlyRevenue(service) {
    return getMemberCount(service.id) * service.monthlyFee
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Services</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage offerings, prices, and instructors</p>
        </div>
        <Button
          size="sm"
          onClick={() => activeTab === 'services' ? setShowAdd(true) : setShowAddIns(true)}
        >
          <Plus size={13} />
          {activeTab === 'services' ? 'Add Service' : 'Add Instructor'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center bg-gray-100 rounded-xl p-1 w-fit gap-1">
        {[
          { id: 'services',    label: 'Services' },
          { id: 'instructors', label: 'Instructors' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-gray-400">
              {tab.id === 'services' ? services.length : instructors.length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Services tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'services' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {services.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                memberCount={getMemberCount(service.id)}
                monthlyRevenue={getMonthlyRevenue(service)}
                onEdit={() => setEditService(service)}
              />
            ))}
          </div>

          {/* Summary (removed avg fee) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{services.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total services</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{services.filter(s => s.active).length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Active</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm col-span-2 sm:col-span-1">
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(services.reduce((sum, s) => sum + getMonthlyRevenue(s), 0))}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Est. monthly revenue</p>
            </div>
          </div>
        </>
      )}

      {/* ── Instructors tab ───────────────────────────────────────────────────── */}
      {activeTab === 'instructors' && (
        <>
          {/* Instructor summary stats */}
          {instructors.length > 0 && (() => {
            const totalWeeklyMins = instructors.filter(i => i.active).reduce((sum, ins) => {
              return sum + classes.filter(c => c.instructorId === ins.id).reduce((s, c) => {
                const [sh, sm] = (c.startTime ?? '00:00').split(':').map(Number)
                const [eh, em] = (c.endTime   ?? '00:00').split(':').map(Number)
                return s + Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
              }, 0)
            }, 0)
            const totalHrs = (totalWeeklyMins / 60).toFixed(1)
            const covered  = new Set(classes.filter(c => c.instructorId).map(c => c.id)).size
            const total    = classes.length
            return (
              <div className="flex gap-4 mb-4">
                {[
                  { label: 'Active Instructors', value: instructors.filter(i => i.active).length },
                  { label: 'Total hrs/week',     value: totalHrs },
                  { label: 'Classes covered',    value: `${covered}/${total}` },
                ].map(s => (
                  <div key={s.label} className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {instructors.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
              <UserCircle2 size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">No instructors yet</p>
              <p className="text-xs text-gray-400 mt-1">Add an instructor to assign them to services and classes</p>
              <button
                onClick={() => setShowAddIns(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors"
              >
                <Plus size={13} /> Add First Instructor
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {instructors.map(ins => (
                <InstructorCard
                  key={ins.id}
                  instructor={ins}
                  services={services}
                  classes={classes}
                  onEdit={() => setEditInstructor(ins)}
                />
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{instructors.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total instructors</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{instructors.filter(i => i.active).length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Active</p>
            </div>
          </div>
        </>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}
      {editService && (
        <ServiceModal
          service={editService}
          onClose={() => setEditService(null)}
          onSave={data => updateService(editService.id, data)}
        />
      )}
      {showAdd && (
        <ServiceModal
          service={null}
          onClose={() => setShowAdd(false)}
          onSave={data => addService(data)}
        />
      )}
      {editInstructor && (
        <InstructorModal
          instructor={editInstructor}
          services={services}
          onClose={() => setEditInstructor(null)}
          onSave={data => updateInstructor(editInstructor.id, data)}
          onDelete={() => removeInstructor(editInstructor.id)}
        />
      )}
      {showAddIns && (
        <InstructorModal
          instructor={null}
          services={services}
          onClose={() => setShowAddIns(false)}
          onSave={data => addInstructor(data)}
          onDelete={() => {}}
        />
      )}
    </div>
  )
}
