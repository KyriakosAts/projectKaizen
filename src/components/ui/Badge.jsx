import { CATEGORY_COLORS, CATEGORY_LABELS, STATUS_CLASSES } from '../../utils/helpers'
import { hexToRgba } from '../../utils/helpers'
import { useServices } from '../../contexts/ServicesContext'

/**
 * CategoryBadge — supports both static Tailwind colors (built-in sports)
 * and dynamic hex colors (custom services).
 * Pass `colorHex` to override the default color lookup.
 */
export function CategoryBadge({ category, colorHex, label }) {
  const displayLabel = label ?? CATEGORY_LABELS[category] ?? category

  if (colorHex) {
    return (
      <span
        className="inline-flex items-center text-xs px-2 py-0.5 rounded-md font-semibold"
        style={{ backgroundColor: hexToRgba(colorHex, 0.12), color: colorHex }}
      >
        {displayLabel}
      </span>
    )
  }

  const colors = CATEGORY_COLORS[category] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md font-semibold ${colors.bg} ${colors.text}`}>
      {displayLabel}
    </span>
  )
}

/**
 * ServiceBadge — looks up the service by ID from ServicesContext and renders
 * with the correct name and color. Falls back gracefully for built-in categories.
 * Use this everywhere a member's category/service tag is shown.
 */
export function ServiceBadge({ serviceId }) {
  const { services } = useServices()
  const svc = services.find(s => s.id === serviceId)

  // If service found in context, use its name + color
  if (svc) {
    return <CategoryBadge category={serviceId} colorHex={svc.color} label={svc.name} />
  }

  // Fallback to static CATEGORY_COLORS / CATEGORY_LABELS for built-in sports
  return <CategoryBadge category={serviceId} />
}

export function StatusBadge({ status }) {
  const s = STATUS_CLASSES[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  )
}
