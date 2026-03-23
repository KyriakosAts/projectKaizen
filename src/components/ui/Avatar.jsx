import { getInitials, getAvatarColor } from '../../utils/helpers'

export default function Avatar({ name = '', size = 'md', className = '' }) {
  const initials   = getInitials(name)
  const colorClass = getAvatarColor(name)

  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-14 h-14 text-lg',
  }

  return (
    <div
      className={`
        rounded-full ${colorClass} text-white font-bold
        flex items-center justify-center shrink-0 select-none
        ring-2 ring-white
        ${sizes[size] ?? sizes.md}
        ${className}
      `}
    >
      {initials}
    </div>
  )
}
