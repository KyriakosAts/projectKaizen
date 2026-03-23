import { useState, useEffect } from 'react'
import { Link, useSearchParams, useOutletContext } from 'react-router-dom'
import { Eye, Pencil, Trash2 } from 'lucide-react'

import { useMembers } from '../hooks/useMembers'
import { ServiceBadge, StatusBadge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Avatar from '../components/ui/Avatar'
import MemberModal from '../components/MemberModal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { BELT_COLORS, BELT_LABELS, getMemberBelts, formatDate, CATEGORY_LABELS } from '../utils/helpers'
import { useServices } from '../contexts/ServicesContext'

// ── Delete confirmation ────────────────────────────────────────────────────────
function DeleteModal({ member, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false)
  async function handleDelete() {
    setDeleting(true)
    await onConfirm()
    onClose()
  }
  return (
    <Modal
      title="Delete Member"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
        </>
      }
    >
      <p className="text-sm text-gray-600">
        Are you sure you want to delete{' '}
        <span className="font-semibold text-gray-900">{member.name}</span>?{' '}
        This will also remove all their payment records and cannot be undone.
      </p>
    </Modal>
  )
}

// ── Belt display (multi-belt) ─────────────────────────────────────────────────
function BeltDisplay({ member }) {
  const { services } = useServices()
  const belts = getMemberBelts(member, services)
  if (belts.length === 0) return <span className="text-xs text-gray-300">—</span>
  return (
    <div className="flex flex-col gap-1">
      {belts.map(({ category, belt }) => (
        <div key={category} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full border border-gray-200 shrink-0"
            style={{ background: BELT_COLORS[belt] }}
            title={`${CATEGORY_LABELS[category]}: ${BELT_LABELS[belt]} Belt`}
          />
          <span className="text-xs text-gray-500 capitalize">{BELT_LABELS[belt]}</span>
        </div>
      ))}
    </div>
  )
}

export default function Members() {
  const { activeCategory, memberSearch = '' } = useOutletContext() ?? {}
  const [searchParams] = useSearchParams()
  const [status, setStatus]     = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [deleteMember, setDeleteMember] = useState(null)

  const { members, loading, addMember, updateMember, deleteMember: doDelete } =
    useMembers({ search: memberSearch, category: activeCategory || '', status })

  useEffect(() => {
    if (searchParams.get('add') === '1') { setEditMember(null); setShowModal(true) }
  }, [searchParams])

  function openAdd()   { setEditMember(null); setShowModal(true) }
  function openEdit(m) { setEditMember(m);    setShowModal(true) }

  async function handleSave(data) {
    if (editMember) await updateMember(editMember.id, data)
    else            await addMember(data)
  }

  if (loading) return <PageLoader />

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status filter */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-0.5">
          {['', 'active', 'inactive'].map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <p className="text-xs text-gray-400">{members.length} members</p>
        <Button size="sm" onClick={openAdd}>+ Add Member</Button>
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sports</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Belt(s)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                    No members found
                  </td>
                </tr>
              ) : members.map(member => (
                <tr key={member.id} className="hover:bg-gray-50/60 transition-colors group">
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={member.name} size="md" />
                      <div>
                        <Link
                          to={`/members/${member.id}`}
                          className="font-semibold text-gray-900 hover:text-primary-600 transition-colors text-sm"
                        >
                          {member.name}
                        </Link>
                        {member.email && (
                          <p className="text-xs text-gray-400 hidden sm:block">{member.email}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Categories */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(member.categories ?? []).map(c => (
                        <ServiceBadge key={c} serviceId={c} />
                      ))}
                    </div>
                  </td>

                  {/* Belt(s) */}
                  <td className="px-4 py-3">
                    <BeltDisplay member={member} />
                  </td>

                  {/* Joined */}
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap hidden md:table-cell">
                    {formatDate(member.joinDate)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={member.status} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Link
                        to={`/members/${member.id}`}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Eye size={14} />
                      </Link>
                      <button
                        onClick={() => openEdit(member)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteMember(member)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <MemberModal
          member={editMember}
          onClose={() => { setShowModal(false); setEditMember(null) }}
          onSave={handleSave}
        />
      )}
      {deleteMember && (
        <DeleteModal
          member={deleteMember}
          onClose={() => setDeleteMember(null)}
          onConfirm={() => doDelete(deleteMember.id)}
        />
      )}
    </div>
  )
}
