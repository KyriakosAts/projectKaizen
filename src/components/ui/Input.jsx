export default function Input({ label, error, hint, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-medium text-gray-600">
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        className={`
          w-full border rounded-lg px-3 py-2 text-sm text-gray-900
          placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
          transition-colors duration-150
          disabled:bg-gray-50 disabled:text-gray-500
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

export function Textarea({ label, error, hint, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-medium text-gray-600">{label}</label>
      )}
      <textarea
        className={`
          w-full border rounded-lg px-3 py-2 text-sm text-gray-900
          placeholder:text-gray-400 resize-none
          focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
          transition-colors duration-150
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-medium text-gray-600">{label}</label>
      )}
      <select
        className={`
          w-full border rounded-lg px-3 py-2 text-sm text-gray-900
          focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
          transition-colors duration-150 bg-white
          ${error ? 'border-red-400' : 'border-gray-200'}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
