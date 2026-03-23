const VARIANTS = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700 shadow-sm shadow-primary-200/60',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300',
  danger:    'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-200',
  ghost:     'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
  success:   'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200',
  outline:   'border border-primary-400 text-primary-600 hover:bg-primary-50 hover:border-primary-500',
}

const SIZES = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  ...props
}) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-1.5
        font-medium rounded-lg transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1
        ${VARIANTS[variant] ?? VARIANTS.primary}
        ${SIZES[size] ?? SIZES.md}
        ${className}
      `}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  )
}
