'use client'

export default function LoadingSpinner({ size = 'md', text = '로딩 중...' }) {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-12 h-12 border-3',
    lg: 'w-20 h-20 border-4',
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className={`${sizes[size]} rounded-full border-white/20 border-t-[#e94560] animate-spin`}
        style={{ borderWidth: size === 'sm' ? 2 : size === 'lg' ? 4 : 3 }}
      />
      {text && (
        <p className="text-gray-400 text-sm">{text}</p>
      )}
    </div>
  )
}
