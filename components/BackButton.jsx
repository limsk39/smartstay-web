'use client'

import { useRouter } from 'next/navigation'

export default function BackButton({ href, label = '뒤로' }) {
  const router = useRouter()

  const handleBack = () => {
    if (href) {
      router.push(href)
    } else {
      router.back()
    }
  }

  return (
    <button
      onClick={handleBack}
      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-white/5"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span>{label}</span>
    </button>
  )
}
