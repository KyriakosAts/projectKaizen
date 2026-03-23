// Member validation
export function validateMember(data) {
  const errors = {}
  if (!data.name?.trim()) errors.name = 'Name is required'
  if (data.name?.trim().length < 2) errors.name = 'Name must be at least 2 characters'
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Invalid email address'
  if (data.phone && !/^[\d\s\+\-\(\)]{7,20}$/.test(data.phone.trim())) errors.phone = 'Invalid phone number'
  if (!data.categories?.length) errors.categories = 'Select at least one service'
  if (!data.joinDate) errors.joinDate = 'Join date is required'
  if (data.joinDate && new Date(data.joinDate) > new Date()) errors.joinDate = 'Join date cannot be in the future'
  if (data.customFee !== null && data.customFee !== undefined && data.customFee !== '') {
    const fee = Number(data.customFee)
    if (isNaN(fee) || fee < 0) errors.customFee = 'Custom fee must be a positive number'
    if (fee > 9999) errors.customFee = 'Custom fee seems too high'
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

// Payment validation
export function validatePayment(data) {
  const errors = {}
  if (!data.memberId) errors.memberId = 'Member is required'
  if (!data.month || !/^\d{4}-\d{2}$/.test(data.month)) errors.month = 'Invalid month format (YYYY-MM)'
  if (data.amount === null || data.amount === undefined) errors.amount = 'Amount is required'
  const amount = Number(data.amount)
  if (isNaN(amount) || amount < 0) errors.amount = 'Amount must be a non-negative number'
  if (amount > 9999) errors.amount = 'Amount seems too high'
  if (!['paid', 'unpaid'].includes(data.status)) errors.status = 'Invalid status'
  return { valid: Object.keys(errors).length === 0, errors }
}

// Belt promotion validation
export function validateBeltPromotion(data) {
  const errors = {}
  if (!data.category) errors.category = 'Service is required'
  if (!data.toBelt) errors.toBelt = 'Target belt is required'
  if (!data.promotedAt) errors.promotedAt = 'Promotion date is required'
  if (data.promotedAt && new Date(data.promotedAt) > new Date()) errors.promotedAt = 'Promotion date cannot be in the future'
  if (data.fromBelt && data.fromBelt === data.toBelt) errors.toBelt = 'New belt must be different from current belt'
  return { valid: Object.keys(errors).length === 0, errors }
}

// Service configuration validation
export function validateService(data) {
  const errors = {}
  if (!data.name?.trim()) errors.name = 'Service name is required'
  if (data.name?.trim().length < 2) errors.name = 'Name must be at least 2 characters'
  if (data.monthlyFee === null || data.monthlyFee === undefined) errors.monthlyFee = 'Monthly fee is required'
  const fee = Number(data.monthlyFee)
  if (isNaN(fee) || fee < 0) errors.monthlyFee = 'Fee must be a non-negative number'
  if (!data.color || !/^#[0-9A-Fa-f]{6}$/.test(data.color)) errors.color = 'Valid hex color is required'
  return { valid: Object.keys(errors).length === 0, errors }
}

// Attendance log validation
export function validateAttendance(data) {
  const errors = {}
  if (!data.memberId) errors.memberId = 'Member is required'
  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) errors.date = 'Invalid date format'
  if (data.date && new Date(data.date) > new Date()) errors.date = 'Cannot log attendance for future dates'
  if (!data.sessionType) errors.sessionType = 'Session type (service) is required'
  return { valid: Object.keys(errors).length === 0, errors }
}

// Instructor validation
export function validateInstructor(data) {
  const errors = {}
  if (!data.name?.trim()) errors.name = 'Name is required'
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Invalid email'
  if (data.phone && !/^[\d\s\+\-\(\)]{7,20}$/.test(data.phone.trim())) errors.phone = 'Invalid phone'
  return { valid: Object.keys(errors).length === 0, errors }
}
