export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-[3px]' }
  return (
    <div
      className={`rounded-full border-slate-200 border-t-indigo-600 animate-spin ${sizes[size] ?? sizes.md} ${className}`}
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 h-full min-h-64">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-gray-400 font-medium">Loading…</p>
    </div>
  )
}
