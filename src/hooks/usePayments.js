import { useMemo } from 'react'
import { useData } from '../contexts/DataContext'

/**
 * Returns payments for a specific month + derived stats.
 * @param {string} monthStr - e.g. "2026-03"
 * @param {string} statusFilter - 'paid' | 'unpaid' | 'late' | ''
 */
export function usePayments(monthStr, statusFilter = '') {
  const { members, payments, loading, markPaymentPaid, markPaymentUnpaid } = useData()

  // All payments for this month
  const monthPayments = useMemo(
    () => payments.filter(p => p.month === monthStr),
    [payments, monthStr]
  )

  // Filtered by status
  const filtered = useMemo(() => {
    if (!statusFilter) return monthPayments
    return monthPayments.filter(p => p.status === statusFilter)
  }, [monthPayments, statusFilter])

  // Revenue and count stats
  const stats = useMemo(() => {
    const paid   = monthPayments.filter(p => p.status === 'paid')
    const unpaid = monthPayments.filter(p => p.status === 'unpaid')
    const late   = monthPayments.filter(p => p.status === 'late')
    const revenue = paid.reduce((s, p) => s + (p.amount ?? 0), 0)
    return {
      total:       monthPayments.length,
      paidCount:   paid.length,
      unpaidCount: unpaid.length,
      lateCount:   late.length,
      revenue,
    }
  }, [monthPayments])

  // Member lookup helper
  const getMember = (memberId) => members.find(m => m.id === memberId)

  // Find payment for a specific member in this month
  const getPaymentForMember = (memberId) =>
    monthPayments.find(p => p.memberId === memberId) ?? null

  return {
    payments: filtered,
    allMonthPayments: monthPayments,
    stats,
    loading,
    getMember,
    getPaymentForMember,
    markPaymentPaid,
    markPaymentUnpaid,
  }
}

/**
 * Returns all payments for a single member, sorted by month desc.
 */
export function useMemberPayments(memberId) {
  const { payments, loading } = useData()

  const memberPayments = useMemo(
    () =>
      payments
        .filter(p => p.memberId === memberId)
        .sort((a, b) => b.month.localeCompare(a.month)),
    [payments, memberId]
  )

  const stats = useMemo(() => {
    const paid    = memberPayments.filter(p => p.status === 'paid')
    const revenue = paid.reduce((s, p) => s + (p.amount ?? 0), 0)
    return { total: memberPayments.length, paidCount: paid.length, revenue }
  }, [memberPayments])

  return { payments: memberPayments, stats, loading }
}
