'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function HomePage() {
  const router = useRouter()
  const [time, setTime] = useState(new Date())
  const [logoTapCount, setLogoTapCount] = useState(0)
  const [logoError, setLogoError] = useState(false)
  const tapTimerRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogoTap = () => {
    const next = logoTapCount + 1
    setLogoTapCount(next)
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    if (next >= 5) {
      setLogoTapCount(0)
      router.push('/admin/login')
      return
    }
    tapTimerRef.current = setTimeout(() => setLogoTapCount(0), 3000)
  }

  useEffect(() => {
    return () => { if (tapTimerRef.current) clearTimeout(tapTimerRef.current) }
  }, [])

  const formatTime = (date) =>
    date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  const formatDate = (date) =>
    date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] flex flex-col items-center justify-between py-8 px-4 sm:py-12 sm:px-6">

      {/* 상단 시계 */}
      <div className="w-full max-w-sm sm:max-w-lg text-center">
        <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4 sm:px-8 sm:py-6">
          <div className="text-4xl sm:text-6xl font-bold text-white tracking-widest font-mono">
            {formatTime(time)}
          </div>
          <div className="text-gray-400 text-sm sm:text-lg mt-1 sm:mt-2">{formatDate(time)}</div>
        </div>
      </div>

      {/* 중앙 로고 & 브랜드 */}
      <div className="flex flex-col items-center gap-4 sm:gap-6 flex-1 justify-center py-6">
        <div
          onClick={handleLogoTap}
          className="relative cursor-pointer select-none"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {!logoError ? (
            <div className="w-24 h-24 sm:w-32 sm:h-32 relative">
              <Image
                src="/ts-logo.png"
                alt="TS객실제어 로고"
                fill
                className="object-contain"
                onError={() => setLogoError(true)}
                priority
              />
            </div>
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-[#e94560]/10 border border-[#e94560]/30 rounded-3xl flex items-center justify-center brand-glow">
              <svg viewBox="0 0 80 80" className="w-16 h-16 sm:w-20 sm:h-20" fill="none">
                <rect x="8" y="8" width="28" height="28" rx="6" fill="#e94560" opacity="0.9"/>
                <rect x="44" y="8" width="28" height="28" rx="6" fill="#e94560" opacity="0.6"/>
                <rect x="8" y="44" width="28" height="28" rx="6" fill="#e94560" opacity="0.6"/>
                <rect x="44" y="44" width="28" height="28" rx="6" fill="#e94560" opacity="0.3"/>
                <circle cx="40" cy="40" r="6" fill="white"/>
              </svg>
            </div>
          )}
          {logoTapCount > 0 && (
            <div className="absolute -top-2 -right-2 bg-[#e94560] text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
              {logoTapCount}
            </div>
          )}
        </div>

        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">TS객실제어</h1>
          <p className="text-gray-400 text-base sm:text-lg">스마트 무인 숙박 시스템</p>
        </div>

        <button
          onClick={() => router.push('/rooms')}
          className="mt-2 sm:mt-4 bg-[#e94560] hover:bg-[#c73652] text-white text-xl sm:text-2xl font-bold px-12 py-5 sm:px-16 sm:py-6 rounded-2xl brand-glow pulse-brand transition-all duration-200 active:scale-95 w-full max-w-xs sm:max-w-sm"
        >
          객실 예약하기
        </button>
      </div>

      {/* 하단 정보 */}
      <div className="w-full max-w-sm sm:max-w-lg">
        <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-gray-500 text-xs mb-1">고객센터</div>
              <div className="text-white font-bold text-xs sm:text-sm">1566-3813</div>
            </div>
            <div className="border-l border-r border-white/10">
              <div className="text-gray-500 text-xs mb-1">체크인</div>
              <div className="text-white font-bold text-xs sm:text-sm">15:00</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">체크아웃</div>
              <div className="text-white font-bold text-xs sm:text-sm">11:00</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
