export default function Card({ children, className = '', padding = true }) {
  return (
    <div
      className={`
        bg-white rounded-xl border border-gray-200 shadow-sm
        ${padding ? 'p-5' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <span className="w-1 h-3.5 rounded-full bg-primary-500 shrink-0 opacity-70" />
          {title}
        </h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5 ml-2.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
