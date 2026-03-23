import { useMemo } from 'react'
import { useData } from '../contexts/DataContext'

/**
 * Returns a filtered + derived view of members.
 * @param {object} filters
 * @param {string} filters.search  - text search (name, phone, email)
 * @param {string} filters.category - single category key or ''
 * @param {string} filters.status   - 'active' | 'inactive' | ''
 */
export function useMembers({ search = '', category = '', status = '' } = {}) {
  const { members, loading, addMember, updateMember, deleteMember } = useData()

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return members.filter(m => {
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.phone ?? '').includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)

      const matchCategory = !category || (m.categories ?? []).includes(category)
      const matchStatus   = !status   || m.status === status

      return matchSearch && matchCategory && matchStatus
    })
  }, [members, search, category, status])

  const stats = useMemo(() => ({
    total:    members.length,
    active:   members.filter(m => m.status === 'active').length,
    inactive: members.filter(m => m.status === 'inactive').length,
  }), [members])

  return {
    members: filtered,
    allMembers: members,
    stats,
    loading,
    addMember,
    updateMember,
    deleteMember,
  }
}
